import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  agentSnapshot,
  assemble,
  assemblyPolicy,
  HttpError,
  MemoryTranscript,
  message,
  MockAdapter,
  PENDING_PLACEHOLDER,
  resumeTurn,
  runTurn,
  tool,
  ToolRegistry,
  TRUNCATION_NOTICE,
} from '../src/runtime/index.js';

const agent = agentSnapshot({ agent_version: 't', name: 'test', provider: 'mock', model: 'm', system_base: 'You help.' });
const user = (text) => message({ role: 'user', text });
const call = (id, name, args = {}) => ({ id, name, args });

function registry(extra = []) {
  return new ToolRegistry([
    tool({ name: 'echo', description: 'echo', input_schema: { type: 'object', properties: { v: { type: 'string' } }, required: ['v'] }, execute: (a) => `echo:${a.v}` }),
    tool({ name: 'approve', description: 'needs a human', delivery: 'deferred' }),
    tool({ name: 'render_card', description: 'show a card', execute: () => 'shown', concludes: true }),
    ...extra,
  ]);
}

test('plain reply completes and persists one agent record', async () => {
  const store = new MemoryTranscript();
  const adapter = new MockAdapter({ script: [{ text: 'hi there', usage: { input_tokens: 10, output_tokens: 2 } }] });
  const r = await runTurn(agent, store, adapter, registry(), { inbound: user('hello') });
  assert.equal(r.status, 'completed');
  assert.equal(r.response, 'hi there');
  assert.deepEqual((await store.messages()).map((m) => m.role), ['user', 'agent']);
  assert.equal(r.usage.input_tokens, 10);
});

test('sync tool round: intent-before-execute, then reply', async () => {
  const store = new MemoryTranscript();
  const order = [];
  const reg = registry([
    tool({
      name: 'spy',
      description: 'records whether the request was persisted first',
      execute: async () => {
        order.push((await store.messages()).at(-1).role);
        return 'ok';
      },
    }),
  ]);
  const adapter = new MockAdapter({ script: [{ text: 'let me check', tool_calls: [call('c1', 'spy')] }, { text: 'done' }] });
  const r = await runTurn(agent, store, adapter, reg, { inbound: user('go') });
  assert.equal(r.status, 'completed');
  assert.deepEqual(order, ['tool_request'], 'tool_request must be written before the tool runs');
  assert.deepEqual((await store.messages()).map((m) => m.role), ['user', 'tool_request', 'tool_response', 'agent']);
  assert.equal(r.steps, 2);
});

test('deferred tool suspends with no tool_response; resumeTurn completes; duplicate is a no-op', async () => {
  const store = new MemoryTranscript();
  const r1 = await runTurn(agent, store, new MockAdapter({ script: [{ tool_calls: [call('a1', 'approve')] }] }), registry(), { inbound: user('do it') });
  assert.equal(r1.status, 'suspended');
  assert.deepEqual(r1.pending_calls.map((c) => c.id), ['a1']);
  assert.ok(!(await store.messages()).some((m) => m.role === 'tool_response'));

  const resumeAdapter = new MockAdapter({ script: [{ text: 'approved and done' }] });
  const r2 = await resumeTurn(agent, store, resumeAdapter, registry(), 'a1', '{"approved":true}');
  assert.equal(r2.status, 'completed');
  // the resumed step saw the REAL response adjacent to its request, not a placeholder
  const seen = resumeAdapter.seenInputs[0].messages;
  assert.equal(seen.find((m) => m.role === 'tool_response').text, '{"approved":true}');

  assert.equal(await resumeTurn(agent, store, resumeAdapter, registry(), 'a1', 'again'), null);
});

test('crash mid-turn resumes from the transcript with byte-identical assembly', async () => {
  const store = new MemoryTranscript();
  const a1 = new MockAdapter({ script: [{ tool_calls: [call('c1', 'echo', { v: 'x' })] }] });
  // "crash": the adapter runs out after the tool round, mid-turn
  await assert.rejects(runTurn(agent, store, a1, registry(), { inbound: user('q') }), /exhausted/);
  const a2 = new MockAdapter({ script: [{ text: 'fine' }] });
  const r = await runTurn(agent, store, a2, registry());
  assert.equal(r.status, 'completed');
  assert.deepEqual(a2.seenInputs[0], assemble(agent, (await store.messages()).slice(0, -1), assemblyPolicy()));
});

test('malformed args: in-band error, one re-ask, then typed failure', async () => {
  const bad = { id: 'b', name: 'echo', args: null, args_raw: '{nope' };
  const store = new MemoryTranscript();
  const ok = await runTurn(agent, store, new MockAdapter({ script: [{ tool_calls: [bad] }, { text: 'recovered' }] }), registry(), { inbound: user('x') });
  assert.equal(ok.status, 'completed');
  const env = JSON.parse((await store.messages()).find((m) => m.role === 'tool_response').text);
  assert.equal(env.error_code, 'malformed_arguments');

  const store2 = new MemoryTranscript();
  const fail = await runTurn(agent, store2, new MockAdapter({ script: [{ tool_calls: [{ ...bad, id: 'b1' }] }, { tool_calls: [{ ...bad, id: 'b2' }] }] }), registry(), {
    inbound: user('x'),
  });
  assert.equal(fail.status, 'failed');
  assert.equal(fail.failure_reason, 'malformed_tool_calls');
});

