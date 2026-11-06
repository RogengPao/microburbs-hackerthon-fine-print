import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bracketLabel, decodeReaPrice } from '../src/agent/rea-price.js';

// Samples observed on realestate.com.au, 2026-11-06 (shown price → code).
const SAMPLES = [
  [520_000, '008s'], [575_000, '008s'], [600_000, '010s'], [708_000, '010s'], [725_000, '010s'],
  [765_000, '014s'], [950_000, '014s'], [995_000, '014s'], [1_000_000, '017s'], [1_450_000, '017s'],
  [1_500_000, '018s'], [1_950_000, '018s'], [2_000_000, '020s'], [2_450_000, '020s'], [2_500_000, '021s'], [2_900_000, '021s'],
];

test('every observed sample falls inside its decoded bracket', () => {
  for (const [price, code] of SAMPLES) {
    const b = decodeReaPrice(code);
    assert.ok(b, code);
    assert.ok(price >= b.min && price < b.max, `${price} not in ${code} ${b.min}-${b.max}`);
  }
});

test('unknown codes decode to null; labels read naturally', () => {
  assert.equal(decodeReaPrice('099s'), null);
  assert.equal(decodeReaPrice(undefined), null);
  assert.equal(bracketLabel(decodeReaPrice('014s')), '$750k–$1M');
  assert.equal(bracketLabel(decodeReaPrice('017s')), '$1M–$1.5M');
  assert.equal(bracketLabel(decodeReaPrice('024s')), '~$3.5M–$4M');
});
