// The turn loop — port of hivemind_runtime/loop.py (v0.3.2).
//
// Division of labour (unchanged):
//   - the RUNTIME owns the intra-turn step loop: assemble -> generate ->
//     execute-tools -> repeat, committing every record as it happens
//   - the HOST owns inter-turn flow: judges, regeneration, routing. The loop has
//     no concept of gates; `shouldContinue` (abort-only) is the only host influence
//     inside a turn.
//
// Core invariant — the transcript is the only state. All loop bookkeeping (step
// index, malformed-recovery count, pending calls) is DERIVED from store.messages(),
// never held in loop memory, so any store with messages()/appendMessage() is
// resume-safe. No module-level mutable state => reentrant.
//
// Ported properties:
//   - intent-before-execute: tool_request is written BEFORE any tool runs
//   - deferred tool = NO tool_response written; assemble() injects the pending
//     placeholder, and the turn returns "suspended"
//   - sync tool == a deferred result arriving in zero time (one code path)
//   - max_tokens truncation is NEVER a candidate response — discarded
//   - malformed tool call: error envelope in-band, re-ask once, escalate
//   - tool_calls present => tool round, even with preamble text
//
// JS differences: everything is async (fetch); store methods may return promises;
// option names are camelCase.

import { assemble } from './assemble.js';
import { addUsage, assemblyPolicy, fingerprint, message, stepResult, usage as newUsage } from './contract.js';
import { errorEnvelope, errorInfo } from './errors.js';

export const MAX_TOOL_STEPS = 10;
export const MAX_MALFORMED_RECOVERIES = 1;

/**
 * @typedef {Object} TranscriptStore  minimal persistence contract
 * @property {() => (import('./contract.js').TranscriptMessage[] | Promise<import('./contract.js').TranscriptMessage[]>)} messages
 * @property {(m: import('./contract.js').TranscriptMessage) => (void|Promise<void>)} appendMessage
 *
 * @typedef {Object} ToolOutcome  what ToolSource.execute() returns for one call
 * @property {string|null} result     envelope for the model (an errorEnvelope() when error)
 * @property {boolean} deferred       result arrives later; loop writes NO tool_response
 * @property {boolean} error
 * @property {boolean} concludes      a display/side-effect call needing no further completion
 *
 * @typedef {Object} ToolSource
 * @property {() => import('./contract.js').ToolSchema[]} schemas
 * @property {(call: import('./contract.js').ToolCallReq) => (ToolOutcome|Promise<ToolOutcome>)} execute
 *   must return an outcome for every call (unknown tool = error OUTCOME); if it
 *   throws anyway the loop converts it to a retryable error envelope.
 *
 * @typedef {Object} TurnResult
 * @property {'completed'|'suspended'|'aborted'|'failed'} status
 * @property {string|null} response
 * @property {number} steps
 * @property {import('./contract.js').Usage} usage
 * @property {import('./contract.js').ToolCallReq[]} pending_calls
 * @property {string|null} failure_reason
 * @property {Object|null} failure
 */

/** @returns {ToolOutcome} */
export function toolOutcome({ result = null, deferred = false, error = false, concludes = false } = {}) {
  return { result, deferred, error, concludes };
}

/** @returns {TurnResult} */
function turnResult(r) {
  return {
    status: r.status,
    response: r.response ?? null,
    steps: r.steps ?? 0,
    usage: r.usage ?? newUsage(),
    pending_calls: r.pending_calls ?? [],
    failure_reason: r.failure_reason ?? null,
    failure: r.failure ?? null,
  };
}

export const DEFAULT_RETRY = Object.freeze({ maxAttempts: 3, backoffS: 0.5 });

// ---------------------------------------------------------------------------
// transcript-derived bookkeeping (loop memory is banned)
// ---------------------------------------------------------------------------

/** Monotonic generation-step index — a resumed turn continues the numbering. */
export function stepIndex(messages) {
  return messages.filter((m) => m.role === 'agent' || m.role === 'tool_request').length;
}

/**
 * Malformed-tool-call recoveries in the CURRENT turn. The turn boundary is the last
 * user or agent record; suspend/resume appends neither, so the bound survives it.
 */
export function malformedCount(messages) {
  let count = 0;
  for (const m of messages) {
    if (m.role === 'user' || m.role === 'agent') count = 0;
    else if (m.role === 'tool_response' && m.is_error) {
      try {
        if (JSON.parse(m.text || '{}')?.error_code === 'malformed_arguments') count += 1;
      } catch {
        /* not an envelope */
      }
    }
  }
  return count;
}

function resolvedCallIds(messages) {
  return new Set(messages.filter((m) => m.role === 'tool_response' && m.call_id).map((m) => m.call_id));
}

