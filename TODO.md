# Fine Print — epics (Sat 7 Nov)

Hand-in closes **15:00**. Team key + CSVs arrive **11:00**.
🟢 = can be done before the key (demo proxy / no data needed) · 🔑 = needs the key or the day's CSVs

## Task 3 — Chrome extension (main submission)

- [ ] 🟢 **Listing brief** — one tool: match address → fetch every Microburbs endpoint in parallel → investor maths in code (rent, yield, weekly cost, supply) → cached per property _(built + unit-tested; needs a live check in the extension)_ (JAKE)
- [x] 🟢 **Fast first read** — agent talks first using the brief: one tool call, one model step _(wired; live check with the brief)_
- [ ] 🟢 **Address reading** — clean address off REA and Domain listing pages (unit, number, street, suburb)
- [ ] 🔑 **Exact address matching** — match against the City of Sydney address list, geocode fallback, show "Matched: …" so judges can check it; test set of ~15 real listings scoring ≥14/15
  - Known gaps in the address pipeline (PR #4 review, 7 Nov) — fix if the match test set trips on them:
    - [ ] no-suburb input never matches and reports `suburb-mismatch` (compare suburbs only when both sides have one; use candidate `sal`)
    - [ ] non-address headings / og:title fall back to the loose parser → fake addresses ("2 Bedroom Apartment in Zetland")
    - [ ] 1-letter street fuzz can pick the wrong street (Bourke ↔ Burke) and still say exact
    - [ ] number range matches any single number inside it (`lowConfidence` never gates exact)
    - [ ] "Level 2 5/12 …" without a comma no longer parses
    - [ ] raw-text geocode fallback removed (O'Connell → "o connell" only)
    - [ ] postcode guessed from the first table entry and kept in every retry
    - [ ] retry variants capped at 2 before dedupe (range-first-number retry lost)
    - [ ] only the last street-type word expanded ("Smith St North")
    - [ ] panel loads the 392 KB postcode table it doesn't need
- [ ] 🟢 **Panel UI** — verdict, readouts, warnings, upside, rendered from the brief inside the slide-out; budget + deposit editable
- [ ] 🟢 **Supply pipeline view** — new dwellings within 1 km, build-to-rent called out
- [ ] 🔑 **Supply heatmap** — every DA within ~1.5 km plotted around the property (size = stated dwellings, yellow = build-to-rent, 500 m / 1 km rings), SVG, no map lib; richer: block outlines coloured by `development/supply` via `context/mesh-blocks`
- [ ] 🔑 **Surrounding suburbs** — supply split by suburb + each neighbour's vacancy / median rent / yield (brief already pulls rentals + DAs from up to 4 suburbs within ~2.2 km)

### API questions (check the moment the key lands)
1. `development/supply`: response shape per block? coordinates / polygon or just an id? radius filter?
2. `context/mesh-blocks`: which fields per block (supply index, new addresses, investor %, rental count)? radius > 1 km? payload at 1.5 km (~70 KB at 1 km)?
3. `development/da-list`: paginated or capped (36 for Zetland looked short)? date filter? lat/lng + radius search instead of per suburb? is stage/status live?
4. Neighbouring suburbs: adjacency / nearby-suburbs endpoint? (`/suburbs/{s}/neighbours` 404'd on the proxy) — else keep our centroid table
5. Property coordinates: direct endpoint? (today: `context/nearby-for-sale` centre)
6. `development/construction-activity` + `building-controls`: shapes, per block or per suburb? (→ "under construction now", "latent capacity")
7. Coverage: Newtown / Paddington / Annandale / St Peters return nothing — City of Sydney only?
8. Rate limits: a brief fires ~16 calls in parallel — what's the team-key limit?
- [ ] 🔑 **Public housing flag** — from the supplied CSV
- [ ] 🔑 **Switch to the live API** — paste key, move off the demo proxy, smoke every endpoint
- [x] 🟢 **Property memory** — every analysed property saved (IndexedDB, with link + main image); agent tools `recall_properties` + `get_saved_property` _(unit-tested; live check pending)_
- [ ] 🟢 **Prefetch from search results** _(stretch)_
- [ ] 🟢 **Shortlist view** _(stretch)_

## Submission

- [ ] 🟢 **Competitor scan** — what REA, Domain and rival extensions already show buyers
- [ ] 🟢 **Pitch + demo storyboard** — 2:45, investor lens, ends on the business case
- [ ] 🟢 **report.html** — what buyers see today → our added value → why these facts → data handling (nothing stored, Microburbs = source of truth)
- [ ] 🔑 **Demo recording** — `demo.mp4` on several real REA + Domain listings, incl. their Waterloo example
- [ ] 🔑 **Report numbers** — address-match accuracy, final screenshots
- [ ] 🟢 **Repo hygiene** — README, gitignore keys + day-only CSVs + API output, public push
