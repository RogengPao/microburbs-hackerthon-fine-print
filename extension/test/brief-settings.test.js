import { test } from 'node:test';
import assert from 'node:assert/strict';

test('cleanBrief: zeros, blanks and junk fall back to sane defaults', async () => {
  globalThis.chrome ??= { storage: { local: { get: async () => ({}) } }, runtime: {} };
  const { cleanBrief } = await import('../src/agent/agent.js');
  assert.deepEqual(cleanBrief({ budget: 800000, deposit: 160000, minYield: 4, holdYears: 0 }), { budget: 800000, deposit: 160000, minYield: 4, holdYears: 10 });
  assert.deepEqual(cleanBrief({}), { budget: 800000, deposit: 160000, minYield: 4, holdYears: 10 });
  assert.equal(cleanBrief({ holdYears: '' }).holdYears, 10);
  assert.equal(cleanBrief({ holdYears: 7 }).holdYears, 5); // snaps to the nearest option
  assert.equal(cleanBrief({ holdYears: 30 }).holdYears, 15);
  assert.equal(cleanBrief({ budget: 600000, deposit: 900000 }).deposit, 120000); // deposit can't exceed budget
  assert.equal(cleanBrief({ minYield: -1 }).minYield, 4);
});
