// Addresses: read what the page (or the investor) gives us, and match it to a
// Microburbs geocode candidate STRICTLY: unit, street number (ranges overlap), street
// and suburb must agree, and exactly one property must be left. Lots are never exact.
// Judges check the matched address, so a wrong-but-close match is worse than "please confirm".
//
// Implemented in address-pipeline/ (TypeScript, 140+ tests incl. 34 real REA/Domain
// listings) and bundled into ./address-pipeline.js. Edit there, then `npm run build`.
export {
  addressFromPage,
  findProperty,
  formatAddress,
  matchAddress,
  matchCandidate,
  parseAddress,
  unresolvedHint,
} from './address-pipeline.js';
