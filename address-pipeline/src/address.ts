/**
 * Pure address parsing and normalisation. No DOM, no I/O.
 *
 * Postcode table (data/postcodes.json): derived from "Suburbs and Localities (SAL) 2021 - Postal
 * Areas (POA) 2021 - Modified Monash Model 2023", Australian Bureau of Statistics ASGS 2021 via
 * Australian Government Dept of Health, data.gov.au, licence CC BY 2.5 AU. Keys are
 * "<normalised suburb>|<STATE>", values comma-separated postcodes. Not the Microburbs CSVs.
 */
import postcodeTable from "./data/postcodes.json";
import type { ParsedAddress } from "./types";

export interface ParsedFields {
  /** Street line exactly as given. */
  raw: string;
  unit?: string;
  /** First (or only) street number, e.g. "70", "70A". */
  streetNumber?: string;
  /** Second number of a range such as 70-72. */
  streetNumberEnd?: string;
  lot?: string;
  /** Normalised street name, e.g. "st kilda road". */
  street: string;
  /** Street name as written, e.g. "St Kilda Rd" (for display). */
  streetRaw: string;
  /** Normalised suburb. */
  suburb: string;
  state: string;
  postcode: string;
  postcodeSource?: "page" | "table";
  /** True for ranges and Lot numbers. */
  lowConfidence: boolean;
}

const STREET_TYPES: Record<string, string> = {
  st: "street", rd: "road", pde: "parade", cres: "crescent", cr: "crescent", ave: "avenue",
  av: "avenue", dr: "drive", ct: "court", pl: "place", ln: "lane", hwy: "highway",
  bvd: "boulevard", blvd: "boulevard", tce: "terrace", cl: "close", cct: "circuit",
  esp: "esplanade", gr: "grove", pwy: "parkway", sq: "square", wy: "way", rdge: "ridge",
};

const clean = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9/ -]/g, " ").replace(/\s+/g, " ").trim();

function saintMount(words: string[]): string[] {
  return words.map((w) => (w === "saint" ? "st" : w === "mount" ? "mt" : w));
}

/** "Saint Kilda " -> "st kilda". Also strips a trailing "(NSW)". */
export function normaliseSuburb(suburb: string): string {
  const s = suburb.replace(/\s*\([^)]*\)\s*$/, "");
  return saintMount(clean(s).replace(/-/g, " ").split(" ").filter(Boolean)).join(" ");
}

/**
 * "Marine Pde" -> "marine parade"; Saint/St and Mount/Mt unify to st/mt. A leading "St" and a
 * street's own name words are left alone; only the final word is treated as a street type.
 */
function normaliseStreet(street: string): string {
  const words = saintMount(clean(street).replace(/-/g, " ").split(" ").filter(Boolean));
  if (words.length > 1) {
    const last = words[words.length - 1];
    words[words.length - 1] = STREET_TYPES[last] ?? last;
  }
  return words.join(" ");
}

const UNIT_WORD = "(?:unit|apt|apartment|suite|shop|u)";
const NUM = "[a-z]?\\d+[a-z]?";

/** Parses a street line such as "Unit 1/70-72 Smith St". Never throws. */
export function parseStreetLine(line: string): Omit<ParsedFields, "suburb" | "state" | "postcode"> {
  let s = line.trim().replace(/\s+/g, " ");
  let unit: string | undefined;
  let lowConfidence = false;

  // "Level 3, ..." prefixes carry no information for matching.
  s = s.replace(/^(?:level|lvl|floor|fl)\s*\w+\s*,\s*/i, "");

  // "Unit 1, 70 Smith St"
  const commaUnit = new RegExp(`^(?:${UNIT_WORD}\\s*)?(${NUM})\\s*,\\s*(\\d.*)$`, "i").exec(s);
  if (commaUnit) {
    unit = commaUnit[1].toLowerCase();
    s = commaUnit[2];
  }

  // "Lot 430 ...", "Lot, 5511 ...", "Lot, Lot 5532 ..."
  const lot = /^lot\b[\s,]*(?:lot\s*)?(\d\w*)\s*,?\s*(.*)$/i.exec(s);
  if (lot) {
    return { raw: line, lot: lot[1], street: normaliseStreet(lot[2]), streetRaw: lot[2].trim(), lowConfidence: true };
  }

  let m: RegExpExecArray | null;
  let streetNumber: string | undefined;
  let streetNumberEnd: string | undefined;
  let rest = s;
  const slash = new RegExp(`^(?:${UNIT_WORD}\\s*)?(${NUM})\\s*/\\s*(\\d+[a-z]?)(?:\\s*-\\s*(\\d+[a-z]?))?\\s+(.+)$`, "i");
  const plain = /^(\d+[a-z]?)(?:\s*-\s*(\d+[a-z]?))?\s+(.+)$/i;
  if ((m = slash.exec(s))) {
    unit = m[1].toLowerCase();
    streetNumber = m[2].toUpperCase();
    streetNumberEnd = m[3]?.toUpperCase();
    rest = m[4];
  } else if ((m = plain.exec(s))) {
    streetNumber = m[1].toUpperCase();
    streetNumberEnd = m[2]?.toUpperCase();
    rest = m[3];
  }
  if (streetNumberEnd) lowConfidence = true;

  const out: Omit<ParsedFields, "suburb" | "state" | "postcode"> = {
    raw: line,
    street: normaliseStreet(rest),
    streetRaw: rest.trim(),
    lowConfidence,
  };
  if (unit) out.unit = unit;
  if (streetNumber) out.streetNumber = streetNumber;
  if (streetNumberEnd) out.streetNumberEnd = streetNumberEnd;
  return out;
}

/** Postcodes the bundled table lists for a suburb+state (several for split suburbs). */
function tablePostcodes(suburb: string, state: string): string[] {
  const v = (postcodeTable as Record<string, string>)[`${normaliseSuburb(suburb)}|${state.toUpperCase()}`];
  return v ? v.split(",") : [];
}

/** Parse and fill the postcode: the given one (may be empty), then the bundled table. */
export function parseAddress(a: ParsedAddress): ParsedFields {
  const base = parseStreetLine(a.street);
  const state = a.state.toUpperCase();
  let postcode = "";
  let postcodeSource: ParsedFields["postcodeSource"];
  if (a.postcode) [postcode, postcodeSource] = [a.postcode, "page"];
  else {
    const t = tablePostcodes(a.suburb, state);
    if (t.length) [postcode, postcodeSource] = [t[0], "table"];
  }
  const out: ParsedFields = { ...base, suburb: normaliseSuburb(a.suburb), state, postcode, lowConfidence: base.lowConfidence };
  if (postcodeSource) out.postcodeSource = postcodeSource;
  return out;
}
