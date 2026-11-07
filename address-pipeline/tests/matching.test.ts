import { describe, expect, it } from "vitest";
import { findProperty, parseAddress } from "../src/bridge";
import type { GeocodeCandidate } from "../src/api";

/** Real sample geocode result for "1/70 Raglan Street" (Microburbs brief). */
const SAMPLE: GeocodeCandidate[] = [
  { id: "GANSW710352293", display_name: "Unit 1, 70 Raglan Street, Waterloo (NSW)", property_type: "unit" },
  { id: "GANSW705422767", display_name: "Unit 1, 70 Raglan Street, Mosman", property_type: "unit" },
  { id: "GANSW717522364", display_name: "Unit 1, 70 Raglan Street, Manly (NSW)", property_type: "unit" },
];

/** A listing address as the extension reads it. */
const listing = (street: string, suburb: string, state = "NSW", postcode = "") =>
  parseAddress(`${street}, ${suburb} ${state}${postcode ? ` ${postcode}` : ""}`);

const cand = (id: string, display_name: string): GeocodeCandidate => ({ id, display_name, property_type: "unit" });

/** Geocode stub that answers by query (default: the sample) and records the queries. */
function api(answer: (q: string) => GeocodeCandidate[] = () => SAMPLE) {
  const queries: string[] = [];
  return { queries, geocode: async (q: string) => (queries.push(q), answer(q)) };
}

const matchOf = (want: ReturnType<typeof listing>, a = api()) => findProperty(want, a.geocode);

describe("matching: the three sample candidates (unit 1/70 Raglan Street)", () => {
  it("resolves to Mosman by suburb, never the top-ranked Waterloo", async () => {
    const m = await matchOf(listing("Unit 1/70 Raglan Street", "Mosman", "NSW", "2088"));
    expect(m.match).toMatchObject({ kind: "exact", propertyId: "GANSW705422767" });
  });

  it("resolves Waterloo and Manly listings to their own properties", async () => {
    const w = await matchOf(listing("1/70 Raglan Street", "Waterloo", "NSW", "2017"));
    const m = await matchOf(listing("1/70 Raglan Street", "Manly", "NSW", "2095"));
    expect(w.match).toMatchObject({ kind: "exact", propertyId: "GANSW710352293" });
    expect(m.match).toMatchObject({ kind: "exact", propertyId: "GANSW717522364" });
  });

  it("never takes the top candidate when the suburb matches none of them", async () => {
    const m = await matchOf(listing("1/70 Raglan Street", "Chatswood", "NSW", "2067"));
    expect(m.match).toMatchObject({ kind: "unresolved", reason: "ambiguous" });
    expect(m.match).not.toHaveProperty("propertyId");
  });
});

describe("matching: unresolved outcomes carry scored candidates and a reason", () => {
  it("a unique unit, number and street in a different suburb needs confirming", async () => {
    const one = api(() => [cand("A1", "Unit 1, 70 Raglan Street, Mosman")]);
    const m = await matchOf(listing("1/70 Raglan Street", "Cremorne", "NSW", "2090"), one);
    expect(m.match).toMatchObject({ kind: "unresolved", reason: "suburb-mismatch" });
    if (m.match.kind !== "unresolved") throw new Error();
    expect(m.match.candidates.map((c) => c.id)).toEqual(["A1"]);
  });

  it("reports no confident match when the street number differs", async () => {
    const m = await matchOf(listing("1/72 Raglan Street", "Mosman", "NSW", "2088"));
    expect(m.match).toMatchObject({ kind: "unresolved", reason: "no-match" });
  });

  it("reports no confident match when the street differs", async () => {
    const m = await matchOf(listing("1/70 Belmont Road", "Mosman", "NSW", "2088"));
    expect(m.match).toMatchObject({ kind: "unresolved", reason: "no-match" });
  });
});

