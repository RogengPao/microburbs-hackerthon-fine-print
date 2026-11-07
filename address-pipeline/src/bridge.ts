/**
 * The extension's address API (extension/src/agent/address.js), backed by the
 * address pipeline. Same shapes the agent code already uses:
 *   parts = { unit, number, street, suburb, state, postcode } (+ lot, lowConfidence when set)
 * Parts are for display (upper case, as written). Matching re-parses them and
 * compares normalised forms, so "Pde" and "Parade" agree.
 */
import { parseAddress as parseFields, parseStreetLine, type ParsedFields } from "./address";
import { splitAddressTail } from "./addressTail";
import { parseHeadingAddress } from "./headingAddress";
import { buildQueries, decide, type MatchOutcome, type UnresolvedReason } from "./matcher";
import type { GeocodeCandidate } from "./api";

export interface Parts {
  unit: string | null;
  number: string | null;
  street: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  /** Land lot number; present only for Lot listings. */
  lot?: string;
  /** Present (true) for Lot numbers and street-number ranges. */
  lowConfidence?: true;
}

const up = (s: string | null | undefined) =>
  s ? String(s).toUpperCase().replace(/\./g, "").replace(/\s+/g, " ").trim() || null : null;

function partsFrom(street: string, suburb: string | null, state: string | null, postcode: string | null): Parts {
  const f = parseStreetLine(street);
  const number = f.streetNumber ? (f.streetNumberEnd ? `${f.streetNumber}-${f.streetNumberEnd}` : f.streetNumber) : null;
  const out: Parts = {
    unit: up(f.unit),
    number,
    street: up(f.streetRaw),
    suburb: up(suburb?.replace(/\s*\([^)]*\)\s*$/, "")),
    state: up(state),
    postcode: postcode || null,
  };
  if (f.lot) out.lot = f.lot.toUpperCase();
  if (f.lowConfidence) out.lowConfidence = true;
  return out;
}

/**
 * Free text -> parts. Takes listing headings ("Lot, 5511 Nautical Cct, Tarneit, Vic 3029")
 * and what an investor types ("38/3 Victoria Park Pde, Zetland"; state optional).
 */
export function parseAddress(text: string | null | undefined): Parts {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  const tail = splitAddressTail(t);
  if (tail) return partsFrom(tail.street, tail.suburb, tail.state, tail.postcode || null);
  const segs = t.split(",").map((s) => s.trim()).filter(Boolean);
  if (segs.length > 1) return partsFrom(segs.slice(0, -1).join(", "), segs[segs.length - 1], null, null);
  return partsFrom(t, null, null, null);
}

/** Parts -> one geocode query / display line, e.g. "38/3 VICTORIA PARK PARADE, ZETLAND NSW 2017". */
export function formatAddress(p: Parts): string {
  const num = p.lot ? `Lot ${p.lot}` : `${p.unit ? `${p.unit}/` : ""}${p.number ?? ""}`;
  const lead = `${num} ${p.street ?? ""}`.trim();
  const area = [p.suburb, [p.state, p.postcode].filter(Boolean).join(" ")].filter(Boolean).join(" ");
  return [lead, area].filter(Boolean).join(", ");
}

const hasStreet = (p: Parts | null): p is Parts => Boolean(p && (p.number || p.lot) && p.street);

/** Parts -> the pipeline's normalised fields (postcode filled from the table when missing). */
function fieldsOf(p: Parts): ParsedFields {
  const num = p.lot ? `Lot ${p.lot}` : `${p.unit ? `${p.unit}/` : ""}${p.number ?? ""}`;
  return parseFields({ street: `${num} ${p.street ?? ""}`.trim(), suburb: p.suburb ?? "", state: p.state ?? "", postcode: p.postcode ?? "" });
}

export type MatchReason = UnresolvedReason | "lot";

export type AddressMatch =
  | { kind: "exact"; propertyId: string; candidate: GeocodeCandidate }
  | { kind: "unresolved"; reason: MatchReason; candidates: GeocodeCandidate[] };

/**
 * Strict match. Exact needs unit, street number (ranges overlap), street and suburb to agree,
 * and exactly one candidate left. Lot listings are never exact: the buyer confirms them.
 */