const sleep = (s) => new Promise((resolve) => setTimeout(resolve, s * 1000));

// ---------------------------------------------------------------------------
// public entry points
// ---------------------------------------------------------------------------

/**
 * Run one turn's step loop to a terminal status.
 *
 * @param {import('./contract.js').AgentSnapshot} snapshot
 * @param {TranscriptStore} store
 * @param {{complete: Function}} adapter
 * @param {ToolSource} tools
 * @param {Object} [opts]
 * @param {import('./contract.js').TranscriptMessage} [opts.inbound]  appended before stepping
 * @param {import('./contract.js').TranscriptMessage[]} [opts.ephemeralContext]  appended to the
 *        END of the assembled view every step, never persisted
 * @param {import('./contract.js').AssemblyPolicy} [opts.policy]
 * @param {(d: Object) => void} [opts.onDelta]   display tap; used only when snapshot.stream
 * @param {(e: Object) => void} [opts.onEvent]   passive observation tap: step | tool | retry | turn
 * @param {() => boolean} [opts.shouldContinue]  checked before each step; false => "aborted"
 * @param {string} [opts.turnId]
 * @param {string} [opts.parentTurnId]
 * @param {{maxAttempts:number, backoffS:number}} [opts.retry]
 * @param {number} [opts.maxToolSteps]
 * @param {number} [opts.maxMalformedRecoveries]
 * @returns {Promise<TurnResult>}
 */
export async function runTurn(snapshot, store, adapter, tools, opts = {}) {
  if (opts.inbound) await store.appendMessage(opts.inbound);
  return stepLoop(snapshot, store, adapter, tools, opts);
}

/**
 * Ingest a deferred tool result (idempotent by call_id) and, if the suspended turn
 * is now unblocked, re-enter the loop. Returns null on duplicate delivery, and null
 * after appending when the turn is still blocked or the call doesn't belong to the
 * most recent tool_request (record-only semantics).
 */
export async function resumeTurn(snapshot, store, adapter, tools, callId, result, opts = {}) {
  if (resolvedCallIds(await store.messages()).has(callId)) return null; // duplicate
  await store.appendMessage(message({ role: 'tool_response', call_id: callId, text: result, is_error: Boolean(opts.isError) }));

  const messages = await store.messages();
  const lastRequest = [...messages].reverse().find((m) => m.role === 'tool_request');
  if (!lastRequest || !lastRequest.calls.some((c) => c.id === callId)) return null;
  const resolved = resolvedCallIds(messages);
  if (lastRequest.calls.some((c) => !resolved.has(c.id))) return null; // still awaiting others
  return stepLoop(snapshot, store, adapter, tools, opts);
}

// ---------------------------------------------------------------------------
// the loop itself
// ---------------------------------------------------------------------------