describe("matching: unit, state and unit-less listings", () => {
  const building = () => [
    cand("U1", "Unit 1, 70 Raglan Street, Mosman"),
    cand("U2", "Unit 2, 70 Raglan Street, Mosman"),
    cand("U3", "Unit 3, 70 Raglan Street, Mosman"),
  ];

  it("requires the listing's unit: picks unit 2 of a building, rejects an absent unit", async () => {
    const two = await matchOf(listing("Unit 2/70 Raglan Street", "Mosman", "NSW", "2088"), api(building));
    expect(two.match).toMatchObject({ kind: "exact", propertyId: "U2" });
    const nine = await matchOf(listing("9/70 Raglan Street", "Mosman", "NSW", "2088"), api(building));
    expect(nine.match).toMatchObject({ kind: "unresolved", reason: "no-match" });
  });

  it("a listing with no unit, where every candidate is a unit, means several units", async () => {
    const m = await matchOf(listing("70 Raglan Street", "Mosman", "NSW", "2088"), api(building));
    expect(m.match).toMatchObject({ kind: "unresolved", reason: "several-units" });
    if (m.match.kind !== "unresolved") throw new Error();
    expect(m.match.candidates.map((c) => c.id)).toEqual(["U1", "U2", "U3"]);
  });

  it("a listing with no unit prefers the whole-property candidate over its units", async () => {
    const withHouse = () => [cand("H", "70 Raglan Street, Mosman"), ...building()];
    const m = await matchOf(listing("70 Raglan Street", "Mosman", "NSW", "2088"), api(withHouse));
    expect(m.match).toMatchObject({ kind: "exact", propertyId: "H" });
  });

  it("compares state only when the candidate shows one", async () => {
    // Waterloo candidate shows (NSW); a VIC listing must not match it.
    const onlyWaterloo = api(() => [cand("W", "Unit 1, 70 Raglan Street, Waterloo (NSW)")]);
    const vic = await matchOf(listing("1/70 Raglan Street", "Waterloo", "VIC", "3000"), onlyWaterloo);
    expect(vic.match).toMatchObject({ kind: "unresolved", reason: "no-match" });
    // Mosman candidate shows no state; it still matches a NSW listing.
    const nsw = await matchOf(listing("1/70 Raglan Street", "Mosman", "NSW", "2088"));
    expect(nsw.match).toMatchObject({ kind: "exact", propertyId: "GANSW705422767" });
  });
});

