// OpenAI chat/completions dialect — ONE translator for every endpoint speaking it.
// Port of hivemind_runtime/dialects/openai.py. Providers (DeepSeek, OpenRouter, any
// vLLM/Ollama-style server) own only their quirks via the override points.
//
// Owned here:
//   - replay regrouping: agent -> assistant {content, <REASONING_FIELD>?};
//     tool_request -> assistant {+ tool_calls}; tool_response -> tool {tool_call_id}
//   - tool_call arguments arrive as a STRING that may fail JSON.parse — parse failure
//     => args=null, the loop's malformed-call recovery takes over
//   - text + tool_calls can coexist (preamble case)
//   - STREAMING: reasoning/content deltas accumulate independently; tool-call
//     arguments stream as index-keyed fragments re-assembled before the loop sees
//     them; SSE comment/keepalive lines fail the "data: " filter and are ignored
//   - bounded retry with exponential backoff on 429/5xx; other 4xx return at once
//
// Override points: apiUrl, defaultModel, reasoningField, streamOptions, extraBody,
// headers(), resolveModel(), generationParams(), parseUsage().
//
// Browser note: the extension needs host_permissions for the endpoint, and the API
// key is passed in by the host (chrome.storage), never bundled.

import { stepResult, toolCall, usage as newUsage } from '../contract.js';
import { ConnectionError, HttpError } from '../errors.js';

export const STOP_MAP = { stop: 'end', tool_calls: 'tool_use', length: 'length' };
export const MAX_HTTP_ATTEMPTS = 3; // 1 call + 2 retries on 429/5xx
export const SAMPLING_PARAMS = ['temperature', 'top_p', 'presence_penalty', 'frequency_penalty'];
const REQUEST_TIMEOUT_MS = 300_000;

const sleep = (s) => new Promise((resolve) => setTimeout(resolve, s * 1000));

export function parseToolCall(id, name, rawArgs) {
  try {
    const parsed = rawArgs.trim() ? JSON.parse(rawArgs) : {};
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('non-object arguments');
    return toolCall({ id, name, args: parsed });
  } catch {
    return toolCall({ id, name, args: null, args_raw: rawArgs });
  }
}

export class OpenAIDialectAdapter {
  static API_URL = null;
  static DEFAULT_MODEL = null;
  static REASONING_FIELD = 'reasoning';
  static STREAM_OPTIONS = { include_usage: true };
  static EXTRA_BODY = {};

  /**
   * @param {Object} o
   * @param {string} [o.apiUrl]
   * @param {string} o.apiKey
   * @param {boolean} [o.replayReasoning]  false only to prove the replay requirement is real
   * @param {number} [o.backoffS]
   * @param {typeof fetch} [o.fetch]       injectable for tests
   */
  constructor({ apiUrl, apiKey, replayReasoning = true, backoffS = 0.5, fetch: fetchImpl } = {}) {
    this.apiUrl = apiUrl ?? this.constructor.API_URL;
    if (!this.apiUrl) throw new Error('apiUrl is required (no API_URL on this adapter)');
    if (!apiKey) throw new Error('apiKey is required');
    this.apiKey = apiKey;
    this.replayReasoning = replayReasoning;
    this.backoffS = backoffS;
    this.fetch = fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  get reasoningField() {
    return this.constructor.REASONING_FIELD;
  }

  // -- override points ------------------------------------------------------
  headers() {
    return { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' };
  }

  resolveModel(params) {
    const model = params.model ?? this.constructor.DEFAULT_MODEL;
    if (!model) throw new Error('this endpoint requires a model id in params.model');
    return model;
  }

  /** Reasoning/thinking is provider dialect; the base only passes sampling params. */
  generationParams(body, params) {
    this.samplingPassthrough(body, params);
  }

  samplingPassthrough(body, params) {
    for (const p of SAMPLING_PARAMS) if (p in params) body[p] = params[p];
  }

  parseUsage(u) {
    return newUsage({ input_tokens: u.prompt_tokens ?? 0, output_tokens: u.completion_tokens ?? 0 });
  }

  // -- transport ------------------------------------------------------------
  async post(body) {
    let resp;
    for (let attempt = 0; attempt < MAX_HTTP_ATTEMPTS; attempt++) {
      try {
        resp = await this.fetch(this.apiUrl, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (e) {
        throw new ConnectionError(`request to ${this.apiUrl} failed: ${e?.message ?? e}`, e);
      }
      if (resp.status !== 429 && resp.status < 500) return resp;
      if (attempt < MAX_HTTP_ATTEMPTS - 1) await sleep(this.backoffS * 2 ** attempt);
    }
    return resp;
  }

  async raiseForStatus(resp) {
    if (!resp.ok) {
      const body = await resp.text().catch(() => null);
      throw new HttpError(resp.status, body, `HTTP ${resp.status} from ${this.apiUrl}`);
    }
  }

  // -- wire building --------------------------------------------------------
  toWire(assembled) {
    const messages = [{ role: 'system', content: assembled.system }];
    for (const m of assembled.messages) {
      if (m.role === 'user') messages.push({ role: 'user', content: m.text ?? '' });
      else if (m.role === 'system') messages.push({ role: 'system', content: m.text ?? '' });
      else if (m.role === 'agent' || m.role === 'tool_request') {
        const msg = { role: 'assistant', content: m.text ?? '' };
        if (m.reasoning && this.replayReasoning) msg[this.reasoningField] = m.reasoning;
        if (m.calls.length) {
          msg.tool_calls = m.calls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.args_raw ?? JSON.stringify(tc.args ?? {}) },
          }));
        }
        messages.push(msg);
      } else if (m.role === 'tool_response') {
        messages.push({ role: 'tool', tool_call_id: m.call_id, content: m.text ?? '' });
      }
    }
    return messages;
  }

