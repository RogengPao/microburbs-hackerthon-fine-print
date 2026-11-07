# Fine Print

**Read it before you buy it.** An intelligent investment analyst on every realestate.com.au and Domain listing, powered by Microburbs data.

Microburbs AI Hackathon 2026 · Task 3 (browser extension).

## The problem

If you're buying an investment property today, you've got two options:

1. **Gut feel.** Scroll REA and Domain, find something you like, and trust the selling agent, whose job is to get you to buy it.
2. **Become a super-user.** Build a spreadsheet and stitch together five sites: RP Data for rents, risk overlays from one site, development applications from another.

Either way, you're not making an informed decision quickly. Meanwhile:

- **More than half of Australia's 2.3 million landlords** made a rental loss last year (ATO 2023–24).
- **In Sydney, homes that beat their price guide sold a median $117,500 over the top of it** (Homer data, May 2026).
- New supply, especially build-to-rent towers, can land right when you need to re-lease, and nothing on the listing tells you when.

In investors' own words: *"The hardest part is knowing whether you're overpaying."* And: *"I don't want to waste money on overlapping platforms that don't add much."*

## What Fine Print does

Open any REA or Domain listing and press **F**. A panel slides in beside the listing, scored against your own investor brief (budget, deposit, minimum yield, hold period).

**On every listing**
- **What you'll really pay:** a likely sale price based on the agency's record of selling over or under its quotes, plus the estimated value, asking price and your budget on one gauge.
- **What it costs you each week:** rent from similar homes within 1 km, gross yield, and your out-of-pocket weekly cost against your deposit.
- **When supply lands:** new homes and build-to-rent within 1 km, timed against the years of your hold ("build-to-rent wave around 2031, year 6 of 10").
- **What the listing doesn't say:** tappable signals for supply, timing, agency quoting, value vs asking, rent and hazards.
- **Hazards and public housing:** flood, heritage, bushfire and power lines, plus public housing in the same building or nearby (City of Sydney list).
- **Tooltips everywhere:** hover any number to see where it comes from.

**Your own analyst**
- Ask anything ("What should I offer?", "Is the new supply a dealbreaker?") and get a short answer with a visual card: cash flow, offer range, value, supply timeline, area comparison, hold scenario or hazards.
- Suggested follow-up questions for each listing.
- It remembers every property you've looked at, so it can compare ("cheaper to hold than the Waterloo one you saw yesterday").

**The shortlist**
- Shortlist any listing from the panel (or press **S** with the panel open). Click the toolbar icon to open the shortlist.
- A spreadsheet of every shortlisted property with all its Microburbs figures: sort, filter (`>800k`, `4-6`, `!btr`), reorder and hide columns, with property and suburb pinned.
- Add your own columns, including **formulas** (`rent * 52 / my_offer * 100` = yield at your offer). Copy to Excel or Sheets, or export CSV.

**Built to be taken up**
- No sign-up. Works on both portals. One key to open.
- A friendly "outside our data area" message for listings beyond the City of Sydney (the hackathon data's coverage).

## Install (judges)

1. Unzip `fine-print-extension.zip` (supplied with our submission).
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the unzipped folder.
3. Open any realestate.com.au or Domain listing in the City of Sydney and press **F**.
4. First run: paste an **OpenRouter** API key and the **Microburbs** API key, then set your brief (four inputs). Keys stay in your browser.

The analyst runs on DeepSeek V4.1 Flash via OpenRouter. Settings has a **Reset everything** button to replay the new-user experience.

## Build from source

```bash
cd extension
npm install
npm test                                  # 93 unit tests
npm run prepare:public-housing -- <path/to/public-housing-homes-city-of-sydney.csv>   # optional, see below
npm run prepare:rent-model -- <path/to/rents_FinePrintPredictions.csv> <path/to/chosen.json>   # optional, see below
npm run build                             # → extension/dist (load this folder in Chrome)
```

More detail on the agent runtime and code layout: [`extension/README.md`](extension/README.md).

## Data

- **Microburbs is the source of truth** for every figure: valuation, agency quoting record, rentals, sales, development applications, market and hazards. Calculations (yield, weekly cost, supply timing) are done in code, never by the model.
- **Supplied hackathon files are not republished.** The public-housing CSV is turned into a small lookup at build time (`npm run prepare:public-housing`). It's git-ignored and ships only inside the built extension. Without it, everything works except the public housing flag.
- **Our own rent model** (LightGBM + CatBoost, trained on City of Sydney leases to 31 Jul 2026; median error ~$44/wk, 79% within $100) is the one figure not from Microburbs, and it's labelled "our rent model" wherever it appears. Its predictions for 65,777 City of Sydney apartments (with and without a car space) are bundled the same way (`npm run prepare:rent-model`, git-ignored). When it covers the apartment, its rent drives yield and weekly cost; otherwise the nearby-rentals median does.
- **Nothing leaves your browser** except calls to Microburbs and OpenRouter. Your brief, keys, shortlist and saved properties are stored locally.
- Supply timing is an estimate (lodgement + approval + build time by size, ±1 year) and is labelled as one. General information, not financial advice.

## Repo

| Folder | What |
|---|---|
| `extension/` | The Chrome extension (MV3): panel, agent, shortlist, settings |
| `address-pipeline/` | Address parsing and exact GNAF matching |
| `pitch/` | Pitch script, demo run order, business case |
| `design/` | Design references |