test('length truncation is never a candidate response', async () => {
  const store = new MemoryTranscript();
  const r = await runTurn(agent, store, new MockAdapter({ script: [{ text: 'cut off mid', stop_reason: 'length' }] }), registry(), { inbound: user('x') });
  assert.equal(r.status, 'failed');
  assert.equal(r.failure_reason, 'length_truncated');
  assert.ok(!(await store.messages()).some((m) => m.role === 'agent'));
});

test('max_tool_steps trips as a typed failure', async () => {
  const script = Array.from({ length: 3 }, (_, i) => ({ tool_calls: [call(`c${i}`, 'echo', { v: 'x' })] }));
  const r = await runTurn(agent, new MemoryTranscript(), new MockAdapter({ script }), registry(), { inbound: user('x'), maxToolSteps: 3 });
  assert.equal(r.status, 'failed');
  assert.equal(r.failure_reason, 'max_tool_steps');
});

test('concluding round: prose beside only concluding calls IS the reply', async () => {
  const store = new MemoryTranscript();
  const adapter = new MockAdapter({ script: [{ text: 'Here is the card.', tool_calls: [call('r1', 'render_card')] }] });
  const r = await runTurn(agent, store, adapter, registry(), { inbound: user('show') });
  assert.equal(r.status, 'completed');
  assert.equal(r.response, 'Here is the card.');
  assert.equal(r.steps, 1);
});

test('concluding round with no prose: next step is offered no tools', async () => {
  const adapter = new MockAdapter({ script: [{ tool_calls: [call('r1', 'render_card')] }, { text: 'Done.' }] });
  const r = await runTurn(agent, new MemoryTranscript(), adapter, registry(), { inbound: user('show') });
  assert.equal(r.status, 'completed');
  assert.equal(adapter.seenTools[1].length, 0);
});

test('ephemeral context is assembled every step but never persisted', async () => {
  const store = new MemoryTranscript();
  const note = message({ role: 'system', text: 'listing: 38/3 Victoria Park Pde' });
  const adapter = new MockAdapter({ script: [{ text: 'ok' }] });
  await runTurn(agent, store, adapter, registry(), { inbound: user('x'), ephemeralContext: [note] });
  assert.equal(adapter.seenInputs[0].messages.at(-1).text, note.text);
  assert.ok(!(await store.messages()).some((m) => m.text === note.text));
});

test('retryable provider errors retry; 4xx propagates without retry', async () => {
  let n = 0;
  const flaky = {
    async complete() {
      n += 1;
      if (n === 1) throw new HttpError(503);
      return { text: 'ok' };
    },
  };
  const events = [];
  const r = await runTurn(agent, new MemoryTranscript(), flaky, registry(), { inbound: user('x'), retry: { backoffS: 0 }, onEvent: (e) => events.push(e.event) });
  assert.equal(r.status, 'completed');
  assert.ok(events.includes('retry'));

  const store = new MemoryTranscript();
  await assert.rejects(
    runTurn(agent, store, { complete: async () => { throw new HttpError(400); } }, registry(), { inbound: user('x'), retry: { backoffS: 0 } }),
    HttpError,
  );
  assert.deepEqual((await store.messages()).map((m) => m.role), ['user'], 'failed step must not touch the transcript');
});

test('unknown tool and invalid args are error outcomes the model can recover from', async () => {
  const store = new MemoryTranscript();
  const adapter = new MockAdapter({ script: [{ tool_calls: [call('u1', 'nope'), call('e1', 'echo', { v: 3 })] }, { text: 'ok' }] });
  const r = await runTurn(agent, store, adapter, registry(), { inbound: user('x') });
  assert.equal(r.status, 'completed');
  const codes = (await store.messages()).filter((m) => m.role === 'tool_response').map((m) => JSON.parse(m.text).error_code);
  assert.deepEqual(codes, ['unknown_tool', 'invalid_arguments']);
});

test('assemble: pending placeholder for unresolved calls, delivery stripped', () => {
  const t = [user('q'), message({ role: 'tool_request', calls: [{ id: 'p', name: 'approve', args: {}, delivery: 'deferred' }] })];
  const a = assemble(agent, t, assemblyPolicy());
  assert.equal(a.messages[2].text, PENDING_PLACEHOLDER);
  assert.equal(a.messages[1].calls[0].delivery, null);
});

test('assemble: token budget keeps newest, marks truncation, keeps tool rounds atomic', () => {
  const long = 'x'.repeat(400);
  const t = [user(long), message({ role: 'agent', text: long }), message({ role: 'tool_request', calls: [{ id: 'k', name: 'echo', args: { v: 'y' } }] }), message({ role: 'tool_response', call_id: 'k', text: 'echo:y' }), user('latest')];
  const a = assemble(agent, t, assemblyPolicy({ max_context_tokens: 40 }));
  assert.equal(a.messages[0].text, TRUNCATION_NOTICE);
  assert.equal(a.messages.at(-1).text, 'latest');
  const i = a.messages.findIndex((m) => m.role === 'tool_request');
  assert.ok(i === -1 || a.messages[i + 1].role === 'tool_response', 'a tool round is never split');
});
