import { describe, expect, it } from "vitest";
import { findProperty, parseAddress } from "../src/bridge";

/**
 * Candidate display_name parsing, through the extension's seam (address + stubbed geocode -> outcome).
 * "known" = style seen in the Microburbs brief sample. "assumed" = plausible style, NOT confirmed.
 */
async function outcome(street: string, suburb: string, names: string[], state = "NSW") {
  const cands = names.map((n, i) => ({ id: `C${i}`, display_name: n, property_type: "unit" }));
  return (await findProperty(parseAddress(`${street}, ${suburb} ${state}`), async () => cands)).match;
}
const exactId = (m: Awaited<ReturnType<typeof outcome>>) => (m.kind === "exact" ? m.propertyId : m.kind + ":" + m.reason);

describe("candidate names: state and case", () => {
  it("known: bracketed state and no state both parse", async () => {
    expect(exactId(await outcome("1/70 Raglan Street", "Mosman", ["Unit 1, 70 Raglan Street, Mosman"]))).toBe("C0");
    expect(exactId(await outcome("1/70 Raglan Street", "Waterloo", ["Unit 1, 70 Raglan Street, Waterloo (NSW)"]))).toBe("C0");
  });
  it("known: same unit and street resolves by suburb when only some candidates show a state", async () => {
    const names = ["Unit 1, 70 Raglan Street, Waterloo (NSW)", "Unit 1, 70 Raglan Street, Mosman", "Unit 1, 70 Raglan Street, Manly (NSW)"];
    expect(exactId(await outcome("1/70 Raglan Street", "Mosman", names))).toBe("C1");
    expect(exactId(await outcome("1/70 Raglan Street", "Manly", names))).toBe("C2");
  });
  it("assumed: upper case and lower case names", async () => {
    expect(exactId(await outcome("1/70 Raglan Street", "Mosman", ["UNIT 1, 70 RAGLAN STREET, MOSMAN (NSW)"]))).toBe("C0");
    expect(exactId(await outcome("1/70 Raglan Street", "Mosman", ["unit 1, 70 raglan street, mosman (nsw)"]))).toBe("C0");
  });
  it("assumed: extra spaces, including inside the brackets", async () => {
    expect(exactId(await outcome("1/70 Raglan Street", "Mosman", ["  Unit  1 ,  70   Raglan  Street ,  Mosman  ( NSW ) "]))).toBe("C0");
  });
  it("assumed: state without brackets, and a state mismatch rejects", async () => {
    expect(exactId(await outcome("1/70 Raglan Street", "Mosman", ["Unit 1, 70 Raglan Street, Mosman NSW"]))).toBe("C0");
    expect(exactId(await outcome("1/70 Raglan Street", "Mosman", ["Unit 1, 70 Raglan Street, Mosman (VIC)"]))).not.toBe("C0");
  });
  it("assumed: state and postcode after the suburb", async () => {
    expect(exactId(await outcome("1/70 Raglan Street", "Mosman", ["Unit 1, 70 Raglan Street, Mosman NSW 2088"]))).toBe("C0");
  });
});

describe("candidate names: unit forms (all assumed)", () => {
  const forms = ["Unit 1, 70 Raglan Street, Mosman", "Apartment 1, 70 Raglan Street, Mosman", "Shop 1, 70 Raglan Street, Mosman", "1/70 Raglan Street, Mosman", "Unit 1/70 Raglan Street, Mosman", "1, 70 Raglan Street, Mosman"];
  for (const name of forms) {
    it(`assumed: "${name}"`, async () => {
      expect(exactId(await outcome("1/70 Raglan Street", "Mosman", [name]))).toBe("C0");
    });
  }
  it("assumed: a different unit number is not an exact match", async () => {
    expect(exactId(await outcome("1/70 Raglan Street", "Mosman", ["Unit 2, 70 Raglan Street, Mosman"]))).not.toBe("C0");
  });
});

