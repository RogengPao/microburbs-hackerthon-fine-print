// assemble(snapshot, transcript, policy) -> AssembledInput
// Port of hivemind_runtime/assemble.py. Pure and deterministic: no I/O, no clock,
// no randomness — same inputs => same output.
//
// Model-view normalisation: provider wire formats require every assistant tool_call
// to be answered by an adjacent tool message. So the model view (a) re-places each
// tool_response right after its tool_request, and (b) gives any UNRESOLVED call a
// synthetic "pending" placeholder (never persisted), so a parked call never makes a
// later turn's replay wire-illegal.

import { message } from './contract.js';

export const PENDING_PLACEHOLDER = JSON.stringify({
  status: 'pending',
  note: 'result not yet available (e.g. awaiting human approval); do not assume the action happened',
});

// Constant on purpose: identical inputs must fingerprint identically.
export const TRUNCATION_NOTICE = '[earlier conversation truncated]';

const CHARS_PER_TOKEN = 4;
const PER_MESSAGE_OVERHEAD_TOKENS = 4;

/** Deterministic token ESTIMATE (len / 4) — a safety margin, not a tokenizer. */
export function estimateTokens(text) {
  return Math.floor(text.length / CHARS_PER_TOKEN);
}

/** Sorted-keys JSON so equal objects estimate equally. */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(', ')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}: ${stableStringify(value[k])}`).join(', ')}}`;
  }
  return JSON.stringify(value);
}

export function estimateMessageTokens(m) {
  let chars = (m.text ?? '').length + (m.reasoning ?? '').length;
  for (const c of m.calls) {
    chars += c.name.length;
    if (c.args !== null) chars += stableStringify(c.args).length;
    else if (c.args_raw !== null) chars += c.args_raw.length;
  }
  return Math.floor(chars / CHARS_PER_TOKEN) + PER_MESSAGE_OVERHEAD_TOKENS;
}

/** Strip host-side annotations (delivery) — assembled input is model-visible data only. */
function strip(m) {
  if (m.role === 'tool_request' && m.calls.some((c) => c.delivery)) {
    return { ...m, calls: m.calls.map((c) => ({ ...c, delivery: null })) };
  }
  return m;
}

function modelView(transcript) {
  const responses = new Map();
  for (const m of transcript) {
    if (m.role === 'tool_response' && m.call_id && !responses.has(m.call_id)) responses.set(m.call_id, m);
  }
  const out = [];
  for (const m of transcript) {
    if (m.role === 'tool_response') continue; // re-placed adjacent to their request
    out.push(strip(m));
    if (m.role === 'tool_request') {
      for (const c of m.calls) {
        out.push(responses.get(c.id) ?? message({ role: 'tool_response', call_id: c.id, text: PENDING_PLACEHOLDER }));
      }
    }
  }
  return out;
}

/** A tool_request plus its adjacent tool_responses is ONE keep-or-drop unit. */
function atomicUnits(view) {
  const units = [];
  let i = 0;
  while (i < view.length) {
    const unit = [view[i]];
    if (view[i].role === 'tool_request') {
      let j = i + 1;
      while (j < view.length && view[j].role === 'tool_response') unit.push(view[j++]);
      i = j;
    } else {
      i += 1;
    }
    units.push(unit);
  }
  return units;
}

/**
 * Newest-first retention under an estimated token budget. The system prompt counts
 * but is never dropped; the window is contiguous; the newest unit is always kept;
 * output stays chronological; a constant truncation marker opens a trimmed window.
 */
function windowByTokenBudget(view, system, maxContextTokens) {
  const units = atomicUnits(view);
  let used = estimateTokens(system);
  const keptNewestFirst = [];
  for (let k = units.length - 1; k >= 0; k--) {
    const cost = units[k].reduce((sum, m) => sum + estimateMessageTokens(m), 0);
    if (keptNewestFirst.length && used + cost > maxContextTokens) break;
    keptNewestFirst.push(units[k]);
    used += cost;
  }
  const windowed = keptNewestFirst.reverse().flat();
  if (keptNewestFirst.length < units.length) {
    windowed.unshift(message({ role: 'system', text: TRUNCATION_NOTICE }));
  }
  return windowed;
}

/** @returns {import('./contract.js').AssembledInput} */
export function assemble(snapshot, transcript, policy) {
  const system = [snapshot.system_base, snapshot.system_overlay].filter(Boolean).join('\n\n');
  let window = modelView(transcript.slice(-policy.max_messages));
  if (policy.max_context_tokens !== null) {
    window = windowByTokenBudget(window, system, policy.max_context_tokens);
  }
  return { system, messages: window };
}
