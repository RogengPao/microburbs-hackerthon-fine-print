# address-pipeline

Address reading + strict matching for the Fine Print extension, in TypeScript.
Bundled into one plain ES module, `extension/src/agent/address-pipeline.js`, which
`extension/src/agent/address.js` re-exports. The extension itself stays build-free.

```bash
npm install
npm test          # vitest: parsing, matching, 34 real REA/Domain listings
npm run typecheck
npm run build     # regenerates ../extension/src/agent/address-pipeline.js — commit it
```

- `src/bridge.ts` — the extension's API: `addressFromPage`, `parseAddress`, `formatAddress`,
  `findProperty` (geocode + retries + strict match), `matchAddress`, `matchCandidate`, `unresolvedHint`.
- `src/address.ts` — street-line parsing (units, ranges, Lots, letter suffixes), normalisation, postcode table.
- `src/matcher.ts` — candidate scoring, `decide()` (exact / ambiguous / several-units / suburb-mismatch / no-match), query retries.
- `src/data/postcodes.json` — ABS SAL→POA 2021 (CC BY 2.5 AU), suburb+state → postcodes.

Rules: never "closest"; a unit-less listing never takes a unit; Lots are never exact.
