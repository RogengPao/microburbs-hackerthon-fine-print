// get_listing_brief — everything the first read needs, in ONE tool call.
//
//   hop 1: geocode the address → GNAF id + suburb
//   hop 2: every property + suburb endpoint IN PARALLEL (incl. rentals and DAs for
//          the suburbs within ~2 km, so the 1 km radius isn't cut at a boundary)
//   then:  the investor maths in code, not by the model (rent comps, yield, weekly
//          cost, supply pipeline) → one compact JSON brief.
//
// Microburbs is the source of truth for every number here. Cached per GNAF.

import { tool, ToolError } from '../runtime/index.js';
import { AllowlistHttpClient } from '../runtime/tools/http.js';
import { SOURCES } from './microburbs-tools.js';

// ---------------------------------------------------------------- geography
// Exact SAL names (verified against geocode/suburb, 7 Nov) + approx centroids.
// Newtown, Paddington, Annandale, St Peters return no data — out of coverage.
export const SUBURBS = {
  Alexandria: ['Alexandria', -33.9045, 151.1945],
  Barangaroo: ['Barangaroo', -33.8615, 151.2015],
  Beaconsfield: ['Beaconsfield (NSW)', -33.912, 151.201],
  Camperdown: ['Camperdown (NSW)', -33.889, 151.177],
  'Centennial Park': ['Centennial Park (NSW)', -33.897, 151.233],
  Chippendale: ['Chippendale', -33.887, 151.199],
  Darlinghurst: ['Darlinghurst', -33.878, 151.219],
  Darlington: ['Darlington (Sydney - NSW)', -33.891, 151.195],
  'Dawes Point': ['Dawes Point', -33.856, 151.207],
  'Elizabeth Bay': ['Elizabeth Bay', -33.872, 151.227],
  Erskineville: ['Erskineville', -33.902, 151.186],
  Eveleigh: ['Eveleigh', -33.896, 151.192],
  'Forest Lodge': ['Forest Lodge', -33.881, 151.18],
  Glebe: ['Glebe (NSW)', -33.879, 151.186],
  Haymarket: ['Haymarket', -33.88, 151.204],
  'Millers Point': ['Millers Point', -33.859, 151.204],
  'Moore Park': ['Moore Park', -33.896, 151.221],
  'Potts Point': ['Potts Point', -33.87, 151.225],
  Pyrmont: ['Pyrmont', -33.87, 151.194],
  Redfern: ['Redfern', -33.893, 151.205],
  Rosebery: ['Rosebery (NSW)', -33.918, 151.204],
  'Rushcutters Bay': ['Rushcutters Bay', -33.875, 151.229],
  'Surry Hills': ['Surry Hills', -33.885, 151.212],
  Sydney: ['Sydney', -33.868, 151.209],
  'The Rocks': ['The Rocks (Sydney - NSW)', -33.86, 151.208],
  Ultimo: ['Ultimo', -33.879, 151.197],
  Waterloo: ['Waterloo (NSW)', -33.9, 151.207],
  Woolloomooloo: ['Woolloomooloo', -33.87, 151.22],
  Zetland: ['Zetland', -33.907, 151.209],
};

const bySal = new Map(Object.values(SUBURBS).map(([sal, lat, lng]) => [sal, { sal, lat, lng }]));
const plain = (sal) => String(sal ?? '').replace(/\s*\(.*\)$/, '');

export function haversineKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Home suburb first, then suburbs whose centroid is within `km` of it (max `limit`). */
export function suburbsNear(sal, { km = 2.2, limit = 5 } = {}) {
  const home = bySal.get(sal) ?? bySal.get(SUBURBS[plain(sal)]?.[0]);
  if (!home) return [sal];
  const others = [...bySal.values()]
    .filter((s) => s.sal !== home.sal)
    .map((s) => ({ s, d: haversineKm(home, s) }))
    .filter((x) => x.d <= km)
    .sort((a, b) => a.d - b.d)
    .slice(0, limit - 1)
    .map((x) => x.s.sal);
  return [home.sal, ...others];
}