export function matchAddress(candidates: GeocodeCandidate[] | null | undefined, want: Parts): AddressMatch {
  const f = fieldsOf(want);
  return toMatch(f, decide(f, candidates ?? []));
}

function toMatch(f: ParsedFields, o: MatchOutcome): AddressMatch {
  if (o.kind === "exact") {
    if (f.lot) return { kind: "unresolved", reason: "lot", candidates: [o.candidate] };
    return { kind: "exact", propertyId: o.candidate.id, candidate: o.candidate };
  }
  return { kind: "unresolved", reason: o.reason, candidates: o.candidates.map((s) => s.candidate) };
}

/**
 * Geocode + strict match. Sends the full normalised query, then up to two looser retries,
 * but only while nothing passed: ambiguity is for the buyer to resolve, not another query.
 * If every query ends in no-match, all candidates seen are scored together.
 * Geocoder errors are not caught.
 */
export async function findProperty(
  want: Parts,
  geocode: (query: string) => Promise<GeocodeCandidate[] | null | undefined>,
): Promise<{ match: AddressMatch; queries: string[]; candidates: GeocodeCandidate[] }> {
  const f = fieldsOf(want);
  const queries: string[] = [];
  const seen = new Map<string, GeocodeCandidate>();
  let o: MatchOutcome | undefined;
  for (const q of buildQueries(f)) {
    queries.push(q);
    const found = (await geocode(q)) ?? [];
    for (const c of found) seen.set(c.id, c);
    if (found.length === 0) continue;
    o = decide(f, found);
    if (o.kind === "exact" || o.reason !== "no-match") break;
  }
  const all = [...seen.values()];
  if (!o || (o.kind === "unresolved" && o.reason === "no-match")) o = decide(f, all);
  return { match: toMatch(f, o), queries, candidates: all };
}

/** The exact candidate, or null. Never "closest". */
export function matchCandidate(candidates: GeocodeCandidate[] | null | undefined, want: Parts) {
  const m = matchAddress(candidates, want);
  return m.kind === "exact" ? { candidate: m.candidate, why: "unit, number, street and suburb match" } : null;
}

/** One line for the agent: why no candidate was taken. */
export function unresolvedHint(reason: MatchReason): string {
  switch (reason) {
    case "lot": return "this is a land lot; lots are never matched automatically — ask the investor to confirm the property";
    case "several-units": return "the address has several units and the listing names none — ask the investor which unit";
    case "ambiguous": return "more than one property fits — ask the investor to confirm the address";
    case "suburb-mismatch": return "the street address exists, but in a different suburb — ask the investor to confirm the suburb";
    default: return "no property fits this address — ask the investor to confirm it";
  }
}

interface PageListing {
  portal?: string;
  unit?: string | null;
  number?: string | null;
  street?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  full?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface Page {
  listing?: PageListing | null;
  heading?: string | null;
  og?: { title?: string | null } | null;
}

/**
 * Best address from a page read: the portal's own page data, then its full address text
 * (Lots), then the heading, then og:title. Null when no street address is on the page
 * (e.g. "Address available on request").
 */
export function addressFromPage(page: Page | null | undefined) {
  const l = page?.listing;
  const where = { lat: l?.lat ?? null, lng: l?.lng ?? null };
  if (l?.number && l?.street) {
    const parts = partsFrom(`${l.unit ? `${l.unit}/` : ""}${l.number} ${l.street}`, l.suburb ?? null, l.state ?? null, l.postcode ?? null);
    if (hasStreet(parts)) return { parts, ...where, source: `${l.portal} page data` };
  }
  if (l?.full) {
    const parts = parseAddress(l.full);
    if (hasStreet(parts)) return { parts, ...where, source: `${l.portal} page data` };
  }
  for (const [text, source] of [[page?.heading, "page heading"], [page?.og?.title, "page title"]] as const) {
    const h = parseHeadingAddress(text);
    const parts = h ? partsFrom(h.street, h.suburb, h.state, h.postcode || null) : text ? parseAddress(text) : null;
    if (hasStreet(parts)) return { parts, lat: null, lng: null, source };
  }
  return null;
}
