import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBrief, dwellingsFromDescription, haversineKm, quantile, suburbsNear } from '../src/agent/listing-brief.js';

// Shapes + values from the live demo proxy for Unit 38, 3 Victoria Park Pde, Zetland (7 Nov).
const HERE = { lat: -33.90521711, lng: 151.21082342 };
const near = (dLat) => ({ latitude: HERE.lat + dLat, longitude: HERE.lng }); // 0.001° lat ≈ 111 m
const rental = (id, price, beds, dLat) => ({
  gnaf_pid: id, area_name: id, attributes: { bedrooms: beds }, coordinates: near(dLat), price, property_type: 'Unit', property_type_raw: 'apartment',
});

const RAW = {
  match: { id: 'GANSW710358627', sal: 'Zetland', display_name: 'UNIT 38/3 Victoria Park Parade, Zetland', property_type: 'unit' },
  avm: { predicted_price: 712500, predicted_price_low: 555750, predicted_price_high: 869250, prediction_date: '2026-07-27', confidence_score: 82 },
  quoting: { agency_name: 'Stone Real Estate - Newtown', cohort: 'Severe Underquoter', median_deviation_pct: 10, underquote_rate_pct: 70.6, total_sales: 17, asking_price: 775000, likely_sale_price: 852500 },
  history: {
    sale_history: [{ date: '2026-10-28', price: 775000, type: 'For Sale' }, { date: '2022-10-21', price: 660000, type: 'Sold' }],
    sale_history_latest: { date: '2026-10-28', price: 775000, type: 'For Sale' },
    rent_history_latest: { date: '2026-02-02', price: 780, type: 'For Rent' },
  },
  risks: {
    flood: [{ value: 'Not on property; nearest 384 m away', on_property: false, nearest_distance_m: 384 }],
    hv_power_line: [{ value: 'Not on property; nearest 23 m away', on_property: false, nearest_distance_m: 23 }],
    heritage: [{ value: 'Not on property; nearest 132 m away', on_property: false, nearest_distance_m: 132 }],
  },
  basics: { bed_count: 1, bath_count: 1, parking_count: 0, dwelling_type: 'apartment / unit / flat' },
  sales: [],
  nearby: { center_lat: HERE.lat, center_lng: HERE.lng, listings: [{ bedrooms: 1, price: 730000 }, { bedrooms: 1, price: 790000 }, { bedrooms: 2, price: 1200000 }] },
  market: { median_rent: { unit: 1000 }, median_sale_price: { unit: 998000 }, yield_pct: { unit: 0.0521 }, price_growth_5y: { unit: 0.0837 }, days_on_market: { unit: 44 } },
  strata: { median_levy_annual: 5820.4 },
  vacancy: { unit: [{ date: '2026-09-27', value: 0.011 }, { date: '2026-10-25', value: 0.0152 }] },
  rentals: [
    [rental('a', 700, 1, 0.001), rental('b', 750, 1, 0.003), rental('c', 800, 1, 0.005), rental('d', 850, 1, 0.008), rental('far', 400, 1, 0.02), rental('2bed', 1200, 2, 0.001)],
    [rental('a', 700, 1, 0.001)], // same listing seen again from a neighbouring suburb
  ],
  das: [[
    { area_name: '960A Bourke Street, Zetland NSW', description: 'Site establishment, construction of 504 build-to-rent residential apartments', date: '2026-10-17', lat: -33.9050768, lng: 151.2039236 },
    { area_name: '1 Far St', description: 'Construction of 300 apartments', date: '2026-01-01', lat: HERE.lat + 0.03, lng: HERE.lng },
    { area_name: '2 Near St', description: 'Alterations to a terrace', date: '2026-02-01', lat: HERE.lat + 0.001, lng: HERE.lng },
  ]],
};
const INVESTOR = { budget: 800000, deposit: 160000, minYield: 4 };

test('rent comps: same beds, within 1 km, deduped; median + quartiles', () => {
  const b = computeBrief(RAW, { investor: INVESTOR });
  assert.equal(b.rent.comparables, 4); // far (2.2 km), 2-bed and the duplicate are excluded
  assert.equal(b.rent.weekly, 775);
  assert.equal(b.rent.low, 740);
  assert.equal(b.rent.high, 815);
  assert.deepEqual(b.rent.this_property_last, { weekly: 780, date: '2026-02-02' });
});

test('price points, yield and weekly cost', () => {
  const b = computeBrief(RAW, { investor: INVESTOR });
  assert.equal(b.price.asking, 775000);
  assert.equal(b.price.likely_sale, 852500);
  assert.equal(b.returns.price_basis_is, 'likely_sale');
  assert.equal(b.returns.gross_yield_pct_at_asking, 5.2); // 775 × 52 / 775k
  assert.equal(b.returns.gross_yield_pct_at_likely, 4.73);
  assert.equal(b.returns.within_budget, false);
  // whole dollars: (852.5k − 160k) × 6% / 52 = 799; strata 5820.4/52 = 112; 799.04 + 111.93 + 45 − 775 = 181
  assert.equal(b.weekly_cost.interest, 799);
  assert.equal(b.weekly_cost.strata, 112);
  assert.equal(b.weekly_cost.net_before_tax, 181);
});

test('asking falls back to an active For Sale history row', () => {
  const raw = { ...RAW, quoting: null };
  assert.equal(computeBrief(raw, { investor: INVESTOR }).price.asking, 775000);
  const sold = { ...raw, history: { ...RAW.history, sale_history_latest: { price: 660000, type: 'Sold' } } };
  assert.equal(computeBrief(sold, { investor: INVESTOR }).price.asking, null);
});

test('supply: only stated dwellings within 1 km; build-to-rent flagged', () => {
  const b = computeBrief(RAW, { investor: INVESTOR });
  assert.equal(b.supply.applications, 1);
  assert.equal(b.supply.new_dwellings_stated, 504);
  assert.equal(b.supply.build_to_rent_dwellings, 504);
  assert.ok(b.supply.largest[0].km > 0.6 && b.supply.largest[0].km < 0.7); // ~640 m
});

test('competition, market, risks', () => {
  const b = computeBrief(RAW, { investor: INVESTOR });
  assert.equal(b.competition.for_sale_same_beds_1km, 2);
  assert.equal(b.market.suburb_unit_yield_pct, 5.21);
  assert.equal(b.market.unit_vacancy_pct, 1.52);
  assert.deepEqual(b.risks.map((r) => r.name), ['hv_power_line']); // 23 m; flood 384 m and heritage are not flagged
});

test('dwelling counts from DA descriptions', () => {
  assert.equal(dwellingsFromDescription('Construction of 504 build-to-rent residential apartments'), 504);
  assert.equal(dwellingsFromDescription('A 12 storey building with 111 apartments and 3 retail tenancies'), 111);
  assert.equal(dwellingsFromDescription('Mixed use: 376 residential units and 2 commercial units'), 376);
  assert.equal(dwellingsFromDescription('Alterations and additions to a terrace'), null);
});

test('helpers', () => {
  assert.equal(quantile([4, 1, 3, 2], 0.5), 2.5);
  assert.equal(quantile([], 0.5), null);
  assert.ok(Math.abs(haversineKm({ lat: -33.9, lng: 151.2 }, { lat: -33.909, lng: 151.2 }) - 1.0) < 0.01);
  const subs = suburbsNear('Zetland');
  assert.equal(subs[0], 'Zetland');
  assert.ok(subs.includes('Waterloo (NSW)') && subs.includes('Beaconsfield (NSW)') && subs.includes('Rosebery (NSW)'));
});
