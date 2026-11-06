import { splitAddressTail } from "./addressTail";
import type { ParsedAddress } from "./types";

// "34 Cumberland Avenue, Collaroy NSW 2097" or "15 Sadka Lane, Shenton Park, WA 6008"
// realestate.com.au Lots use a comma: "Lot, 5511 Nautical Cct, Tarneit, Vic 3029".
const HEADING_STREET = "(?:lot,\\s*)?[^,]*\\d[^,]*";

/** Parses a heading or og:title into an address. Requires a street number; never guesses. */
export function parseHeadingAddress(text: string | null | undefined): ParsedAddress | null {
  if (!text) return null;
  const cleaned = text.replace(/\s*\|\s*Domain\s*$/i, "").replace(/\s+/g, " ").trim();
  return splitAddressTail(cleaned, HEADING_STREET);
}