async function stepLoop(snapshot, store, adapter, tools, opts) {
  const {
    ephemeralContext = [],
    onDelta,
    onEvent,
    shouldContinue,
    turnId,
    parentTurnId,
    maxToolSteps = MAX_TOOL_STEPS,
    maxMalformedRecoveries = MAX_MALFORMED_RECOVERIES,
  } = opts;
  const policy = opts.policy ?? assemblyPolicy();
  const retry = { ...DEFAULT_RETRY, ...(opts.retry ?? {}) };

  const correlation = {};
  if (turnId !== undefined) correlation.turn_id = turnId;
  if (parentTurnId !== undefined) correlation.parent_turn_id = parentTurnId;
  const emit = (payload) => {
    if (onEvent) onEvent({ ...payload, ...correlation });
  };

  const total = newUsage();
  let steps = 0;
  let textOnly = false; // set after a clean concluding round that carried no prose

  const finish = (status, extra = {}) => {
    emit({ event: 'turn', status, steps, usage: { ...total } });
    return turnResult({ status, steps, usage: total, ...extra });
  };

  for (let i = 0; i < maxToolSteps; i++) {
    if (shouldContinue && !shouldContinue()) return finish('aborted');

    const persisted = await store.messages();
    const currentStep = stepIndex(persisted);
    // ephemeral context rides at the END of the assembled view only
    const assembled = assemble(snapshot, [...persisted, ...ephemeralContext], policy);

    let tap = null;
    if (onDelta && snapshot.stream) {
      tap = (delta) => onDelta({ step: currentStep, ...correlation, ...delta });
    }

    // After a concluding round with no prose, offer no tools: the only thing left is the reply.
    const offered = textOnly ? [] : tools.schemas();
    textOnly = false;
    const result = await completeWithRetry(
      adapter,
      assembled,
      offered,
      {
        model: snapshot.model,
        thinking: snapshot.thinking,
        reasoning_effort: snapshot.reasoning_effort,
        stream: snapshot.stream,
        ...snapshot.params,
      },
      tap,
      retry,
      emit,
    );
    steps += 1;
    addUsage(total, result.usage);
    emit({ event: 'step', step: currentStep, model: snapshot.model, usage: { ...result.usage }, fingerprint: await fingerprint(assembled) });

    // max_tokens truncation is NEVER a candidate response
    if (result.stop_reason === 'length') {
      return finish('failed', {
        failure_reason: 'length_truncated',
        failure: {
          code: 'length_truncated',
          retryable: true,
          message: 'max_tokens truncation — step discarded',
          metadata: { stop_reason_native: result.stop_reason_native },
        },
      });
    }

    // A step without tool calls is an agent record — the candidate response.
    if (!result.tool_calls.length) {
      await store.appendMessage(message({ role: 'agent', text: result.text, reasoning: result.reasoning }));
      return finish('completed', { response: result.text });
    }

    // intent-before-execute: the tool_request is written BEFORE anything runs
    await store.appendMessage(message({ role: 'tool_request', text: result.text, reasoning: result.reasoning, calls: result.tool_calls }));

    // tool round — one path for sync/deferred
    const outcomes = [];
    for (const call of result.tool_calls) {
      if (call.args === null) {
        // malformed arguments
        await store.appendMessage(
          message({
            role: 'tool_response',
            call_id: call.id,
            is_error: true,
            text: errorEnvelope('tool call arguments were not valid JSON', {
              hint: 're-issue the tool call with valid JSON arguments',
              retryable: true,
              error_code: 'malformed_arguments',
            }),
          }),
        );
        emit({ event: 'tool', name: call.name, label: tools.label?.(call.name) ?? null, call_id: call.id, deferred: false, error: true });
        continue;
      }
      const label = tools.label?.(call.name) ?? null;
      emit({ event: 'tool_start', name: call.name, label, call_id: call.id, args: call.args });
      let outcome;
      try {
        outcome = toolOutcome(await tools.execute(call));
      } catch (e) {
        // tool bugs become error envelopes
        outcome = toolOutcome({ result: errorEnvelope(String(e?.message ?? e), { retryable: true }), error: true });
      }
      emit({ event: 'tool', name: call.name, label, call_id: call.id, deferred: outcome.deferred, error: outcome.error });
      outcomes.push(outcome);
      if (outcome.deferred) continue; // NO tool_response — assemble injects the pending placeholder
      await store.appendMessage(message({ role: 'tool_response', call_id: call.id, text: outcome.result, is_error: outcome.error }));
    }

    // Concluding round: prose + only clean concluding calls => the prose IS the reply.
    const concludingRound =
      outcomes.length > 0 &&
      outcomes.length === result.tool_calls.length &&
      outcomes.every((o) => o.concludes && !o.deferred && !o.error);
    if (concludingRound && (result.text ?? '').trim()) {
      await store.appendMessage(message({ role: 'agent', text: result.text }));
      return finish('completed', { response: result.text });
    }
    if (concludingRound) textOnly = true;

    // recovery bound derived from the TRANSCRIPT, not loop memory
    if (malformedCount(await store.messages()) > maxMalformedRecoveries) {
      return finish('failed', {
        failure_reason: 'malformed_tool_calls',
        failure: { code: 'malformed_tool_calls', retryable: false, message: 'model exceeded the malformed-arguments re-ask bound' },
      });
    }

    // suspend only on THIS step's own unresolved calls
    const resolved = resolvedCallIds(await store.messages());
    const pending = result.tool_calls.filter((c) => !resolved.has(c.id));
    if (pending.length) return finish('suspended', { pending_calls: pending });
    // all results in — next step re-assembles from the transcript
  }

  return finish('failed', {
    failure_reason: 'max_tool_steps',
    failure: { code: 'max_tool_steps', retryable: false, message: `turn exceeded ${maxToolSteps} tool steps` },
  });
}

/**
 * One generation step with transient-error retry. Retries re-send the SAME assembled
 * input — safe because a failed attempt commits nothing. When the budget is exhausted
 * the ORIGINAL error propagates; the transcript is untouched by the failed step.
 */
async function completeWithRetry(adapter, assembled, schemas, params, tap, retry, emit) {
  let attempt = 1;
  for (;;) {
    try {
      return stepResult(await adapter.complete(assembled, schemas, params, tap));
    } catch (e) {
      const info = errorInfo(e);
      if (!info.retryable || attempt >= retry.maxAttempts) throw e;
      emit({ event: 'retry', attempt, reason: info.code });
      await sleep(retry.backoffS * 2 ** (attempt - 1));
      attempt += 1;
    }
  }
}
