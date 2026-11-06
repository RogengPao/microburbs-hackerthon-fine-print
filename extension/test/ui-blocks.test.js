import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LessonBook, TEMPLATES, templateGuide, uiBlockTool } from '../src/agent/ui-blocks.js';
import { ToolRegistry } from '../src/runtime/index.js';
import { validate } from '../src/runtime/validate.js';

const memoryStorage = () => {
  const data = {};
  return { data, get: async (k) => ({ [k]: data[k] }), set: async (o) => Object.assign(data, o) };
};
const call = (template, body) => ({ id: 'c1', name: 'render_ui_block', args: { template, body } });

test('all 9 design templates exist and every example is valid', () => {
  assert.deepEqual(Object.keys(TEMPLATES), ['yield', 'supply', 'cash_flow', 'value', 'area', 'offer', 'hold', 'property', 'overlays']);
  for (const [name, t] of Object.entries(TEMPLATES)) assert.deepEqual(validate(t.schema, t.example), [], name);
});

test('a valid block renders and concludes the turn', async () => {
  const reg = new ToolRegistry([uiBlockTool({ lessons: new LessonBook(memoryStorage()) })]);
  const out = await reg.execute(call('value', TEMPLATES.value.example));
  assert.equal(out.error, false);
  assert.equal(out.concludes, true);
  assert.equal(JSON.parse(out.result).rendered, true);
});

test('a wrong body is told exactly what to fix, with the field guide + example, and does not conclude', async () => {
  const reg = new ToolRegistry([uiBlockTool({ lessons: new LessonBook(memoryStorage()) })]);
  const bad = { headline: '5.2%', rows: [{ label: 'This property', value: 5.2, kind: 'mine' }], caption: 'x', sources: [] };
  const out = await reg.execute(call('yield', bad));
  assert.equal(out.error, true);
  assert.equal(out.concludes, false);
  const env = JSON.parse(out.result);
  assert.equal(env.error_code, 'invalid_block_body');
  assert.equal(env.retryable, true);
  assert.match(env.error, /threshold_pct/); // missing required
  assert.match(env.error, /value_pct/); // missing in row
  assert.match(env.error, /value/); // unexpected key
  assert.match(env.error, /"mine"/); // bad enum
  assert.match(env.error, /sources/); // too few items
  assert.match(env.hint, /Valid example body: \{"headline":"5\.2%"/);
  assert.match(env.hint, /threshold_pct: number 0–20/);
});

test('unknown template is rejected by the schema with the allowed list', async () => {
  const reg = new ToolRegistry([uiBlockTool({ lessons: new LessonBook(memoryStorage()) })]);
  const out = await reg.execute(call('pie_chart', {}));
  assert.equal(out.error, true);
  assert.match(JSON.parse(out.result).error, /yield/);
});

test('learning: mistakes are recorded and fed back as lessons', async () => {
  const storage = memoryStorage();
  const lessons = new LessonBook(storage);
  const reg = new ToolRegistry([uiBlockTool({ lessons })]);
  await reg.execute(call('cash_flow', { headline: '−$181', lines: [{ label: 'Rent', amount: 775 }], caption: 'x', sources: ['a'] }));
  await reg.execute(call('cash_flow', { headline: '−$181', lines: [{ label: 'Rent', amount: 775 }, { label: 'Interest', amount: -799 }], caption: 'x', sources: ['a'] }));
  const text = await new LessonBook(storage).text(); // a fresh book reads what was stored
  assert.match(text, /cash_flow: body\.lines\[\]: 'weekly' is a required property \(3×\)/); // 3 items across 2 calls → one lesson
  assert.match(text, /amount/);
  assert.equal(await new LessonBook(memoryStorage()).text(), '');
});

test('the guide documents every template', () => {
  for (const name of Object.keys(TEMPLATES)) assert.match(templateGuide(name), /Valid example body/);
});
