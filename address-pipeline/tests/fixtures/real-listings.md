# Real-listing fixtures: structured-data formats

Captured Nov 2026 from public listing pages. Fixtures hold only URL, Residence address, `<h1>` and `og:title`.

## realestate.com.au

- JSON-LD is an array; the `Residence` node has `address.streetAddress`, `addressLocality`, `addressRegion` (upper case), `postalCode`. An `Event` (inspection) node repeats the address; ignore it.
- h1 and og:title are identical: `street, Suburb, Vic 3182` (state in title case, comma before state).
- Units: `streetAddress` carries the unit in slash form: `20/82 Grey Street`, `4/64A Third Avenue`, `M2/1 Seymour Avenue` (letter-prefixed). Ranges: `322/17-19 Memorial Avenue`. Letter suffix: `76a Douglas Street`.
- Lots (land): `streetAddress` is `Lot, 5511 Nautical Cct` and even `Lot, Lot 5532 Verday Bvd` (leading "Lot, " added by the site, so it can be doubled). h1 matches it exactly. Abbreviations (Cct, Bvd) are kept.
- Hidden address: **no `Residence` node at all** (only a `BreadcrumbList`). h1 is `Address available on request, St Kilda, Vic 3182`; og:title drops state and postcode (`Address available on request, St Kilda`). URL slug still has type, state, suburb, id.
- Suburbs such as St Kilda, Mount Lawley are stored with the full word "Mount" and abbreviation "St" as shown.

## domain.com.au

- JSON-LD is several separate scripts: `Organization` (agent address, never use), `Residence`, `BreadcrumbList`, `Event` (open homes, own locations), `FAQPage`. Select `Residence` by type.
- h1: `street, Suburb VIC 3182` (no comma before the state, state upper case). og:title is the same plus ` | Domain`.
- Units: slash form again, with the slug flattening it: `1005/95 St Kilda Road` has slug `1005-95-st-kilda-road-...`; `18/1 Rookwood Street` has slug `18-1-rookwood-street-...`, so slug and street cannot be split reliably. Letter-prefixed units (`G01/54-56 Chapel Street`, `D538/17-19 Memorial Avenue`, `B20/1 Eildon Road`) start their slug with the letter-number.
- Lots: `Lot 430 Dawbin Road`, `Lot 916 34 Meerkat Road` (lot number then street number, no slash; slug starts with `lot-`).
- Hidden address: **not observed**. None of about 290 for-sale search results (about 12 search pages) had a slug without a street number, so no hidden Domain listing was captured. Still unknown how Domain structures it.

## Same street, two suburbs

`William Street` appears in Mount Lawley (WA, 7/598) and Mount Waverley (VIC, 22) in the realestate fixtures. Matching must use suburb and postcode, not street alone.