describe("candidate names: letter-prefixed units, ranges, lots, houses (all assumed)", () => {
  for (const [unit, listed] of [["B20", "B20/70"], ["G01", "G01/70"], ["1A", "1A/70"]] as const) {
    it(`assumed: unit ${unit} in "Unit ${unit}, 70 ..." and "${unit}/70 ..." styles`, async () => {
      expect(exactId(await outcome(`${listed} Raglan Street`, "Mosman", [`Unit ${unit}, 70 Raglan Street, Mosman`]))).toBe("C0");
      expect(exactId(await outcome(`${listed} Raglan Street`, "Mosman", [`${unit}/70 Raglan Street, Mosman`]))).toBe("C0");
    });
  }
  it("assumed: street-number range candidate matches a single number inside it", async () => {
    expect(exactId(await outcome("71 Raglan Street", "Mosman", ["70-72 Raglan Street, Mosman"]))).toBe("C0");
    expect(exactId(await outcome("74 Raglan Street", "Mosman", ["70-72 Raglan Street, Mosman"]))).not.toBe("C0");
  });
  it("assumed: unit plus range candidate", async () => {
    expect(exactId(await outcome("3/70-72 Raglan Street", "Mosman", ["Unit 3, 70-72 Raglan Street, Mosman"]))).toBe("C0");
  });
  it("assumed: Lot-style candidates", async () => {
    // parses and agrees, but a Lot is never taken as exact
    expect(exactId(await outcome("Lot 430 Raglan Street", "Mosman", ["Lot 430 Raglan Street, Mosman"]))).toBe("unresolved:lot");
    expect(exactId(await outcome("Lot 430 Raglan Street", "Mosman", ["Lot 431 Raglan Street, Mosman"]))).not.toBe("C0");
    expect(exactId(await outcome("70 Raglan Street", "Mosman", ["Lot 70 Raglan Street, Mosman"]))).not.toBe("C0");
  });
  it("assumed: house candidate with no unit", async () => {
    expect(exactId(await outcome("70 Raglan Street", "Mosman", ["70 Raglan Street, Mosman (NSW)"]))).toBe("C0");
  });
  it("assumed: house listing picks the whole property over its units", async () => {
    const m = await outcome("70 Raglan Street", "Mosman", ["Unit 1, 70 Raglan Street, Mosman", "70 Raglan Street, Mosman"]);
    expect(exactId(m)).toBe("C1");
  });
});

describe("candidate names: multi-word suburbs (assumed)", () => {
  it("assumed: St Kilda matches Saint Kilda and St Kilda", async () => {
    expect(exactId(await outcome("5 Fitzroy Street", "St Kilda", ["5 Fitzroy Street, St Kilda (VIC)"], "VIC"))).toBe("C0");
    expect(exactId(await outcome("5 Fitzroy Street", "Saint Kilda", ["5 Fitzroy Street, St Kilda (VIC)"], "VIC"))).toBe("C0");
  });
  it("assumed: Mount Waverley matches Mt Waverley and Mount Waverley", async () => {
    expect(exactId(await outcome("9 High Street", "Mount Waverley", ["9 High Street, Mount Waverley (VIC)"], "VIC"))).toBe("C0");
    expect(exactId(await outcome("9 High Street", "Mount Waverley", ["9 High Street, Mt Waverley"], "VIC"))).toBe("C0");
  });
  it("assumed: St Kilda unit with state, among other suburbs", async () => {
    const names = ["Unit 4, 5 Fitzroy Street, St Kilda (VIC)", "Unit 4, 5 Fitzroy Street, St Kilda East", "Unit 4, 5 Fitzroy Street, Carlton"];
    expect(exactId(await outcome("4/5 Fitzroy Street", "St Kilda", names, "VIC"))).toBe("C0");
  });
});

describe("candidate names: unparseable candidates never give Exact", () => {
  for (const name of ["", "Raglan Street, Mosman", "Mosman", "70", "Unit, Mosman", ",,,", "Some Landmark Name"]) {
    it(`assumed: "${name}"`, async () => {
      const m = await outcome("1/70 Raglan Street", "Mosman", [name]);
      expect(m.kind).toBe("unresolved");
    });
  }
});