describe("matching: ranges, Lot numbers, aliases and fuzzy street names", () => {
  const only = (name: string) => api(() => [cand("X", name)]);

  it("a listing range matches any candidate number inside it", async () => {
    const inside = await matchOf(listing("70-72 Raglan Street", "Mosman"), only("71 Raglan Street, Mosman"));
    expect(inside.match).toMatchObject({ kind: "exact", propertyId: "X" });
    const edge = await matchOf(listing("70-72 Raglan Street", "Mosman"), only("72 Raglan Street, Mosman"));
    expect(edge.match).toMatchObject({ kind: "exact", propertyId: "X" });
    const outside = await matchOf(listing("70-72 Raglan Street", "Mosman"), only("73 Raglan Street, Mosman"));
    expect(outside.match).toMatchObject({ kind: "unresolved", reason: "no-match" });
  });

  it("a range with a unit still requires the unit", async () => {
    const m = await matchOf(listing("3/70-72 Raglan Street", "Mosman"), only("Unit 3, 71 Raglan Street, Mosman"));
    expect(m.match).toMatchObject({ kind: "exact", propertyId: "X" });
    const wrong = await matchOf(listing("3/70-72 Raglan Street", "Mosman"), only("Unit 4, 71 Raglan Street, Mosman"));
    expect(wrong.match).toMatchObject({ kind: "unresolved", reason: "no-match" });
  });

  it("a candidate range contains the listing's number", async () => {
    const m = await matchOf(listing("71 Raglan Street", "Mosman"), only("70-72 Raglan Street, Mosman"));
    expect(m.match).toMatchObject({ kind: "exact", propertyId: "X" });
  });

  it("a number suffix must agree: 70A is not 70", async () => {
    const m = await matchOf(listing("70A Raglan Street", "Mosman"), only("70 Raglan Street, Mosman"));
    expect(m.match).toMatchObject({ kind: "unresolved", reason: "no-match" });
  });

  it("matches Lot numbers on the lot, not on a street number", async () => {
    // A matching Lot is found but never taken as exact: the buyer confirms it.
    const hit = await matchOf(listing("Lot 5 Raglan Street", "Mosman"), only("Lot 5 Raglan Street, Mosman"));
    expect(hit.match).toMatchObject({ kind: "unresolved", reason: "lot", candidates: [{ id: "X" }] });
    const miss = await matchOf(listing("Lot 5 Raglan Street", "Mosman"), only("Lot 6 Raglan Street, Mosman"));
    expect(miss.match).toMatchObject({ kind: "unresolved", reason: "no-match" });
    const numbered = await matchOf(listing("Lot 5 Raglan Street", "Mosman"), only("5 Raglan Street, Mosman"));
    expect(numbered.match).toMatchObject({ kind: "unresolved", reason: "no-match" });
  });

  it("treats Saint/St and Mount/Mt as the same in streets and suburbs", async () => {
    const street = await matchOf(listing("4 Saint Vincent Street", "Mosman"), only("4 St Vincent Street, Mosman"));
    expect(street.match).toMatchObject({ kind: "exact", propertyId: "X" });
    const suburb = await matchOf(listing("4 Smith Street", "Saint Kilda", "VIC"), only("4 Smith Street, St Kilda (VIC)"));
    expect(suburb.match).toMatchObject({ kind: "exact", propertyId: "X" });
    const mount = await matchOf(listing("4 Smith Street", "Mount Lawley", "WA"), only("4 Smith Street, Mt Lawley"));
    expect(mount.match).toMatchObject({ kind: "exact", propertyId: "X" });
  });

  it("tolerates a one-letter typo in the street name but not a different street type", async () => {
    const typo = await matchOf(listing("70 Raglen Street", "Mosman"), only("70 Raglan Street, Mosman"));
    expect(typo.match).toMatchObject({ kind: "exact", propertyId: "X" });
    const other = await matchOf(listing("70 Raglan Road", "Mosman"), only("70 Raglan Street, Mosman"));
    expect(other.match).toMatchObject({ kind: "unresolved", reason: "no-match" });
  });

  it("resolves the same number and street in two suburbs by suburb", async () => {
    const two = api(() => [cand("S", "70 Raglan Street, Mosman"), cand("T", "70 Raglan Street, Manly (NSW)")]);
    const m = await matchOf(listing("70 Raglan Street", "Manly", "NSW", "2095"), two);
    expect(m.match).toMatchObject({ kind: "exact", propertyId: "T" });
  });
});

