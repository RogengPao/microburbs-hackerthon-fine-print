import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inCoverage } from '../src/agent/listing-brief.js';

test('City of Sydney suburbs are in range, others are out', () => {
  for (const s of ['ZETLAND', 'Surry Hills', 'waterloo', 'Camperdown (NSW)']) assert.equal(inCoverage(s), true, s);
  for (const s of ['BONDI BEACH', 'Parramatta', 'Newtown', 'Chatswood']) assert.equal(inCoverage(s), false, s);
});

test('unknown suburb never blocks', () => {
  assert.equal(inCoverage(''), true);
  assert.equal(inCoverage(null), true);
});