// ---------------------------------------------------------------- stats
export function quantile(values, q) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const i = (v.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return v[lo] + (v[hi] - v[lo]) * (i - lo);
}
const round = (n, to = 1) => (n == null || !Number.isFinite(n) ? null : Number((Math.round(n / to) * to).toFixed(6)));

// ---------------------------------------------------------------- address match
/** Pull unit + street number out of a typed/read address. */
export function addressParts(address) {
  const a = String(address ?? '').toUpperCase().replace(/\s+/g, ' ').trim();
  let m = a.match(/^(?:UNIT|APT|APARTMENT|LEVEL\s+\d+\s*,?\s*UNIT)?\s*([A-Z]?\d+[A-Z]?)\s*\/\s*(\d+[A-Z]?)/);
  if (m) return { unit: m[1], number: m[2] };
  m = a.match(/(?:UNIT|APT|APARTMENT)\s+([A-Z]?\d+[A-Z]?)\s*,?\s*(\d+[A-Z]?)\b/);
  if (m) return { unit: m[1], number: m[2] };
  m = a.match(/^(\d+[A-Z]?)\b/);
  return { unit: null, number: m?.[1] ?? null };
}

/** Choose the geocode candidate whose unit + number match exactly; else null. */
export function pickCandidate(candidates, address) {
  const want = addressParts(address);
  const scored = (candidates ?? []).map((c) => {
    const got = addressParts(c.abbr ?? c.display_name ?? c.name);
    const unitOk = want.unit ? got.unit === want.unit : !got.unit;
    const numOk = want.number ? got.number === want.number : true;
    return { c, ok: unitOk && numOk };
  });
  return scored.find((x) => x.ok)?.c ?? null;
}

// ---------------------------------------------------------------- supply
const DWELLING_RE =
  /(\d{1,4})\s+(?:x\s+)?(?:new\s+)?(?:build[- ]to[- ]rent\s+|btr\s+|affordable\s+|social\s+|residential\s+|student\s+|co-living\s+|boarding\s+)*(?:apartments?|dwellings?|residential\s+units?|units|homes|residences|boarding\s+rooms?|rooms?)\b/gi;

/** Largest dwelling count stated in a DA description (null if none). */
export function dwellingsFromDescription(desc) {
  let best = null;
  for (const m of String(desc ?? '').matchAll(DWELLING_RE)) {
    const n = Number(m[1]);
    if (n > 0 && n < 5000 && (best === null || n > best)) best = n;
  }
  return best;
}
const isBuildToRent = (desc) => /build[- ]to[- ]rent|\bbtr\b/i.test(String(desc ?? ''));

// ---------------------------------------------------------------- compute
/**
 * Pure: raw Microburbs responses → the brief. Exported for tests.
 * @param {Object} raw  { match, avm, quoting, history, risks, basics, sales, nearby, market, strata, vacancy, rentals[], das[] }
 * @param {Object} o    { investor: {budget, deposit, minYield}, rate, ratesInsuranceWeekly, radiusKm }
 */
