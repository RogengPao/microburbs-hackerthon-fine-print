// The price the PORTAL shows ("For Sale | $850,000 - $950,000", "$1.2M", "Contact Agent")
// → { low, high, mid } — a fallback for listings Microburbs has no quote for. Always
// labelled as the listing's own figure in the brief.

const AMOUNT = /\$\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|m|mil(?:lion)?)?\b/gi;

export function parsePriceText(text) {
  const t = String(text ?? '');
  const nums = [];
  for (const m of t.matchAll(AMOUNT)) {
    let n = Number(m[1].replace(/,/g, ''));
    const unit = (m[2] ?? '').toLowerCase();
    if (unit === 'k') n *= 1e3;
    else if (unit.startsWith('m')) n *= 1e6;
    if (n >= 50_000 && n <= 50_000_000) nums.push(n); // ignore "$299 building report" etc.
  }
  // "$850,000 - 950,000": the second number sometimes has no "$"
  if (nums.length === 1) {
    const tail = t.slice(t.indexOf('$')).match(/[-–]\s*(\d{1,3}(?:,\d{3})+)/);
    if (tail) {
      const n = Number(tail[1].replace(/,/g, ''));
      if (n > nums[0] && n <= nums[0] * 2) nums.push(n);
    }
  }
  if (!nums.length) return null;
  const low = Math.min(...nums.slice(0, 2));
  const high = Math.max(...nums.slice(0, 2));
  return { low, high, mid: Math.round((low + high) / 2), text: t.trim().slice(0, 80) };
}
