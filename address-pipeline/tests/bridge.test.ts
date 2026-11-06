import { describe, expect, it } from "vitest";
import { addressFromPage, findProperty, formatAddress, matchAddress, matchCandidate, parseAddress } from "../src/bridge";
import { realListings } from "./fixtures/real-listings";

const cand = (id: string, display_name: string) => ({ id, display_name, property_type: "" });

// Real geocode candidates for "Unit 38, 3 Victoria Park Parade, Zetland" (7 Nov).
const CANDS = [
  cand("GANSW710358627", "UNIT 38/3 Victoria Park Parade, Zetland"),
  cand("GANSW710506372", "UNIT 3/8 Victoria Road, Glebe (NSW)"),
  cand("GANSW706607112", "UNIT 38/3 Crick Avenue, Elizabeth Bay"),
  cand("GANSW717920043", "UNIT 38/3 Earl Place, Potts Point"),
];

describe("bridge: free text", () => {
  it("parses the formats the extension meets", () => {
    expect(parseAddress("Unit 38, 3 Victoria Park Parade, Zetland NSW 2017")).toEqual({
      unit: "38", number: "3", street: "VICTORIA PARK PARADE", suburb: "ZETLAND", state: "NSW", postcode: "2017",
    });
    expect(parseAddress("506/8 Fuse Street, Zetland NSW 2017").unit).toBe("506");
    expect(parseAddress("UNIT 38/3 Victoria Park Parade, Zetland").street).toBe("VICTORIA PARK PARADE");
    expect(parseAddress("Level 2, 5/12 Smith St, Sydney NSW 2000").unit).toBe("5");
    expect(parseAddress("8-12 Sam Sing Street, Waterloo")).toMatchObject({ number: "8-12", lowConfidence: true });
    expect(parseAddress("8 Sam Sing Street, Waterloo")).toMatchObject({ unit: null, suburb: "WATERLOO" });
  });

  it("parses Lots into a lot number, not street text", () => {
    expect(parseAddress("Lot, 5511 Nautical Cct, Tarneit, Vic 3029")).toMatchObject({
      lot: "5511", number: null, street: "NAUTICAL CCT", suburb: "TARNEIT", state: "VIC", lowConfidence: true,
    });
    expect(parseAddress("Lot 916 34 Meerkat Road, Tarneit VIC 3029")).toMatchObject({ lot: "916", street: "34 MEERKAT ROAD" });
  });

  it("formats parts back to one line", () => {
    expect(formatAddress({ unit: "105", number: "8", street: "Sam Sing Street", suburb: "Waterloo", state: "NSW", postcode: "2017" }))
      .toBe("105/8 Sam Sing Street, Waterloo NSW 2017");
    expect(formatAddress(parseAddress("Lot 430 Dawbin Road, Tarneit VIC 3029"))).toBe("Lot 430 DAWBIN ROAD, TARNEIT VIC 3029");
  });

  it("sends normalised geocode queries and retries looser ones", async () => {
    const queries: string[] = [];
    await findProperty(parseAddress("38/3 Victoria Park Pde, Zetland NSW 2017"), async (q) => (queries.push(q), []));
    expect(queries).toEqual([
      "38/3 victoria park parade, zetland nsw 2017",
      "3 victoria park parade, zetland nsw 2017",
      "38/3 victoria park parade, nsw 2017",
    ]);
  });
});

