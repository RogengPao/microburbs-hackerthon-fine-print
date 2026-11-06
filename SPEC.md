# Fine Print — Microburbs Hackathon spec

7 Nov 2026 build day · Jake + Carlos · Task 3 (Chrome extension) · City of Sydney only
Designs: [Paper file](https://app.paper.design/file/01M6QMF6C4XBF7VKEADCK9CXFA) — page **v3 — Instrument on paper** is current (paper ground, ink text, blue = good / this property, yellow = warning; Instrument Serif readouts, Geist UI, Geist Mono provenance). Tokens: `--v3-*`.
Status 6 Nov: spec + designs done, API explored. **No code until build day.**

## The pitch

A buyer's agent that rides along on realestate.com.au. It opens on the listing, tells an investor in one line whether the property fits their brief, and talks through anything they ask, with Microburbs data behind every answer.

Opening line (real data, demo listing below): **"Looks like $775K. Expect to pay $852K."**

## Business case for Microburbs

Microburbs is running this hackathon, so the win is a product that makes them money, not just a nice tool.

**The problem for Microburbs.** Their model is pull: investors have to come to microburbs.com.au (subscriptions ~$45–177/mo, single reports $39–49, a paid API). But investors spend their time on realestate.com.au and Domain. Microburbs is absent at the moment that matters, when someone is looking at a specific listing with money ready.

**What the extension changes.** It puts Microburbs on every listing an investor opens, unprompted, with a reason to care ("expect to pay $852K"). Every listing view becomes a Microburbs touchpoint.

**Why only Microburbs can do this.** The portals earn from selling agents, and realestate.com.au owns PropTrack, so they won't put "this agent underquotes by 10%" or "1,140 competing apartments" on a listing. Microburbs is independent. Its edge is saying what the listing won't, which is the whole product.

### Revenue lines

| # | Line | How it works | Uses what Microburbs already has |
|---|---|---|---|
| 1 | **Subscription funnel** | Free: verdict, three numbers, flags, a few questions a month. Upgrade for unlimited chat, all components, the tracker and change alerts. | Existing Essential / Advanced tiers |
| 2 | **Reports at the point of decision** | "Investment memo" = a paid property report, generated for this listing and this brief, one click. | $39 property report |
| 3 | **Referrals (highest-intent leads in Australian property)** | We know the budget, deposit, target yield and the exact listing. Opt-in hand-offs to: mortgage brokers (pre-approval), buyer's agents ("want someone to negotiate this?" from the offer ladder), property managers (from the rent estimate), conveyancers, insurers. | Existing broker and buyer's agent relationships (testimonials) |
| 4 | **White-label for professionals** | Buyer's agents and brokers give it to clients under their own brand, "Powered by Microburbs". Per-seat licence. | API + MCP |
| 5 | **Investor behaviour data** | See below. Sold as data, published as research, fed back into the models. | Data business, models, podcasts and press |

### Investor behaviour: the asset nobody else has

Portals see clicks. Microburbs would see **intent**: who the investor is (budget, deposit, target yield, hold), which listing they're judging, what worries them, and what they decide.

**What the extension captures** (opt-in, aggregated, never sold per person):

| Signal | What it tells the market |
|---|---|
| Briefs: budget, deposit, target yield, hold | What investors want, and the gap to what's on offer |
| Listing views and time on panel, by block | Where investor attention is moving, before prices do |
| Shortlists vs walk-aways | Which listings and blocks investors reject, and why |
| Questions asked in chat | Top worries by suburb (supply, rent, price, flood) |
| "What would you offer" vs final sale price | Investor price expectations vs outcomes, plus underquoting exposure |
| Tracker outcomes | What shortlisted listings sold for and how fast |

**Three ways it pays:**
1. **Thought leadership.** A monthly **Investor Pulse**: an investor demand index by microburb, the yield gap, investors' top fears and where they're walking away. Microburbs becomes *the* independent voice on investor behaviour, the way CoreLogic and PropTrack own price indices. That feeds the podcasts, press and whitepapers they already do, which drives subscriptions. Example headline (illustrative): *"Investors walked away from 6 in 10 Zetland listings this month. New supply was the number one question."*
2. **Paid data.** A demand index via API and datasets for developers (where to build, what mix), lenders (investor appetite), agencies and researchers.
3. **Better models.** Attention is a leading indicator. Behaviour data sharpens the AVM, agent-quoting and forecasts, which improves every product Microburbs sells.

**Guardrails:** explicit opt-in at setup; aggregated to block or suburb with minimum counts before anything is shown; no individual data sold; compliant with the Privacy Act. In the hackathon build everything stays in the browser. We show what *would* be collected and one mock Investor Pulse slide.

**Illustrative maths (assumptions, not forecasts):** 10,000 active installs × 5% upgrading at $45/mo ≈ **$270K/yr**, before reports, referrals or data. Each referral line is upside on top. We'll present this as a model with its assumptions shown, not a promise.

**Risks we'll name:** reading listing pages in the browser must respect portal terms (we only read the page the user is viewing, nothing is crawled); valuations cover ~1 in 4 apartments today; answers are general information, not financial advice (same line Microburbs already uses).

**Pitch close (last 8 s):** "For Microburbs, it puts your data on every listing an investor opens, at the moment they're deciding. That moment becomes subscriptions, reports and referrals, and the first real picture of what Australian investors actually do."

## User

Property investor buying an inner-Sydney apartment to rent out. Demo persona: "$800K budget, 20% deposit, at least 4% gross, holding ten years."

## Screens (see Paper)

| Screen | What it does |
|---|---|
| A · Setup in the sidebar | First run, on the listing itself. Plain fields: budget and deposit (typed), minimum yield (slider), hold (segmented). No free-text brief, no risk appetite. |
| B · Panel (one screen, no scroll) | Verdict line · three tiles (it earns / it costs you per week / it's worth) · 3–4 one-line flags ("what the listing doesn't say") · suggested questions · ask box · Shortlist / Memo / Tracker. |
| C · Chat | Each answer = 1–2 sentences + at most one component card. |
| D · Chat components | Cards the agent shows on request, one tool each (below). |
| Tracker (v1 page) | Shortlist grid, recently viewed, listing changes. Nice to have. |

### Chat components (agent tools)

| Tool | Shown when asked | Data |
|---|---|---|
| `show_yield_comparison` | "Will it earn enough?" | Our rent estimate, suburb unit yield, target |
| `show_future_supply` | "Will the rent hold up?" | DA-extracted dwelling counts, competing rentals now, vacancy trend |
| `show_weekly_cash_flow` | "What will it cost me?" | Rent, loan interest (from brief), strata levies, negative gearing |
| `show_estimated_value` | "What's it worth?" / "What's an AVM?" | AVM + range + confidence, plain-English explainer |
| `show_area_comparison` | "How does it compare?" | Green/red diverging bars vs suburb average |
| `show_offer_ladder` | "What should I offer?" | Agent quoting (likely sale price), recent sales nearby, AVM |
| `show_hold_outcome` | "Worth it over ten years?" | Forecast + rent + costs (illustrative) |
| `show_property_profile` | "Tell me about the property" | Basics, sale history (Carlos's profile) |
| `show_overlays_and_planning` | "Any flood/heritage/zoning issues?" | `risks/all`, noise, busy roads, zoning, schools, transport |

## The clever step (revised after API check)

Count the new homes in the pipeline within walking distance and set them against today's competition for tenants. Confirmed working 6 Nov after the organisers' DA update.

1. **Pipeline within walking distance.** `development/da-list` now returns `area_name` (street address), `lat`, `lng`. Filter DAs within 1 km of the listing (query the listing's suburb and its neighbours), then have the LLM extract the dwelling count from each description. Demo listing: **67 DAs within 1 km, 991 dwellings stated**, including **504 build-to-rent at 960A Bourke St, 640 m away** (SSD-83899206, 17 Oct 2026), 376 at 903–921 Bourke St (2022, may be built) and 111 at 338 Botany Rd. Build-to-rent competes directly for tenants. These are real map pins.
2. **Competing rentals today.** Count same-bedroom apartments for rent within 1 km (`listings/for-rent`). Demo: 103 one-bed apartments.
3. **Direction.** Supply index by block, unit vacancy trend, building controls (height = latent capacity), satellite construction activity.

**Caveats to say out loud:** no DA stage or budget yet (organisers say "coming soon"), so older DAs may already be built or lapsed. Treat dates as a guide and lean on the newest. Dwelling counts exist only where the description states them. Reference type is in the description: `D/…` development application, `CDC/…` complying development certificate, `SSD-…` state significant development (major projects).

**`development/supply` (organisers' definition):** new addresses within 500 m of each block's centre over the last 24 months. Circles overlap, so it's an **index for comparing blocks, not a count**, and the suburb total double-counts buildings. Use it only as "this block has more recent new supply than X% of blocks", never as a number of dwellings.

## Rent estimate (our own)

No per-apartment rent estimate exists, and `rent-map` / `yield-map` are **houses only** (15 of 29 suburbs). Method: median weekly price of same-bedroom unit rental listings within 1 km (tested: 62–103 matches), with p25–p75 as the range. Gross yield = rent × 52 / price.

## Demo listing

**Unit 38, 3 Victoria Park Parade, Zetland** (`GANSW710358627`), 1 bed, listed 28 Oct 2026.
- Asking $775K · AVM $713K (confidence 82) · last sold $660K (2022)
- Agency: "Severe Underquoter" — 70.6% of sales over quote, median +10% → likely $852.5K
- 103 one-bed rentals within 1 km, median $850/wk → ~5.7% gross at asking, ~5.2% at likely price
- 504-dwelling build-to-rent DA 640 m away (960A Bourke St); 991 dwellings stated across DAs within 1 km

Backup: Unit 26, 153–157 George St, Redfern (`GANSW718923081`), 2 bed, $800K, AVM $781K.
Re-pull all figures on the day; don't hard-code these.

## API map (verified 6 Nov via the demo site proxy)

Base `https://api-ht.microburbs.com.au/v1`, `Authorization: Bearer <team key>`. 176 endpoints, docs at `/docs`, spec at `/openapi.json`. Suburb names must be exact SAL names (e.g. `Waterloo (NSW)`) — resolve via `geocode/suburb`.

| Need | Endpoint | Note |
|---|---|---|
| Address → GNAF | `geocode/address?address=` | Returns unit/house type |
| Value | `properties/{g}/valuation/avm` | ~1 in 4 for-sale units have one — handle missing |
| Likely sale price | `properties/{g}/valuation/agent-quoting` | ~half of listings |
| History | `properties/{g}/history/all` | Sales + rent history |
| Comparables | `comparables/recent-sales-nearby`, `cma-comp-set` | |
| Rentals nearby | `suburbs/{s}/listings/for-rent` | price, beds, coords, listing_date |
| For sale (tracker) | `suburbs/{s}/listings/for-sale`, `properties/{g}/context/nearby-for-sale` | price on ~60%; listing_date + off_market for change detection |
| Suburb market | `market/median-rent`, `market/yield-pct` (house + unit), `market/vacancy-rate-series`, `market/strata-levies`, `market/investor-concentration`, `market/days-on-market` | |
| Supply | `development/da-list` (address + lat/lng, no stage/budget yet), `development/supply` (index only), `development/construction-activity`, `development/building-controls`, `market/months-of-supply` | Demo proxy caches 1 hr; add a cache-buster when testing |
| Hazards | `properties/{g}/risks/all`, `shapes/noise-heatmap`, `shapes/busy-roads`, `crime/by-mesh-block` | |
| Costs | `properties/{g}/valuation/negative-gearing`, `market/strata-levies` | |
| Map | `properties/{g}/context/mesh-blocks` (polygons, investor %, rental count within 1 km) + DA pins from `da-list` lat/lng | |

## Architecture

Unchanged from the original plan: everything in the extension, no backend. Content script reads the listing (address, price, beds) → injected iframe panel (auto-opens) → agent loop in the panel page calls Microburbs + the LLM directly. IndexedDB (Dexie) caches responses by GNAF. Keys pasted into an options page, never committed. Pre-warm the demo listing.

## Scope

**Must:** listing detection + auto-open panel on realestate.com.au · setup in sidebar · panel (verdict, tiles, flags) · chat with at least 4 component tools (yield, supply, value, offer) · our rent estimate.
**Nice:** tracker, area comparison, cash flow, memo, Domain support, map.
**Out:** price forecasting, accounts, anything outside City of Sydney.

## Build plan (7 Nov)

- 11:00–11:45 key in, pull + cache everything for the demo listing
- 11:45–13:00 agent + tools + panel
- 13:00–13:30 freeze, badge, polish
- 13:30–14:15 record pitch + demo
- 14:15–14:50 README, report.html (held-out check: our rent estimate vs actual advertised rents on held-out listings; business case section from above), push public repo
- Demo video closes at 2:45 on the business case (five revenue lines in one slide, then one mock Investor Pulse slide)
- 15:00 hand-in closes

## Official brief — Task 3 (read 7 Nov) ⚠️ overrides anything below

Source: microburbs.com.au/p/hackathon-task-chrome-extension
- Rule: "read only the viewed address… do not collect or copy any listing text or photos." **Our reading (Jake, 7 Nov): it's about not storing/harvesting listing data.** Page reads stay ephemeral context only (never persisted, never sent anywhere but the LLM turn), shortlist stores URL + address only. **Microburbs is the source of truth for every fact shown**; page data is context (e.g. asking price, hidden bracket) and is labelled as the portal's, not ours. Say this explicitly in report.html.
- **Angle: keep the investor lens** (yield, weekly cost, supply pipeline, verdict vs brief) — the out-of-the-box take vs a plain facts panel.
- Hand in: `demo.mp4` working beside real REA/Domain listings; `report.html` comparing existing extensions vs the property sites (what buyers already see → our added value → why these facts).
- Judged: end-to-end on real listings; judges open several and **check the matched address and that facts belong to the correct home**; value of chosen facts; pitch + demo + report. No scored CSV.
- Files (11 am, day-only, never republish/commit): `addresses-city-of-sydney.csv` (for matching), `public-housing-homes-city-of-sydney.csv` (estimated flags).
- Suggested endpoints: `/v1/geocode/address` (≤10 candidates), `/valuation/avm`, `/basics/all`.
- Customer: extension founder with ~52–54k downloads wanting Microburbs data + branding; rival listing-history extension ~10k active users.
- Their example: Unit 105, 8 Sam Sing Street, Waterloo.

## Official brief — Task 4: rents (read 7 Nov)

Source: microburbs.com.au/p/hackathon-task-rents
- Output `rents_<team>.csv`: all 65,777 gnaf_ids × `rent_with_car_space`, `rent_without_car_space` (difference = parking premium). No blanks.
- As at **31 Jul 2026** — nothing later from anywhere; filter API rows yourself. Scored on 1,699 frozen adverts 1 Aug–30 Sep; rank = median absolute $ error, tiebreak = share within $100.
- Baselines to beat: simple $100 · +parking $93 · Microburbs rental valuation **$86** (55.21% within $100, runs $61 low) · suburb median 56.39% within $100.
- Report: insights first, held-out accuracy + R², date-based split (train on earlier, check on later ≤31 Jul), data + method.
- Files: input flats (bedrooms, baths, car, floor_level for 34k, flats_in_building, block growth, lat/lng), past leases (private), blocks 2021–2026.
- Synergy: the same model can power the extension's rent figure + "a car space adds $X/wk".
- **Owner: teammate, as a stretch goal.** Extension stays the main submission.

## Rent model plan (Task 4)

**Yes, a notebook** (pandas + LightGBM; teammate's laptop or Colab). Not a plain linear regression: the score is median $ error, so we want a robust objective and strong comparables.

1. **Clean + date split.** Leases ≤ 31 Jul 2026 only (filter API rows by date). Hold out the last ~2 months (e.g. 1 Jun–31 Jul) to mimic the 2-month scored window; train on everything earlier. Report median abs error, % within $100, R² on that hold-out.
2. **Rent index.** Monthly suburb × beds median → index, so every past lease can be rolled forward to "as at 31 Jul".
3. **Features (the real signal):**
   - this flat's own last lease, indexed forward (+ months since)
   - same building × same beds: median indexed rent, count
   - distance-weighted comps (same beds, ≤ 500 m / 1 km)
   - beds, baths, car_space, floor_level (+ missing flag), flats_in_building, property_type, suburb, lat/lng
   - block_new_homes_2021_2026, block_homes_2026; first_ever_listed (building age proxy)
4. **Model.** LightGBM on log(rent) with L1 (median) objective; monotone constraint on car_space so with ≥ without. Predict every flat twice (car_space = 1 / 0) → the two columns.
5. **Calibrate.** Shift by the median hold-out residual (Microburbs' own valuation runs $61 low; asking rents skew high).
6. **Fallback chain so nothing is blank:** model → building median → suburb × beds × car median → suburb median. Round to $0.50.
7. **Baselines to show in the report:** suburb median, + parking ($93), Microburbs valuation ($86). Ours should beat $86.

**Optional Jev features (not RL).** Only if the past-leases file has advert text: Jev judges each flat's latest pre-cutoff advert (Nouls/Scores: renovated, views, north/aspect, furnished, condition) → columns for LightGBM, per TypeSafe's feature-discovery cookbook. Keep a feature only if the date-held-out median error drops. Flats with no advert text get blanks (LightGBM handles missing).

Risks: leakage (anything after 31 Jul, incl. `rent-history-latest`); studios with bedrooms > 0 (use the bedrooms column, as the brief says); 4,246 addresses outside the City files (use lat/lng + open data, not the City key).

## Next: `get_listing_brief` (speed)

The first read is slow: 4+ LLM round trips, each running its tool calls one after another. Replace it with ONE host-side JS tool (not declarative):

- `get_listing_brief({ address })` → geocode, then `Promise.all` every property + suburb endpoint (value, agent quoting, history, risks, recent sales, market, rentals, DAs; neighbouring suburbs for the 1 km radius)
- Computes deterministically in code, not by the model: rent comps (same beds, haversine ≤ 1 km, median + IQR), yield at asking and likely price, weekly cost, DA dwellings ≤ 1 km (regex on descriptions + distance)
- Returns one compact JSON brief → first read = 1 tool call + 1 LLM step
- Cache raw responses in IndexedDB by GNAF (spec architecture) so reopening a listing is instant
- Bonus: the v3 panel (gauge, readouts, signals) can render straight from the brief, no LLM needed; the LLM only writes the verdict line + chat

## Next: read the page source, prefetch from search results

**realestate.com.au page source (checked 6 Nov in Chrome):**
- `window.ArgonautExchange` inline script → `["resi-property_listing-experience-web"].urqlClientCache` (JSON string) → each entry's `.data` is JSON. The live `window` object is emptied after hydration, so parse the **script text**, not the global.
- Listing page (`details.listing`): `id`, `address.display.fullAddress`, `address.display.geocode.{latitude, longitude}` (no geocoding guesswork), `propertyType.id`, `components.details.metadata.agencyId`, `PropertyDescriptionComponent.publishedDate` (listed date → days on market), inspections, auction.
- Ad targeting (`googletag.pubads().getSlots()[0]` targeting): `price: "014s"` = **encoded price bracket, present even when the agent says "Contact Agent"** (decode by sampling listings with visible prices), `productDepth` (agent's paid tier — `premiere` = top spend), `beds/baths/cars`, `constructionstatus`, `region`.
- **Price code DECODED (6 Nov, 33 samples)** — set client-side (not in HTML), read via `googletag` in the MAIN world. Ranged prices bucket by midpoint. `005s` ~$350–450k · `006s` ~$450–500k · `008s` $500–600k · `010s` $600–750k · `014s` $750k–1M · `017s` $1–1.5M · `018s` $1.5–2M · `020s` $2–2.5M · `021s` $2.5–~3M · `024s` ~$3.5–4M. Implemented in `extension/src/agent/rea-price.js` (+ test); injected into ephemeral context by `readTab`. Unpinned: below $400k, $3–3.5M, above $4M.
- Search results page: same exchange → `buySearch.results.exact.items[25]` with `listing.id`, full address, `price.display`, `generalFeatures`, `propertySizes`, `listingCompany`, `productDepth`, `_links.canonical`; plus `buySearch.recentlySold.listings`.

**domain.com.au page source (checked 6 Nov in Chrome):** `<script id="__NEXT_DATA__">` → `props.pageProps.componentProps` (plain JSON, stable across hydration).
- Listing identity: `listingId`, `unitNumber`/`streetNumber`/`street`/`suburb`/`postcode`, `map.{latitude, longitude}`, `listingSummary.{beds, baths, parking, method, status, title}` (title = price text).
- **`createdOn` / `domainSays.firstListedDate`** → days on market (demo listing: 17 Jun → 142 days, a strong negotiation signal); `modifiedOn` = last edit (price drops?).
- **`domainSays.lastSoldOnDate`** (2021-03-15) — last sale date without a history call.
- **`suburbInsights`** (for this bed count + type): `medianPrice` 727k, `medianRentPrice` 860, `avgDaysOnMarket` 59, `auctionClearance` 50, `nrSoldThisYear` 120, `entryLevelPrice` 604k, `luxuryLevelPrice` 883k, renter %, demographics → instant comparison context before any Microburbs call.
- `priceGuide.estimatedPrice` / `comparableData` — Domain's own estimate slot (empty on this listing; filled on some).
- `digitalData.titan.adKeyValues` — `medianPrice`, `features`, `bedrooms`; no hidden price bracket like REA's.
- Search results: same blob → `listingsMap` (≈27 listings + projects per page; `totalListings` 425) with `listingModel.{price, features.{beds, baths, propertyType, landSize}, address, inspection, keywords}` and `listingSearchResultIds` for order.

**Prefetch:** on a search results page, parse the 25 listings and warm the `get_listing_brief` cache for each (geocode → parallel fetch), throttled (e.g. 4 at a time, stop when the user leaves the page). Clicking a listing then opens with the brief already cached.

## Open questions

1. ~~Organisers: supply + DA location~~ Answered 6 Nov: supply is an overlapping 500 m index; DA list now has address + coordinates; stage and budget "coming soon". Check on build day whether stage/budget landed.
2. Carlos: confirm we merge his property-profile panel into the chat components, and who owns what on the day.
3. Is pre-built scaffolding allowed before 11:00?