export function computeBrief(raw, { investor = {}, rate = 0.06, ratesInsuranceWeekly = 45, radiusKm = 1 } = {}) {
  const here = raw.nearby?.center_lat != null ? { lat: raw.nearby.center_lat, lng: raw.nearby.center_lng } : null;
  const beds = raw.basics?.bed_count ?? null;
  const within = (lat, lng) => (here && lat != null && lng != null ? haversineKm(here, { lat, lng }) : null);

  // --- rent: same-bed units within the radius, deduped across suburbs
  const seen = new Set();
  const comps = [];
  for (const r of (raw.rentals ?? []).flat()) {
    const id = r.gnaf_pid ?? r.area_name;
    if (seen.has(id)) continue;
    seen.add(id);
    if (!/unit|apartment|studio/i.test(`${r.property_type} ${r.property_type_raw}`)) continue;
    if (beds != null && r.attributes?.bedrooms !== beds) continue;
    const d = within(r.coordinates?.latitude, r.coordinates?.longitude);
    if (d === null || d > radiusKm || !(r.price > 0)) continue;
    comps.push({ price: r.price, km: d });
  }
  const rentPrices = comps.map((c) => c.price);
  const lastRent = raw.history?.rent_history_latest ?? null;
  const rent = {
    weekly: round(quantile(rentPrices, 0.5), 5),
    low: round(quantile(rentPrices, 0.25), 5),
    high: round(quantile(rentPrices, 0.75), 5),
    comparables: comps.length,
    basis: `${beds ?? '?'}-bed units advertised for rent within ${radiusKm} km`,
    this_property_last: lastRent ? { weekly: lastRent.price, date: lastRent.date } : null,
    suburb_median_unit: raw.market?.median_rent?.unit ?? null,
  };

  // --- price points
  const latest = raw.history?.sale_history_latest;
  const asking = raw.quoting?.asking_price ?? (latest?.type === 'For Sale' ? latest.price : null);
  const likely = raw.quoting?.likely_sale_price ?? null;
  const value = raw.avm?.predicted_price != null
    ? { estimate: raw.avm.predicted_price, low: raw.avm.predicted_price_low, high: raw.avm.predicted_price_high, confidence: raw.avm.confidence_score, as_of: raw.avm.prediction_date }
    : null;
  const basisPrice = likely ?? asking ?? value?.estimate ?? null;

  const yieldAt = (p) => (p && rent.weekly ? round(((rent.weekly * 52) / p) * 100, 0.01) : null);
  const strataWeekly = raw.strata?.median_levy_annual ? round(raw.strata.median_levy_annual / 52, 1) : null;
  const deposit = investor.deposit ?? null;
  const loan = basisPrice && deposit != null ? Math.max(0, basisPrice - deposit) : null;
  const interestWeekly = loan != null ? round((loan * rate) / 52, 1) : null;
  const weeklyCost =
    interestWeekly != null && rent.weekly != null ? round(interestWeekly + (strataWeekly ?? 0) + ratesInsuranceWeekly - rent.weekly, 1) : null;

  // --- supply pipeline within the radius
  const daSeen = new Set();
  const pipeline = [];
  for (const d of (raw.das ?? []).flat()) {
    const key = `${d.area_name}|${d.date}`;
    if (daSeen.has(key)) continue;
    daSeen.add(key);
    const km = within(d.lat, d.lng);
    if (km === null || km > radiusKm) continue;
    const dwellings = dwellingsFromDescription(d.description);
    if (!dwellings) continue;
    pipeline.push({ address: d.area_name, km: round(km, 0.01), date: d.date, dwellings, build_to_rent: isBuildToRent(d.description), lat: d.lat, lng: d.lng });
  }
  pipeline.sort((a, b) => b.dwellings - a.dwellings);

  // --- competition for buyers: same-bed for sale within 1 km
  const forSale = (raw.nearby?.listings ?? []).filter((l) => beds == null || l.bedrooms === beds);

  // --- recent same-bed sales nearby (12 months)
  const yearAgo = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const sales = (raw.sales ?? []).filter((s) => (beds == null || s.bedrooms === beds) && s.date_sold >= yearAgo && s.price > 0);

  // --- risks: on-property or very close only
  const risks = [];
  for (const [name, rows] of Object.entries(raw.risks ?? {})) {
    for (const r of rows ?? []) {
      if (r.on_property) risks.push({ name, detail: r.value, on_property: true });
      else if (name === 'hv_power_line' && r.nearest_distance_m != null && r.nearest_distance_m <= 50) risks.push({ name, detail: r.value, on_property: false });
      else if (name === 'flood' && r.nearest_distance_m != null && r.nearest_distance_m <= 100) risks.push({ name, detail: r.value, on_property: false });
    }
  }
  const vac = raw.vacancy?.unit;
  const vacancyNow = Array.isArray(vac) && vac.length ? vac[vac.length - 1] : null;

  return {
    property: {
      gnaf_id: raw.match.id,
      address: raw.match.display_name,
      suburb: raw.match.sal,
      type: raw.basics?.dwelling_type ?? raw.match.property_type,
      beds,
      baths: raw.basics?.bath_count ?? null,
      parking: raw.basics?.parking_count ?? null,
    },
    price: {
      asking,
      likely_sale: likely,
      agency: raw.quoting ? { name: raw.quoting.agency_name, cohort: raw.quoting.cohort, underquote_rate_pct: raw.quoting.underquote_rate_pct, median_over_quote_pct: raw.quoting.median_deviation_pct, sales: raw.quoting.total_sales } : null,
      value,
      last_sold: (raw.history?.sale_history ?? []).find((s) => s.type === 'Sold') ?? null,
    },
    rent,
    returns: {
      price_basis: basisPrice,
      price_basis_is: likely ? 'likely_sale' : asking ? 'asking' : value ? 'estimated_value' : null,
      gross_yield_pct_at_asking: yieldAt(asking),
      gross_yield_pct_at_likely: yieldAt(likely),
      meets_min_yield: investor.minYield != null && yieldAt(basisPrice) != null ? yieldAt(basisPrice) >= investor.minYield : null,
      within_budget: investor.budget != null && basisPrice ? basisPrice <= investor.budget : null,
    },
    weekly_cost: {
      net_before_tax: weeklyCost,
      interest: interestWeekly,
      strata: strataWeekly,
      rates_insurance: ratesInsuranceWeekly,
      rent: rent.weekly,
      assumptions: `interest-only at ${(rate * 100).toFixed(1)}% on price minus $${deposit?.toLocaleString('en-AU') ?? '?'} deposit; strata = suburb median levy`,
    },
    supply: {
      radius_km: radiusKm,
      new_dwellings_stated: pipeline.reduce((s, p) => s + p.dwellings, 0),
      applications: pipeline.length,
      build_to_rent_dwellings: pipeline.filter((p) => p.build_to_rent).reduce((s, p) => s + p.dwellings, 0),
      largest: pipeline.slice(0, 5),
      competing_rentals_same_beds: comps.length,
      caveat: 'DA stage unknown; older applications may be built or lapsed',
    },
    competition: {
      for_sale_same_beds_1km: forSale.length,
      median_asking_same_beds: round(quantile(forSale.map((l) => l.price), 0.5), 1000),
    },
    recent_sales: {
      same_beds_12m: sales.length,
      median_price: round(quantile(sales.map((s) => s.price), 0.5), 1000),
      closest: sales.slice(0, 3).map((s) => ({ address: s.address, price: s.price, date: s.date_sold, km: s.dist_km })),
    },
    market: raw.market
      ? {
          suburb_median_unit_price: raw.market.median_sale_price?.unit ?? null,
          suburb_unit_yield_pct: raw.market.yield_pct?.unit != null ? round(raw.market.yield_pct.unit * 100, 0.01) : null,
          unit_growth_5y_pct: raw.market.price_growth_5y?.unit != null ? round(raw.market.price_growth_5y.unit * 100, 0.1) : null,
          unit_days_on_market: raw.market.days_on_market?.unit ?? null,
          unit_vacancy_pct: vacancyNow ? round(vacancyNow.value * 100, 0.01) : null,
        }
      : null,
    risks,
  };
}

