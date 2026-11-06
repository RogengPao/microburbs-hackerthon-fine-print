import assert from 'node:assert/strict';
import { test } from 'node:test';

import { adapterFor, ask, DeepSeekAdapter, message, MockAdapter, OpenRouterAdapter } from '../src/runtime/index.js';

const assembled = {
  system: 'sys',
  messages: [
    message({ role: 'user', text: 'q' }),
    message({ role: 'tool_request', text: 'checking', reasoning: 'think', calls: [{ id: 'c1', name: 'f', args: { a: 1 } }] }),
    message({ role: 'tool_response', call_id: 'c1', text: 'r' }),
  ],
};

function captureFetch(json) {
  const fn = async (url, init) => {
    fn.body = JSON.parse(init.body);
    return new Response(JSON.stringify(json), { status: 200 });
  };
  return fn;
}

test('DeepSeek: explicit thinking state, reasoning_content replayed, cost priced', async () => {
  const fetch = captureFetch({
    choices: [{ message: { content: 'ok', reasoning_content: 'r' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 1_000_000, completion_tokens: 0, prompt_cache_hit_tokens: 0 },
  });
  const a = new DeepSeekAdapter({ apiKey: 'k', fetch });
  const step = await a.complete(assembled, [], { model: 'deepseek-chat', thinking: false, temperature: 0.2 });
  assert.deepEqual(fetch.body.thinking, { type: 'disabled' });
  assert.equal(fetch.body.temperature, 0.2);
  assert.equal(fetch.body.messages[2].reasoning_content, 'think');
  assert.equal(fetch.body.messages[3].role, 'tool');
  assert.equal(step.reasoning, 'r');
  assert.ok(Math.abs(step.usage.cost - 0.27) < 1e-9);

  await a.complete(assembled, [], { model: 'deepseek-chat', thinking: true, temperature: 0.2 });
  assert.deepEqual(fetch.body.thinking, { type: 'enabled' });
  assert.equal(fetch.body.temperature, undefined, 'sampling params omitted in thinking mode');
});

test('malformed tool-call arguments parse to args=null with args_raw kept', async () => {
  const fetch = captureFetch({ choices: [{ message: { content: null, tool_calls: [{ id: 't', function: { name: 'f', arguments: '{bad' } }] }, finish_reason: 'tool_calls' }] });
  const step = await new DeepSeekAdapter({ apiKey: 'k', fetch }).complete(assembled, [], {});
  assert.equal(step.tool_calls[0].args, null);
  assert.equal(step.tool_calls[0].args_raw, '{bad');
  assert.equal(step.stop_reason, 'tool_use');
});

test('OpenRouter: model required, usage.include sent, effort max -> high, wire cost used', async () => {
  const fetch = captureFetch({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }], usage: { prompt_tokens: 3, completion_tokens: 1, cost: 0.0042 } });
  const a = new OpenRouterAdapter({ apiKey: 'k', fetch, appTitle: 'Fine Print' });
  await assert.rejects(a.complete(assembled, [], {}), /namespaced model/);
  const step = await a.complete(assembled, [], { model: 'deepseek/deepseek-chat', thinking: true, reasoning_effort: 'max' });
  assert.deepEqual(fetch.body.usage, { include: true });
  assert.deepEqual(fetch.body.reasoning, { effort: 'high' });
  assert.equal(step.usage.cost, 0.0042);
});

test('streaming: deltas tapped, tool-call fragments reassembled, keepalives + split UTF-8 survive', async () => {
  const sse = [
    ': OPENROUTER PROCESSING\n',
    'data: {"choices":[{"delta":{"reasoning":"hm"}}]}\n',
    'data: {"choices":[{"delta":{"content":"25°"}}]}\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c","function":{"name":"f","arguments":"{\\"a\\""}}]}}]}\n',
    'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":":1}"}}]},"finish_reason":"tool_calls"}]}\n',
    'data: {"choices":[],"usage":{"prompt_tokens":5,"completion_tokens":2}}\n',
    'data: [DONE]\n',
  ].join('');
  const bytes = new TextEncoder().encode(sse);
  const cut = sse.indexOf('°') + 1; // split inside the multi-byte degree sign
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(bytes.slice(0, cut));
      c.enqueue(bytes.slice(cut));
      c.close();
    },
  });
  const fetch = async () => new Response(stream, { status: 200 });
  const deltas = [];
  const step = await new OpenRouterAdapter({ apiKey: 'k', fetch }).complete(assembled, [], { model: 'x/y', stream: true }, (d) => deltas.push(d));
  assert.equal(step.text, '25°');
  assert.equal(step.reasoning, 'hm');
  assert.deepEqual(step.tool_calls[0].args, { a: 1 });
  assert.equal(step.usage.input_tokens, 5);
  assert.deepEqual(deltas.map((d) => d.type), ['reasoning', 'text']);
});

test('ask: tool mechanism validates, retries in-band, accumulates usage', async () => {
  const schema = { type: 'object', properties: { verdict: { type: 'string', enum: ['pass', 'buy'] } }, required: ['verdict'] };
  const adapter = new MockAdapter({
    script: [
      { tool_calls: [{ id: '1', name: 'emit_result', args: { verdict: 'maybe' } }], usage: { input_tokens: 5 } },
      { tool_calls: [{ id: '2', name: 'emit_result', args: { verdict: 'pass' } }], usage: { input_tokens: 7 } },
    ],
  });
  const r = await ask(adapter, 'judge it', 'listing', { thinking: false }, { schema });
  assert.deepEqual(r.data, { verdict: 'pass' });
  assert.equal(r.attempts, 2);
  assert.equal(r.usage.input_tokens, 12);
  assert.equal(adapter.seenParams[0].force_tool, 'emit_result');
});

test('adapterFor resolves by name and rejects unknown providers', () => {
  assert.ok(adapterFor('deepseek', { apiKey: 'k' }) instanceof DeepSeekAdapter);
  assert.throws(() => adapterFor('nope'), /unknown provider/);
});
