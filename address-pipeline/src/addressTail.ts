import type { ParsedAddress } from "./types";

export const STATES = "WA|NSW|VIC|QLD|SA|TAS|ACT|NT";

/**
 * Splits "<street line>, <suburb>[,] STATE [postcode]" into its parts. `streetPattern` is the
 * regex source for the street line (default: anything). Returns null when the tail does not fit.
 */
export function splitAddressTail(text: string, streetPattern = ".+"): ParsedAddress | null {
  const re = new RegExp(`^(${streetPattern}),\\s*([^,]+?),?\\s+(${STATES})(?:\\s+(\\d{4}))?$`, "i");
  const m = re.exec(text);
  if (!m) return null;
  return { street: m[1].trim(), suburb: m[2].trim(), state: m[3].toUpperCase(), postcode: m[4] ?? "" };
}
