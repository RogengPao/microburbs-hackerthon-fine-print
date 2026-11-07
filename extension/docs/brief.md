# Listing brief — data contract (backend → frontend)

The panel loads this **as soon as it opens on a listing**, with no LLM involved:
page address → strict GNAF match → every Microburbs endpoint in parallel → computed brief.
Widgets render from it; "Read this listing" sends it to the agent as context.

**Sample:** [`sample-brief.json`](sample-brief.json) — real Unit 38 figures from the test fixtures, so use it as placeholder data.

## How to get it in the panel

```js
// fired once per listing load, success or failure
window.addEventListener('fineprint:brief', (e) => {
  const res = e.detail;           // { ok: true, brief, address } | { ok: false, reason, message, hint?, address? }
});
window.finePrint?.result;         // the latest result, if you mount after the event
```

Or call it yourself: `import { loadBrief } from '../agent/agent.js'` → `await loadBrief({ listing, onProgress })`.
`onProgress` stages: `address` (parsed, before matching) → `matched` (`{ address, gnaf_id }`).

Failure `reason`s: `no_address` (couldn't read one off the page) · `no_match` (geocode had no exact unit+number+street+suburb match — `hint` lists the closest candidates; ask the user to confirm) · `error`.

## Shape

Money is whole dollars, percentages are already ×100 (4.73 means 4.73%), weekly figures are $/wk. Any figure can be `null`, so render "n/a".

| Path | What | Widget idea |
|---|---|---|
| `property.{gnaf_id, address, suburb, type, beds, baths, parking}` | the **matched** home; show `address` so judges can check it | header |
| `price.asking` | asking price (agency quoting, or the active For Sale record) | readout |
| `price.likely_sale` | Microburbs' likely sale price given the agency's history | readout, highlight |
| `price.agency.{name, cohort, underquote_rate_pct, median_over_quote_pct, sales}` | agency quoting record, e.g. "Severe Underquoter", 70.6% of sales over quote | warning chip |
| `price.value.{estimate, low, high, confidence, as_of}` | AVM, often missing for apartments | range bar |
| `price.last_sold.{date, price}` | last sale | history line |
| `rent.{weekly, low, high, comparables, basis}` | our rent estimate: median (p25–p75) of same-bed units advertised within 1 km | readout + range |
| `rent.this_property_last.{weekly, date}` | this property's own last advertised rent | small print |
| `rent.suburb_median_unit` | suburb unit median rent | comparison bar |
| `returns.gross_yield_pct_at_asking` / `_at_likely` | gross yield | gauge vs `investor.minYield` |
| `returns.{within_budget, meets_min_yield}` | booleans vs the investor brief | ✓ / ✗ |
| `weekly_cost.{net_before_tax, interest, strata, rates_insurance, rent, assumptions}` | holding cost per week; positive = out of pocket | stacked bar |
| `supply.{new_dwellings_stated, applications, build_to_rent_dwellings, competing_rentals_same_beds, caveat}` | the pipeline within 1 km | headline number |
| `supply.largest[].{address, km, date, dwellings, build_to_rent, lat, lng}` | top 5 DAs | list / map pins |
| `competition.{for_sale_same_beds_1km, median_asking_same_beds}` | competing listings | chip |
| `recent_sales.{same_beds_12m, median_price, closest[]}` | comparable sales | list |
| `market.{suburb_median_unit_price, suburb_unit_yield_pct, unit_growth_5y_pct, unit_days_on_market, unit_vacancy_pct}` | suburb context | comparison bars |
| `risks[].{name, detail, on_property}` | hazards on or very close (flood, power lines…) | warning list |
| `listing.{url, image, portal, listing_id, address_source}` | where we saw it | thumbnail |
| `meta.{suburbs_searched, fetched_ms, fetched_at, cached, source}` | provenance | footer "Microburbs · 1.2 s" |

## Rules

- **Microburbs is the source of truth** for every number shown. Page data is only used to read the address.
- Show `property.address` (the matched GNAF address) prominently. Judges check it.
- The brief is cached per property for 6 h, and every brief is saved to property memory (IndexedDB `fine-print` → `properties`).

## Agent activity (tool labels)

Every tool has a people-facing **`label`** (e.g. "Checking rentals nearby"), separate from the model-facing `description`. Show the label, never the function name.

- Live: `onEvent` gets `{ event: 'tool_start', name, label, call_id, args }` when a tool starts and `{ event: 'tool', name, label, call_id, error, deferred }` when it finishes.
- Stored transcripts only keep tool names, so map them with `import { TOOL_LABELS } from '../agent/agent.js'` (`TOOL_LABELS[name] ?? name`).
- Adding a tool: set `label` on `tool({...})`, or `label` in a declarative manifest / `LABELS` in `microburbs-tools.js`.