describe("bridge: strict match", () => {
  it("unit, number, street and suburb must agree", () => {
    const want = parseAddress("Unit 38, 3 Victoria Park Parade, Zetland NSW 2017");
    expect(matchCandidate(CANDS, want)?.candidate.id).toBe("GANSW710358627");
    expect(matchCandidate(CANDS.slice(1), want)).toBeNull();
    expect(matchCandidate(CANDS, parseAddress("Unit 39, 3 Victoria Park Parade, Zetland"))).toBeNull();
    expect(matchCandidate(CANDS, parseAddress("38/3 Victoria Park Parade, Waterloo"))).toBeNull();
    expect(matchCandidate(CANDS, parseAddress("38/3 Victoria Park Pde, Zetland"))?.candidate.id).toBe("GANSW710358627");
  });

  it("a unit-less listing never takes the only unit returned", () => {
    expect(matchAddress(CANDS, parseAddress("3 Victoria Park Parade, Zetland"))).toMatchObject({ kind: "unresolved", reason: "several-units" });
  });

  it("says why when it will not pick", () => {
    expect(matchAddress(CANDS, parseAddress("38/3 Victoria Park Parade, Waterloo"))).toMatchObject({ reason: "suburb-mismatch" });
    expect(matchAddress([], parseAddress("1 Nowhere St, Zetland"))).toMatchObject({ reason: "no-match" });
  });

  it("ranges match on overlap", () => {
    const c = [cand("R", "UNIT 322/17 Memorial Avenue, St Ives")];
    expect(matchCandidate(c, parseAddress("322/17-19 Memorial Avenue, St Ives NSW 2075"))?.candidate.id).toBe("R");
    expect(matchCandidate([cand("R2", "UNIT 322/17-19 Memorial Avenue, St Ives")], parseAddress("322/18 Memorial Avenue, St Ives NSW 2075"))?.candidate.id).toBe("R2");
    expect(matchCandidate(c, parseAddress("322/18-19 Memorial Avenue, St Ives NSW 2075"))).toBeNull();
  });

  it("a Lot is never exact, even with one perfect candidate", () => {
    const c = [cand("L", "Lot 430 Dawbin Road, Tarneit (VIC)")];
    const want = parseAddress("Lot 430 Dawbin Road, Tarneit VIC 3029");
    expect(matchCandidate(c, want)).toBeNull();
    expect(matchAddress(c, want)).toMatchObject({ kind: "unresolved", reason: "lot" });
  });
});

describe("bridge: addressFromPage", () => {
  it("page data beats the heading; heading is the fallback", () => {
    const fromData = addressFromPage({
      heading: "ignored",
      listing: { portal: "domain", unit: "506", number: "8", street: "Fuse Street", suburb: "Zetland", state: "NSW", postcode: "2017", lat: -33.91, lng: 151.21 },
    })!;
    expect(fromData).toMatchObject({ source: "domain page data", lat: -33.91 });
    expect(fromData.parts.unit).toBe("506");
    const fromHeading = addressFromPage({ listing: null, heading: "20/8 Grandstand Parade, Zetland, NSW 2017" })!;
    expect(fromHeading.source).toBe("page heading");
    expect(fromHeading.parts.street).toBe("GRANDSTAND PARADE");
    expect(addressFromPage({ listing: null, heading: "Apartments for sale in Zetland" })).toBeNull();
  });

  it("reads a Lot from page data's full address when the parts are empty", () => {
    const a = addressFromPage({
      heading: null,
      listing: { portal: "rea", unit: null, number: null, street: null, suburb: "Tarneit", state: "VIC", postcode: "3029", full: "Lot, 5511 Nautical Cct, Tarneit, Vic 3029" },
    })!;
    expect(a).toMatchObject({ source: "rea page data", parts: { lot: "5511", street: "NAUTICAL CCT" } });
  });

  describe("every real listing heading", () => {
    for (const l of realListings) {
      it(`${l.site} ${l.kind}: ${l.h1}`, () => {
        const a = addressFromPage({ listing: null, heading: l.h1, og: { title: l.ogTitle } });
        if (!l.residence) {
          expect(a).toBeNull(); // hidden address: never invent a street
          return;
        }
        expect(a).not.toBeNull();
        const want = parseAddress(`${l.residence.street}, ${l.residence.suburb} ${l.residence.region} ${l.residence.postcode}`);
        expect(a!.parts).toEqual(want);
        expect(a!.parts.number ?? a!.parts.lot).toBeTruthy();
      });
    }
  });
});
