/**
 * Pure candidate matching: parsed listing address + geocoder candidates -> outcome.
 * No I/O.
 */
import { parseStreetLine, normaliseSuburb, type ParsedFields } from "./address";
import type { GeocodeCandidate } from "./api";

export interface ScoredCandidate {
  candidate: GeocodeCandidate;
  /** Candidate fields parsed from its display name. */
  suburb: string;
  number?: string;
  unit?: string;
  /** State shown in the display name, if any. */
  state?: string;
  suburbMatches: boolean;
  /** Everything except the suburb agrees (number, street). */
  coreMatches: boolean;
}

/** Why no single property was chosen. */
export type UnresolvedReason = "ambiguous" | "suburb-mismatch" | "several-units" | "no-match";

export type MatchOutcome =
  | { kind: "exact"; propertyId: string; candidate: GeocodeCandidate; scored: ScoredCandidate[] }
  | {
      kind: "unresolved";
      reason: UnresolvedReason;
      /** The candidates relevant to the reason (those that passed, or near misses). */
      candidates: ScoredCandidate[];
      /** Every candidate considered, scored. */
      scored: ScoredCandidate[];
    };

/** Parse "Unit 1, 70 Raglan Street, Waterloo (NSW)" into comparable parts. */
function parseDisplayName(name: string) {
  const parts = name.split(",").map((s) => s.trim());
  let place = parts.length > 1 ? parts[parts.length - 1] : "";
  let state: string | undefined;
  place = place.replace(/\s+\d{4}$/, ""); // trailing postcode
  const st = /\(([A-Za-z]{2,3})\)\s*$/.exec(place) ?? /\s(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)$/i.exec(place);
  if (st) {
    state = st[1].toUpperCase();
    place = place.slice(0, st.index);
  }
  const street = parts.length > 1 ? parts.slice(0, -1).join(", ") : name;
  return { suburb: normaliseSuburb(place), state, ...parseStreetLine(street) };
}

interface Span {
  lo: number;
  hi: number;
  /** Letter suffix of a single number ("70A"); ranges ignore suffixes. */
  suffix: string;
}

function span(start?: string, end?: string): Span | undefined {
  const m = /^(\d+)([A-Z]?)$/.exec(start ?? "");
  if (!m) return undefined;
  const lo = Number(m[1]);
  const e = /^(\d+)/.exec(end ?? "");
  return e ? { lo, hi: Math.max(lo, Number(e[1])), suffix: "" } : { lo, hi: lo, suffix: m[2] };
}

/** Street numbers agree when their ranges overlap (and single-number suffixes are equal). */
function numbersAgree(a?: Span, b?: Span): boolean {
  if (!a || !b) return false;
  const overlap = a.lo <= b.hi && b.lo <= a.hi;
  const bothSingle = a.lo === a.hi && b.lo === b.hi;
  return overlap && (!bothSingle || a.suffix === b.suffix);
}

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Street names (already normalised) agree: same type word, name within one typo. */
function streetsAgree(a: string, b: string): boolean {
  if (a === b) return true;
  const [aw, bw] = [a.split(" "), b.split(" ")];
  if (aw.length < 2 || bw.length < 2 || aw[aw.length - 1] !== bw[bw.length - 1]) return false;
  const [an, bn] = [aw.slice(0, -1).join(" "), bw.slice(0, -1).join(" ")];
  return Math.min(an.length, bn.length) >= 5 && editDistance(an, bn) <= 1;
}

export function scoreCandidate(listing: ParsedFields, candidate: GeocodeCandidate): ScoredCandidate {
  const c = parseDisplayName(candidate.display_name);
  return {
    candidate,
    suburb: c.suburb,
    number: c.streetNumber,
    unit: c.unit,
    state: c.state,
    suburbMatches: c.suburb === listing.suburb,
    coreMatches:
      (listing.lot !== undefined
        ? c.lot === listing.lot
        : c.lot === undefined && numbersAgree(span(listing.streetNumber, listing.streetNumberEnd), span(c.streetNumber, c.streetNumberEnd))) &&
      streetsAgree(c.street, listing.street) &&
      (!listing.unit || c.unit?.toLowerCase() === listing.unit.toLowerCase()) &&
      (!c.state || !listing.state || c.state === listing.state.toUpperCase()),
  };
}

export function decide(listing: ParsedFields, candidates: GeocodeCandidate[]): MatchOutcome {
  const scored = candidates.map((c) => scoreCandidate(listing, c));
  const passing = scored.filter((s) => s.coreMatches && s.suburbMatches);
  if (passing.length === 1 && !listing.unit && passing[0].unit) {
    // A unit-less listing must not take the only unit the geocoder returned.
    return { kind: "unresolved", reason: "several-units", candidates: passing, scored };
  }
  if (passing.length === 1) {
    return { kind: "exact", propertyId: passing[0].candidate.id, candidate: passing[0].candidate, scored };
  }
  if (passing.length > 1 && !listing.unit) {
    // Unit-less listing: a single whole-property candidate wins; all-units means several units.
    const whole = passing.filter((s) => !s.unit);
    if (whole.length === 1) {
      return { kind: "exact", propertyId: whole[0].candidate.id, candidate: whole[0].candidate, scored };
    }
    if (whole.length === 0) return { kind: "unresolved", reason: "several-units", candidates: passing, scored };
  }
  if (passing.length > 1) return { kind: "unresolved", reason: "ambiguous", candidates: passing, scored };
  const near = scored.filter((s) => s.coreMatches);
  if (near.length === 1) return { kind: "unresolved", reason: "suburb-mismatch", candidates: near, scored };
  if (near.length > 1) return { kind: "unresolved", reason: "ambiguous", candidates: near, scored };
  return { kind: "unresolved", reason: "no-match", candidates: [], scored };
}

function formatQuery(f: ParsedFields, o: { unit: boolean; suburb: boolean; range: boolean }): string {
  const number = f.lot
    ? `lot ${f.lot}`
    : f.streetNumber
      ? (o.range && f.streetNumberEnd ? `${f.streetNumber}-${f.streetNumberEnd}` : f.streetNumber)
      : "";
  const withUnit = o.unit && f.unit && f.streetNumber ? `${f.unit}/${number}` : number;
  const street = [withUnit, f.street].filter(Boolean).join(" ");
  const tail = [o.suburb ? f.suburb : "", f.state.toLowerCase(), f.postcode].filter(Boolean).join(" ");
  return tail ? `${street}, ${tail}` : street;
}

/**
 * The cleaned primary query followed by up to two retry variants, in the order: without the
 * unit, without the suburb, first number of a range. Variants identical to a prior query are dropped.
 */
export function buildQueries(f: ParsedFields): string[] {
  const full = { unit: true, suburb: true, range: true };
  const variants: string[] = [];
  if (f.unit) variants.push(formatQuery(f, { ...full, unit: false }));
  if (f.suburb) variants.push(formatQuery(f, { ...full, suburb: false }));
  if (f.streetNumberEnd) variants.push(formatQuery(f, { ...full, range: false }));
  return [...new Set([formatQuery(f, full), ...variants.slice(0, 2)])];
}