// ---------------------------------------------------------------- fetch + tool
const CACHE_TTL_MS = 6 * 3600 * 1000;

async function cacheGet(key) {
  try {
    const hit = (await chrome.storage.local.get(key))[key];
    return hit && Date.now() - hit.at < CACHE_TTL_MS ? hit.brief : null;
  } catch {
    return null;
  }
}
async function cacheSet(key, brief) {
  try {
    await chrome.storage.local.set({ [key]: { at: Date.now(), brief } });
  } catch {
    /* cache is best-effort */
  }
}

/**
 * Fetch + compute a brief for an address. Throws a ToolError-shaped err on no match.
 * @param {Object} o  { address, source, secretProvider, investor, fetch?, onProgress? }
 */
export async function fetchListingBrief({ address, source = 'proxy', secretProvider, investor, fetch: fetchImpl, onProgress = () => {} }) {
  const s = SOURCES[source];
  const http = new AllowlistHttpClient([s.host], { timeoutS: 20, fetch: fetchImpl, credentials: s.auth ? 'omit' : 'include' });
  const headers = s.auth ? { Authorization: `Bearer ${await secretProvider.get('microburbs')}` } : {};
  const get = async (path, params) => {
    const res = await http.get(`${s.base}${path}`, { params, headers });
    if (res.status === 404) return null;
    if (res.status >= 400) throw new Error(`${path} → HTTP ${res.status}`);
    return JSON.parse(res.text)?.data ?? null;
  };
  const soft = (p) => p.catch(() => null); // one endpoint failing must not sink the brief

  const t0 = Date.now();
  const candidates = (await get('/geocode/address', { address })) ?? [];
  const match = pickCandidate(candidates, address);
  if (!match) {
    throw new ToolError(`no exact match for "${address}"`, {
      hint: `closest candidates: ${candidates.slice(0, 3).map((c) => c.display_name).join('; ') || 'none'} — ask the investor to confirm the address`,
      error_code: 'no_match',
    });
  }
  onProgress({ stage: 'matched', address: match.display_name, gnaf_id: match.id });

  const cacheKey = `brief:${match.id}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, meta: { ...cached.meta, cached: true } };

  const g = match.id;
  const subs = suburbsNear(match.sal);
  const enc = encodeURIComponent;
  const [avm, quoting, history, risks, basics, sales, nearby, market, strata, vacancy, rentals, das] = await Promise.all([
    soft(get(`/properties/${g}/valuation/avm`)),
    soft(get(`/properties/${g}/valuation/agent-quoting`)),
    soft(get(`/properties/${g}/history/all`)),
    soft(get(`/properties/${g}/risks/all`)),
    soft(get(`/properties/${g}/basics/all`)),
    soft(get(`/properties/${g}/comparables/recent-sales-nearby`)),
    soft(get(`/properties/${g}/context/nearby-for-sale`)),
    soft(get(`/suburbs/${enc(match.sal)}/market/all`)),
    soft(get(`/suburbs/${enc(match.sal)}/market/strata-levies`)),
    soft(get(`/suburbs/${enc(match.sal)}/market/vacancy-rate-series`)),
    Promise.all(subs.map((sub) => soft(get(`/suburbs/${enc(sub)}/listings/for-rent`, { limit: '200' })).then((d) => d?.results ?? []))),
    Promise.all(subs.map((sub) => soft(get(`/suburbs/${enc(sub)}/development/da-list`)).then((d) => d ?? []))),
  ]);

  const brief = computeBrief({ match, avm, quoting, history, risks, basics, sales, nearby, market, strata, vacancy, rentals, das }, { investor });
  brief.meta = { suburbs_searched: subs, fetched_ms: Date.now() - t0, fetched_at: new Date().toISOString(), source: 'Microburbs API' };
  await cacheSet(cacheKey, brief);
  return brief;
}

/** The tool the agent calls. */
export function listingBriefTool({ source, secretProvider, investor, onProgress, memory = null, listing = null }) {
  return tool({
    name: 'get_listing_brief',
    description:
      'ONE call that returns everything for the first read of a listing: matched GNAF address, asking/likely sale/estimated value, agency quoting record, rent estimate from nearby same-bed rentals, gross yield, weekly cost before tax, new dwellings in development applications within 1 km, competing listings, recent nearby sales, suburb market and hazards. All figures are computed from Microburbs data. Use this first; use the individual tools only to dig deeper.',
    input_schema: {
      type: 'object',
      properties: { address: { type: 'string', description: 'Full address including unit number, e.g. "Unit 38, 3 Victoria Park Parade, Zetland NSW 2017"' } },
      required: ['address'],
    },
    execute: async ({ address }) => {
      const brief = await fetchListingBrief({ address, source, secretProvider, investor, onProgress });
      // Remember every analysed property (with where we saw it) for later recall.
      const seenOn = listing ? { url: listing.url ?? null, image: listing.page?.image ?? null, title: listing.page?.heading ?? listing.title ?? null } : {};
      await memory?.save(brief, seenOn).catch((e) => console.warn('[fine-print] could not save property', e));
      return JSON.stringify(brief);
    },
  });
}
