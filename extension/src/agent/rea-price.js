// realestate.com.au hides a price bracket in its ad targeting (googletag slot key
// `price`, e.g. "014s") — present even when the listing says "Contact Agent".
//
// Decoded 2026-11-06 from 33 Sydney sale listings with visible prices. Ranged
// prices bucket by their MIDPOINT ($700k–$750k → 010s, $950k–$1.04M → 014s).
// Codes skip numbers (IDs on a fixed list); unseen codes decode to null.
// Edges marked ~ are inferred from a single side, not pinned by samples.

export const REA_PRICE_BRACKETS = {
  '005s': { min: 350_000, max: 450_000, approx: true }, // seen ~$400k
  '006s': { min: 450_000, max: 500_000, approx: true }, // seen $480k
  '008s': { min: 500_000, max: 600_000 }, // $520k–$575k → 008, $600k → 010
  '010s': { min: 600_000, max: 750_000 }, // $600k–$725k (mid)
  '014s': { min: 750_000, max: 1_000_000 }, // $765k–$995k (mid)
  '017s': { min: 1_000_000, max: 1_500_000 }, // $1.0M–$1.45M
  '018s': { min: 1_500_000, max: 2_000_000 }, // $1.5M–$1.95M
  '020s': { min: 2_000_000, max: 2_500_000 }, // $2.0M–$2.45M
  '021s': { min: 2_500_000, max: 3_000_000, approx: true }, // $2.5M–$2.9M seen
  '024s': { min: 3_500_000, max: 4_000_000, approx: true }, // $3.5M–$3.88M seen
};

/** "014s" → { code, min, max, approx } or null when unknown. */
export function decodeReaPrice(code) {
  const b = REA_PRICE_BRACKETS[String(code ?? '').trim().toLowerCase()];
  return b ? { code, ...b, approx: Boolean(b.approx) } : null;
}

const k = (n) => (n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 2 : 1).replace(/\.?0+$/, '')}M` : `$${n / 1000}k`);

/** Human label for prompts/UI: "$750k–$1M". */
export function bracketLabel(b) {
  return b ? `${b.approx ? '~' : ''}${k(b.min)}–${k(b.max)}` : null;
}
