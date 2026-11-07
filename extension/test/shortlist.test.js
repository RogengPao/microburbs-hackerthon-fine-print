import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestOf, listingKey, shortlistRows, sortRows } from '../src/agent/shortlist.js';

const REA = 'https://www.realestate.com.au/property-apartment-nsw-zetland-152280756';
const DOM = 'https://www.domain.com.au/506-8-fuse-street-zetland-nsw-2017-2020922356';
const shortlist = {
  [REA]: { url: REA, heading: '2307/15 Gadigal Avenue', added_at: 2 },
  [DOM]: { url: DOM, heading: '506/8 Fuse Street', added_at: 1 },
  'https://www.realestate.com.au/property-unit-nsw-sydney-1': { url: 'https://www.realestate.com.au/property-unit-nsw-sydney-1', heading: 'Not analysed yet', added_at: 3 },
};
const records = [
  { gnaf_id: 'A', address: '2307/15 GADIGAL AVENUE, ZETLAND', url: `${REA}?rsf=x`, urls: [`${REA}?rsf=x`], likely_sale: 852500, yield_at_likely: 4.73, weekly_cost: 181, new_dwellings_1km: 504, build_to_rent_1km: 504, risks: ['hv_power_line'] },
  { gnaf_id: 'B', address: '506/8 FUSE STREET, ZETLAND', url: `${DOM}/`, urls: [`${DOM}/`], asking: 760000, yield_at_asking: 5.1, weekly_cost: 90, new_dwellings_1km: 111, build_to_rent_1km: 0, risks: [] },
];
const investor = { budget: 800000, minYield: 4 };

test('listing keys ignore query, hash and trailing slash', () => {
  assert.equal(listingKey(`${REA}?rsf=x#top`), REA);
  assert.equal(listingKey(`${DOM}/`), DOM);
});

test('shortlist joins to saved briefs by listing URL', () => {
  const rows = shortlistRows(shortlist, records, investor);
  const a = rows.find((r) => r.url === REA);
  assert.equal(a.gnaf_id, 'A');
  assert.equal(a.price, 852500);
  assert.equal(a.within_budget, false);
  assert.equal(a.meets_yield, true);
  const b = rows.find((r) => r.url === DOM);
  assert.equal(b.price, 760000);
  assert.equal(b.within_budget, true);
  const c = rows.find((r) => r.address === 'Not analysed yet');
  assert.equal(c.analysed, false);
});

test('sorting and best-of highlights', () => {
  const rows = shortlistRows(shortlist, records, investor);
  assert.deepEqual(sortRows(rows, 'fit').map((r) => r.gnaf_id), ['B', 'A', null]);
  assert.deepEqual(sortRows(rows, 'weekly_cost').map((r) => r.gnaf_id).slice(0, 2), ['B', 'A']);
  assert.deepEqual(bestOf(rows), { price: 760000, yield_pct: 5.1, weekly_cost: 90, new_homes_1km: 111 });
});
