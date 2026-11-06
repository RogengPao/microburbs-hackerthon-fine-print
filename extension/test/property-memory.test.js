import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryPropertyBackend, PropertyMemory, propertyMemoryTools, search, toRecord } from '../src/agent/property-memory.js';
import { ToolRegistry } from '../src/runtime/index.js';

const brief = (gnaf_id, address, suburb, { beds = 1, likely = 800000, yieldL = 4.5, cost = 150 } = {}) => ({
  property: { gnaf_id, address, suburb, beds, type: 'unit' },
  price: { asking: likely - 50000, likely_sale: likely, value: { estimate: likely - 20000 } },
  rent: { weekly: 700 },
  returns: { gross_yield_pct_at_likely: yieldL, within_budget: likely <= 800000 },
  weekly_cost: { net_before_tax: cost },
  supply: { new_dwellings_stated: 504, build_to_rent_dwellings: 504 },
  risks: [{ name: 'hv_power_line' }],
});

const Z = brief('GANSW710358627', 'UNIT 38/3 Victoria Park Parade, Zetland', 'Zetland', { likely: 852500, yieldL: 4.73, cost: 181 });
const W = brief('GANSW705022222', 'UNIT 105/8 Sam Sing Street, Waterloo', 'Waterloo (NSW)', { beds: 2, likely: 760000, yieldL: 5.1, cost: 90 });
const R = brief('GANSW700000003', 'UNIT 2/10 Rothschild Avenue, Rosebery', 'Rosebery (NSW)', { likely: 690000, yieldL: 3.6, cost: 40 });

test('a record keeps the link, image and key numbers; re-analysis merges', () => {
  const first = toRecord(Z, { url: 'https://rea/1', image: 'https://img/1.jpg', title: 'Unit 38' }, null, '2026-11-07T01:00:00Z');
  assert.equal(first.url, 'https://rea/1');
  assert.equal(first.image, 'https://img/1.jpg');
  assert.equal(first.likely_sale, 852500);
  assert.equal(first.weekly_cost, 181);
  assert.deepEqual(first.risks, ['hv_power_line']);
  assert.equal(first.times_analysed, 1);

  const again = toRecord(Z, { url: 'https://domain/1' }, first, '2026-11-07T02:00:00Z');
  assert.equal(again.times_analysed, 2);
  assert.equal(again.first_analysed_at, '2026-11-07T01:00:00Z');
  assert.equal(again.image, 'https://img/1.jpg'); // kept when the new page has none
  assert.deepEqual(again.urls, ['https://rea/1', 'https://domain/1']);
});

test('search filters and sorts', () => {
  const rows = [Z, W, R].map((b, i) => toRecord(b, {}, null, `2026-11-07T0${i}:00:00Z`));
  assert.deepEqual(search(rows, { sort_by: 'yield' }).map((r) => r.suburb), ['Waterloo (NSW)', 'Zetland', 'Rosebery (NSW)']);
  assert.deepEqual(search(rows, { sort_by: 'weekly_cost' }).map((r) => r.suburb), ['Rosebery (NSW)', 'Waterloo (NSW)', 'Zetland']);
  assert.deepEqual(search(rows).map((r) => r.suburb), ['Rosebery (NSW)', 'Waterloo (NSW)', 'Zetland']); // most recent first
  assert.deepEqual(search(rows, { query: 'victoria park' }).map((r) => r.gnaf_id), ['GANSW710358627']);
  assert.deepEqual(search(rows, { max_price: 800000, min_yield: 4 }).map((r) => r.gnaf_id), ['GANSW705022222']);
  assert.equal(search(rows, { beds: 2 }).length, 1);
});

test('agent tools: recall compact rows, fetch the full brief, typed miss', async () => {
  const memory = new PropertyMemory(new MemoryPropertyBackend());
  await memory.save(Z, { url: 'https://rea/1', image: 'https://img/1.jpg' });
  await memory.save(W, { url: 'https://domain/2' });
  const reg = new ToolRegistry(propertyMemoryTools(memory));

  const recall = await reg.execute({ id: '1', name: 'recall_properties', args: { sort_by: 'yield' } });
  const body = JSON.parse(recall.result);
  assert.equal(body.count, 2);
  assert.equal(body.properties[0].suburb, 'Waterloo (NSW)');
  assert.equal(body.properties[0].brief, undefined); // compact: no full brief
  assert.equal(body.properties[1].image, 'https://img/1.jpg');

  const full = JSON.parse((await reg.execute({ id: '2', name: 'get_saved_property', args: { ref: 'Victoria Park Parade' } })).result);
  assert.equal(full.gnaf_id, 'GANSW710358627');
  assert.equal(full.brief.supply.new_dwellings_stated, 504);
  assert.equal(JSON.parse((await reg.execute({ id: '3', name: 'get_saved_property', args: { ref: 'gansw705022222' } })).result).suburb, 'Waterloo (NSW)');

  const miss = await reg.execute({ id: '4', name: 'get_saved_property', args: { ref: 'Nowhere Street' } });
  assert.equal(miss.error, true);
  assert.equal(JSON.parse(miss.result).error_code, 'not_found');
});
