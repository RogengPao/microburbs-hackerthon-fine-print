import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addressFromPage, formatAddress, matchCandidate, parseAddress, streetParts } from '../src/agent/address.js';

test('parse the address formats we meet', () => {
  assert.deepEqual(parseAddress('Unit 38, 3 Victoria Park Parade, Zetland NSW 2017'), {
    unit: '38', number: '3', street: 'VICTORIA PARK PARADE', suburb: 'ZETLAND', state: 'NSW', postcode: '2017',
  });
  assert.equal(parseAddress('506/8 Fuse Street, Zetland NSW 2017').unit, '506');
  assert.equal(parseAddress('UNIT 38/3 Victoria Park Parade, Zetland').street, 'VICTORIA PARK PARADE');
  assert.equal(parseAddress('Level 2, 5/12 Smith St, Sydney NSW 2000').unit, '5');
  assert.equal(parseAddress('8-12 Sam Sing Street, Waterloo').number, '8-12');
  const house = parseAddress('8 Sam Sing Street, Waterloo');
  assert.equal(house.unit, null);
  assert.equal(house.suburb, 'WATERLOO');
  assert.equal(formatAddress({ unit: '105', number: '8', street: 'Sam Sing Street', suburb: 'Waterloo', state: 'NSW', postcode: '2017' }), '105/8 Sam Sing Street, Waterloo NSW 2017');
});

test('street names compare by core + type', () => {
  assert.deepEqual(streetParts('Victoria Park Parade'), { core: 'VICTORIA PARK', type: 'PDE' });
  assert.deepEqual(streetParts('VICTORIA PARK PDE'), { core: 'VICTORIA PARK', type: 'PDE' });
  assert.deepEqual(streetParts('The Esplanade'), { core: 'THE', type: 'ESP' });
});

// Real geocode candidates for "Unit 38, 3 Victoria Park Parade, Zetland" (7 Nov).
const CANDS = [
  { id: 'GANSW710358627', sal: 'Zetland', display_name: 'UNIT 38/3 Victoria Park Parade, Zetland' },
  { id: 'GANSW710506372', sal: 'Glebe (NSW)', display_name: 'UNIT 3/8 Victoria Road, Glebe (NSW)' },
  { id: 'GANSW706607112', sal: 'Elizabeth Bay', display_name: 'UNIT 38/3 Crick Avenue, Elizabeth Bay' },
  { id: 'GANSW717920043', sal: 'Potts Point', display_name: 'UNIT 38/3 Earl Place, Potts Point' },
];

test('strict match: unit, number, street and suburb must agree', () => {
  const want = parseAddress('Unit 38, 3 Victoria Park Parade, Zetland NSW 2017');
  assert.equal(matchCandidate(CANDS, want)?.candidate.id, 'GANSW710358627');
  // same unit/number on a different street → no match, never "closest"
  assert.equal(matchCandidate(CANDS.slice(1), want), null);
  // wrong unit
  assert.equal(matchCandidate(CANDS, parseAddress('Unit 39, 3 Victoria Park Parade, Zetland')), null);
  // missing unit must not match a unit
  assert.equal(matchCandidate(CANDS, parseAddress('3 Victoria Park Parade, Zetland')), null);
  // wrong suburb
  assert.equal(matchCandidate(CANDS, parseAddress('38/3 Victoria Park Parade, Waterloo')), null);
  // street type abbreviation is fine
  assert.equal(matchCandidate(CANDS, parseAddress('38/3 Victoria Park Pde, Zetland'))?.candidate.id, 'GANSW710358627');
});

test('page data beats the heading; heading is the fallback', () => {
  const fromData = addressFromPage({
    heading: 'ignored',
    listing: { portal: 'domain', unit: '506', number: '8', street: 'Fuse Street', suburb: 'Zetland', state: 'NSW', postcode: '2017', lat: -33.91, lng: 151.21 },
  });
  assert.equal(fromData.source, 'domain page data');
  assert.equal(fromData.parts.unit, '506');
  const fromHeading = addressFromPage({ listing: null, heading: '20/8 Grandstand Parade, Zetland, NSW 2017' });
  assert.equal(fromHeading.source, 'page heading');
  assert.equal(fromHeading.parts.street, 'GRANDSTAND PARADE');
  assert.equal(addressFromPage({ listing: null, heading: 'Apartments for sale in Zetland' }), null);
});