  buildBody(assembled, tools, params) {
    const body = {
      model: this.resolveModel(params),
      messages: this.toWire(assembled),
      max_tokens: params.max_tokens ?? 1024,
      ...this.constructor.EXTRA_BODY,
    };
    this.generationParams(body, params);
    if (tools.length) {
      body.tools = tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
    }
    // structured-output forcing (ask): force a tool, or JSON mode
    if (params.force_tool) body.tool_choice = { type: 'function', function: { name: params.force_tool } };
    if (params.response_format) body.response_format = params.response_format;
    return body;
  }

  // -- entry point ----------------------------------------------------------
  async complete(assembled, tools, params, onDelta = null) {
    const body = this.buildBody(assembled, tools, params);
    if (params.stream && onDelta) return this.stream(body, onDelta);
    return this.blocking(body);
  }

  async blocking(body) {
    const resp = await this.post(body);
    await this.raiseForStatus(resp);
    const data = await resp.json();
    const choice = data.choices[0];
    const msg = choice.message;
    return stepResult({
      text: msg.content || null,
      reasoning: msg[this.reasoningField] || null,
      tool_calls: (msg.tool_calls ?? []).map((tc) => parseToolCall(tc.id, tc.function.name, tc.function.arguments ?? '')),
      usage: this.parseUsage(data.usage ?? {}, body.model),
      stop_reason: STOP_MAP[choice.finish_reason] ?? 'other',
      stop_reason_native: choice.finish_reason ?? null,
      raw: data,
    });
  }

  async stream(body, onDelta) {
    body = { ...body, stream: true };
    if (this.constructor.STREAM_OPTIONS !== null) body.stream_options = this.constructor.STREAM_OPTIONS;
    const textParts = [];
    const reasoningParts = [];
    const calls = new Map(); // index -> {id, name, args}
    let usage = newUsage();
    let finishReason = null;

    const resp = await this.post(body);
    await this.raiseForStatus(resp);

    const handleLine = (line) => {
      if (!line.startsWith('data: ')) return false;
      const payload = line.slice('data: '.length);
      if (payload.trim() === '[DONE]') return true;
      const chunk = JSON.parse(payload);
      if (chunk.usage) usage = this.parseUsage(chunk.usage, body.model);
      const choice = (chunk.choices ?? [])[0];
      if (!choice) return false;
      const delta = choice.delta ?? {};
      if (delta[this.reasoningField]) {
        reasoningParts.push(delta[this.reasoningField]);
        onDelta({ type: 'reasoning', text: delta[this.reasoningField] });
      }
      if (delta.content) {
        textParts.push(delta.content);
        onDelta({ type: 'text', text: delta.content });
      }
      for (const frag of delta.tool_calls ?? []) {
        if (!calls.has(frag.index)) calls.set(frag.index, { id: '', name: '', args: '' });
        const slot = calls.get(frag.index);
        if (frag.id) slot.id = frag.id;
        if (frag.function?.name) slot.name = frag.function.name;
        if (frag.function?.arguments) slot.args += frag.function.arguments;
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
      return false;
    };

    // SSE is UTF-8 by spec; decode with stream:true so multi-byte chars split across
    // chunks survive.
    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let done = false;
    while (!done) {
      const { value, done: eof } = await reader.read();
      if (eof) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) {
        if (line && handleLine(line)) {
          done = true;
          break;
        }
      }
    }
    if (!done && buffer) handleLine(buffer + decoder.decode());
    if (done) await reader.cancel().catch(() => {});

    return stepResult({
      text: textParts.join('') || null,
      reasoning: reasoningParts.join('') || null,
      tool_calls: [...calls.entries()].sort(([a], [b]) => a - b).map(([, s]) => parseToolCall(s.id, s.name, s.args)),
      usage,
      stop_reason: STOP_MAP[finishReason] ?? 'other',
      stop_reason_native: finishReason,
    });
  }
}
