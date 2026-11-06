// The versioned step/turn contract — JS port of hivemind_runtime/contract.py (v0.3.2).
//
// Everything the runtime touches is in these shapes. Python uses pydantic models;
// here they are plain objects built by factory functions, so defaults are applied
// in one place and key order is stable (assembly fingerprints depend on it).
//
// Runtime invariants (unchanged from Python): no storage, no secrets in messages,
// network = provider APIs + declared tool hosts only, deterministic assembly,
// usage returned never recorded, errors typed and returned.

export const SCHEMA_VERSION = 'poc-1';

/** @typedef {'user'|'system'|'agent'|'tool_request'|'tool_response'} Role */

/**
 * @typedef {Object} ToolCallReq
 * @property {string} id
 * @property {string} name
 * @property {Object|null} args       null when the provider returned unparseable arguments
 * @property {string|null} args_raw   raw string kept when parsing failed
 * @property {'sync'|'deferred'|null} delivery  host annotation; stripped from the model view
 */

/**
 * @typedef {Object} TranscriptMessage
 * Typed by MEANING, not provider wire role (see Python docstring):
 *   user -> user turn; system -> host-injected notice; agent -> candidate reply
 *   (the only record a send stage may consider); tool_request -> assistant turn with
 *   calls (one record per step); tool_response -> answers tool_request.calls[].id
 * @property {Role} role
 * @property {string|null} text
 * @property {string|null} reasoning   must live in the transcript: DeepSeek thinking mode
 *                                     requires it replayed during tool rounds
 * @property {ToolCallReq[]} calls     tool_request only
 * @property {string|null} call_id     tool_response only
 * @property {boolean} is_error        tool_response error envelope flag
 */

/**
 * @typedef {Object} Usage
 * @property {number} input_tokens
 * @property {number} output_tokens
 * @property {number} cache_read_tokens
 * @property {number} cache_write_tokens
 * @property {number|null} cost   USD when the adapter knows the rate, else null
 */

/**
 * @typedef {Object} StepResult  what adapter.complete() returns
 * @property {string|null} text
 * @property {string|null} reasoning
 * @property {ToolCallReq[]} tool_calls   present => tool round, regardless of text
 * @property {Usage} usage
 * @property {'end'|'tool_use'|'length'|'other'} stop_reason
 * @property {string|null} stop_reason_native
 * @property {Object|null} raw
 */

/**
 * @typedef {Object} ToolSchema
 * @property {string} name
 * @property {string} description
 * @property {Object} input_schema   JSON Schema
 */

/**
 * @typedef {Object} AgentSnapshot  the slice of the bundle one turn needs; pinned for the turn
 * @property {string} agent_version
 * @property {string} name
 * @property {'deepseek'|'openrouter'|'mock'} provider
 * @property {string} model
 * @property {Object} params
 * @property {boolean} thinking
 * @property {'high'|'max'|null} reasoning_effort
 * @property {boolean} stream          display-tap streaming
 * @property {string} system_base
 * @property {string} system_overlay
 */

/**
 * @typedef {Object} AssemblyPolicy
 * @property {number} max_messages            caps the raw transcript slice
 * @property {number|null} max_context_tokens estimated token budget over the model view
 */

/**
 * @typedef {Object} AssembledInput  exactly what generate() receives
 * @property {string} system
 * @property {TranscriptMessage[]} messages
 */

const ROLES = new Set(['user', 'system', 'agent', 'tool_request', 'tool_response']);

/** @returns {ToolCallReq} */
export function toolCall({ id, name, args = null, args_raw = null, delivery = null }) {
  if (typeof id !== 'string' || typeof name !== 'string') {
    throw new TypeError('toolCall requires string id and name');
  }
  return { id, name, args, args_raw, delivery };
}

/** @returns {TranscriptMessage} */
export function message({ role, text = null, reasoning = null, calls = [], call_id = null, is_error = false }) {
  if (!ROLES.has(role)) throw new TypeError(`unknown transcript role: ${role}`);
  return { role, text, reasoning, calls: calls.map(toolCall), call_id, is_error };
}

/** @returns {Usage} */
export function usage(u = {}) {
  return {
    input_tokens: u.input_tokens ?? 0,
    output_tokens: u.output_tokens ?? 0,
    cache_read_tokens: u.cache_read_tokens ?? 0,
    cache_write_tokens: u.cache_write_tokens ?? 0,
    cost: u.cost ?? null,
  };
}

/** Accumulate `step` into `total` in place. Cost stays null only if no step priced. */
export function addUsage(total, step) {
  total.input_tokens += step.input_tokens;
  total.output_tokens += step.output_tokens;
  total.cache_read_tokens += step.cache_read_tokens;
  total.cache_write_tokens += step.cache_write_tokens;
  if (step.cost !== null && step.cost !== undefined) total.cost = (total.cost ?? 0) + step.cost;
}

/** @returns {StepResult} */
export function stepResult(r = {}) {
  return {
    text: r.text ?? null,
    reasoning: r.reasoning ?? null,
    tool_calls: (r.tool_calls ?? []).map(toolCall),
    usage: usage(r.usage),
    stop_reason: r.stop_reason ?? 'end',
    stop_reason_native: r.stop_reason_native ?? null,
    raw: r.raw ?? null,
  };
}

/** @returns {AgentSnapshot} */
export function agentSnapshot(a) {
  return {
    agent_version: a.agent_version,
    name: a.name,
    provider: a.provider,
    model: a.model,
    params: a.params ?? {},
    thinking: a.thinking ?? false,
    reasoning_effort: a.reasoning_effort ?? null,
    stream: a.stream ?? false,
    system_base: a.system_base ?? '',
    system_overlay: a.system_overlay ?? '',
  };
}

/** @returns {AssemblyPolicy} */
export function assemblyPolicy(p = {}) {
  return { max_messages: p.max_messages ?? 200, max_context_tokens: p.max_context_tokens ?? null };
}

/** @returns {ToolSchema} */
export function toolSchema({ name, description, input_schema }) {
  return { name, description, input_schema };
}

/**
 * sha256 of the assembled input, first 16 hex chars — for determinism checks.
 * Async because WebCrypto is. Same inputs => same fingerprint (JS-internal;
 * not byte-compatible with the Python fingerprint).
 */
export async function fingerprint(assembled) {
  const bytes = new TextEncoder().encode(JSON.stringify(assembled));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
