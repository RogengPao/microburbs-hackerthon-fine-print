import { describe, expect, it } from "vitest";
import { parseAddress } from "../src/address";
import { buildQueries } from "../src/matcher";

interface Opts {
  suburb?: string;
  state?: string;
  postcode?: string;
}

/** Street line + place -> parsed fields and the primary geocode query. */
function read(street: string, o: Opts = {}) {
  const parsed = parseAddress({ street, suburb: o.suburb ?? "Bondi", state: o.state ?? "NSW", postcode: o.postcode ?? "2026" });
  return { parsed, normalised: buildQueries(parsed)[0] };
}

describe("unit formats parse to unit / street number / street", () => {
  const cases: [string, string | undefined, string, string][] = [
    ["1/70 Smith Street", "1", "70", "smith street"],
    ["Unit 1/70 Smith Street", "1", "70", "smith street"],
    ["Unit 1, 70 Smith Street", "1", "70", "smith street"],
    ["U1/70 Smith Street", "1", "70", "smith street"],
    ["Apt 1, 70 Smith Street", "1", "70", "smith street"],
    ["Apt 1/70 Smith Street", "1", "70", "smith street"],
    ["G01/70 Smith Street", "g01", "70", "smith street"],
    ["1A/70 Smith Street", "1a", "70", "smith street"],
    ["Level 3, 1/70 Smith Street", "1", "70", "smith street"],
    ["Level 3, Unit 1, 70 Smith Street", "1", "70", "smith street"],
    ["70 Smith Street", undefined, "70", "smith street"],
    ["70A Smith Street", undefined, "70A", "smith street"],
  ];
  for (const [input, unit, number, street] of cases) {
    it(`parses "${input}"`, () => {
      const p = read(input).parsed!;
      expect(p.unit).toBe(unit);
      expect(p.streetNumber).toBe(number);
      expect(p.street).toBe(street);
      expect(p.lowConfidence).toBe(false);
    });
  }

  it("keeps the raw string and the other fields", () => {
    expect(read("Unit 1/70 Smith St").parsed).toMatchObject({
      raw: "Unit 1/70 Smith St",
      suburb: "bondi",
      state: "NSW",
      postcode: "2026",
    });
  });
});

describe("ranges and Lot numbers are lower confidence, never throw", () => {
  it("parses a range using its first number", () => {
    const p = read("70-72 Smith Street").parsed!;
    expect(p).toMatchObject({ streetNumber: "70", streetNumberEnd: "72", street: "smith street", lowConfidence: true });
  });

  it("parses a unit with a range", () => {
    const p = read("2/70-72 Smith Street").parsed!;
    expect(p).toMatchObject({ unit: "2", streetNumber: "70", streetNumberEnd: "72", lowConfidence: true });
  });

  it("parses a Lot number", () => {
    const p = read("Lot 12 Smith Street").parsed!;
    expect(p).toMatchObject({ lot: "12", street: "smith street", lowConfidence: true });
    expect(p.streetNumber).toBeUndefined();
  });

  it("does not crash on odd input", () => {
    for (const s of ["12", "Lot", "-", "Unit /", "1/ ", "Lot 4, 9-11 A/B St"]) {
      expect(() => read(s)).not.toThrow();
    }
  });
});

describe("normalisation", () => {
  const cases: [string, string][] = [
    ["70 Smith St", "70 smith street"],
    ["70 Smith Street", "70 smith street"],
    ["5 Park Rd", "5 park road"],
    ["5 Marine Pde", "5 marine parade"],
    ["5 Ocean Cres", "5 ocean crescent"],
    ["5 Ocean Ave", "5 ocean avenue"],
    ["5 Saint Georges Rd", "5 st georges road"],
    ["5 St Georges Road", "5 st georges road"],
    ["5 Mount Pleasant Rd", "5 mt pleasant road"],
    ["5 Mt Pleasant Road", "5 mt pleasant road"],
  ];
  for (const [input, expected] of cases) {
    it(`"${input}" -> "${expected}"`, () => {
      const p = read(input).parsed!;
      expect(`${p.streetNumber} ${p.street}`).toBe(expected);
    });
  }

  it("does not treat the St in 'St Kilda Rd' as a street type", () => {
    expect(read("5 St Kilda Rd").parsed!.street).toBe("st kilda road");
  });

  it("normalises suburb Saint/St and Mount/Mt", () => {
    expect(read("5 Beach Rd", { suburb: "Saint Kilda", state: "VIC", postcode: "3182" }).parsed!.suburb).toBe("st kilda");
    expect(read("5 Beach Rd", { suburb: "Mount Waverley", state: "VIC", postcode: "3149" }).parsed!.suburb).toBe("mt waverley");
  });

  it("gives one query form for different spellings of the same address", () => {
    const a = read("Unit 1, 70 Smith St").normalised;
    const b = read("1/70 Smith Street").normalised;
    const c = read("U1/70 Smith Street").normalised;
    expect(a).toBe("1/70 smith street, bondi nsw 2026");
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it("omits the unit for a plain address", () => {
    expect(read("70 Smith St").normalised).toBe("70 smith street, bondi nsw 2026");
  });
});

describe("postcode sourcing", () => {
  const noPostcode = { postcode: "" };

  it("uses the given postcode first", () => {
    expect(read("5 Park Rd", { suburb: "Collaroy", postcode: "2097" }).parsed).toMatchObject({ postcode: "2097", postcodeSource: "page" });
  });

  it("falls back to the bundled suburb+state table", () => {
    const vm = read("15 Sadka Lane", { ...noPostcode, suburb: "Shenton Park", state: "WA" });
    expect(vm.parsed).toMatchObject({ postcode: "6008", postcodeSource: "table" });
    expect(vm.normalised).toContain("wa 6008");
  });

  it("resolves Saint/Mount suburbs and '(NSW)'-style names from the table", () => {
    expect(read("5 Beach Rd", { ...noPostcode, suburb: "Saint Kilda", state: "VIC" }).parsed.postcode).toBe("3182");
    expect(read("5 Beach Rd", { ...noPostcode, suburb: "Mount Waverley", state: "VIC" }).parsed.postcode).toBe("3149");
  });

  it("leaves the postcode empty when nothing knows it", () => {
    const vm = read("5 Beach Rd", { ...noPostcode, suburb: "Nowhereville" });
    expect(vm.parsed.postcode).toBe("");
    expect(vm.parsed.postcodeSource).toBeUndefined();
  });
});
