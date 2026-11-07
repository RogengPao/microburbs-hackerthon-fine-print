import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePriceText } from '../src/agent/price-text.js';

test('portal price text → low/high/mid', () => {
  assert.deepEqual(parsePriceText('For Sale | $850,000 - $950,000'), { low: 850000, high: 950000, mid: 900000, text: 'For Sale | $850,000 - $950,000' });
  assert.equal(parsePriceText('$850,000 - $880,000.').mid, 865000);
  assert.equal(parsePriceText('For Sale price guide $740,000 -790,000').mid, 765000);
  assert.equal(parsePriceText('Guide $1.2M').mid, 1200000);
  assert.equal(parsePriceText('$700K to $750K').mid, 725000);
  assert.equal(parsePriceText('Buyers Guide $1,250,000').mid, 1250000);
  assert.equal(parsePriceText('Contact Agent'), null);
  assert.equal(parsePriceText('Inspections from $299*'), null);
  assert.equal(parsePriceText(null), null);
});