describe("matching: query building and retries", () => {
  const raglan = () => listing("Unit 1/70 Raglan Street", "Mosman", "NSW", "2088");

  it("sends one cleaned, normalised query (not the raw string) and stops when it resolves", async () => {
    const a = api();
    await matchOf(raglan(), a);
    expect(a.queries).toEqual(["1/70 raglan street, mosman nsw 2088"]);
  });

  it("retries without the unit when nothing matched", async () => {
    const a = api((q) => (q.startsWith("1/70") ? [] : SAMPLE));
    const m = await matchOf(raglan(), a);
    expect(a.queries).toEqual(["1/70 raglan street, mosman nsw 2088", "70 raglan street, mosman nsw 2088"]);
    expect(m.match).toMatchObject({ kind: "exact", propertyId: "GANSW705422767" });
    expect(m.queries).toEqual(a.queries);
  });

  it("then retries without the suburb, and gives up after two variants", async () => {
    const a = api((q) => (q.startsWith("70") ? [cand("N", "70 Raglan Street, Manly (NSW)")] : []));
    const m = await matchOf(listing("Unit 1/70 Raglan Street", "Mosman", "NSW", "2088"), a);
    expect(a.queries).toEqual([
      "1/70 raglan street, mosman nsw 2088",
      "70 raglan street, mosman nsw 2088",
      "1/70 raglan street, nsw 2088",
    ]);
    // Third query returned nothing, so this ends unresolved rather than looping on.
    expect(m.match).toMatchObject({ kind: "unresolved", reason: "no-match" });
  });

  it("retries a range with its first number", async () => {
    const a = api((q) => (q.startsWith("70-72") || q.startsWith("72") ? [] : [cand("R", "70 Raglan Street, Mosman")]));
    const m = await matchOf(listing("70-72 Raglan Street", "Mosman", "NSW", "2088"), a);
    expect(a.queries[0]).toBe("70-72 raglan street, mosman nsw 2088");
    expect(a.queries).toContain("70 raglan street, mosman nsw 2088");
    expect(m.match).toMatchObject({ kind: "exact", propertyId: "R" });
  });

  it("retries when candidates came back but none passed", async () => {
    const a = api((q) => (q.startsWith("1/") ? [cand("N", "Unit 1, 80 Raglan Street, Mosman")] : SAMPLE));
    const m = await matchOf(raglan(), a);
    expect(a.queries).toHaveLength(2);
    expect(m.match).toMatchObject({ kind: "exact", propertyId: "GANSW705422767" });
  });

  it("does not retry when the result is merely ambiguous or needs a suburb confirm", async () => {
    const a = api();
    const m = await matchOf(listing("1/70 Raglan Street", "Chatswood", "NSW", "2067"), a);
    expect(a.queries).toHaveLength(1);
    expect(m.match).toMatchObject({ kind: "unresolved", reason: "ambiguous" });
  });

  it("falls back to the table postcode when the page gives none", async () => {
    const a = api();
    await matchOf(listing("Unit 1/70 Raglan Street", "Mosman", "NSW", ""), a);
    expect(a.queries[0]).toMatch(/^1\/70 raglan street, mosman nsw \d{4}$/);
  });

  it("surfaces a geocoder error without retrying", async () => {
    const calls: string[] = [];
    const failing = async (q: string): Promise<GeocodeCandidate[]> => {
      calls.push(q);
      throw new Error("HTTP 401");
    };
    await expect(findProperty(raglan(), failing)).rejects.toThrow("401");
    expect(calls).toHaveLength(1);
  });

  it("reports no match with no candidates only when every query returned nothing", async () => {
    const a = api(() => []);
    const m = await matchOf(raglan(), a);
    expect(m.match).toMatchObject({ kind: "unresolved", reason: "no-match", candidates: [] });
    expect(m.candidates).toEqual([]);
    expect(a.queries).toHaveLength(3);
  });
});

describe("matching: unit labels are case-insensitive and lower case in queries", () => {
  it.each([
    ["B20/1 Eildon Road", "Unit b20, 1 Eildon Road, St Kilda", "b20/1 eildon road, st kilda vic 3182"],
    ["Unit G01/1 Eildon Road", "Unit g01, 1 Eildon Road, St Kilda", "g01/1 eildon road, st kilda vic 3182"],
    ["1A/1 Eildon Road", "Unit 1a, 1 Eildon Road, St Kilda", "1a/1 eildon road, st kilda vic 3182"],
    ["5/1 Eildon Road", "Unit 5, 1 Eildon Road, St Kilda", "5/1 eildon road, st kilda vic 3182"],
  ])("%s matches candidate %s", async (street, display, query) => {
    const a = api(() => [cand("U1", display)]);
    const m = await matchOf(listing(street, "St Kilda", "VIC", "3182"), a);
    expect(a.queries[0]).toBe(query);
    expect(m.match).toMatchObject({ kind: "exact", propertyId: "U1" });
  });

  it("matches an upper-case candidate unit against the listing unit", async () => {
    const a = api(() => [cand("U1", "Unit B20, 1 Eildon Road, St Kilda")]);
    const m = await matchOf(listing("b20/1 Eildon Road", "St Kilda", "VIC", "3182"), a);
    expect(m.match).toMatchObject({ kind: "exact", propertyId: "U1" });
  });
});

describe("matching: typed addresses use the same pipeline", () => {
  it("matches an address the investor types", async () => {
    const m = await matchOf(parseAddress("Unit 1/70 Raglan Street, Mosman NSW 2088"));
    expect(m.match).toMatchObject({ kind: "exact", propertyId: "GANSW705422767" });
  });
});
