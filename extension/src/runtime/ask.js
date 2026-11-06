// ask — the ONE-SHOT primitive. Port of hivemind_runtime/ask.py.
//
// Pure runtime: no storage, no transcript — a stateless call over the provider layer.
//   ask(adapter, instruction, inputText, params)                 -> {text}
//   ask(adapter, instruction, inputText, params, {schema})       -> {data} validated
//
// The forcing mechanism is DERIVED, never chosen (thinking mode 400s on forced
// tool_choice):  thinking off -> "tool" (one forced tool whose input schema IS the
// output schema);  thinking on -> "json" (response_format json_object + schema +
// example in the prompt, leaning on validate-and-retry).
// Schema mismatches go back in-band as a user turn; bounded by maxAttempts.
// Spend survives a throw: accumulated usage rides the error as `error.usage`.

import { addUsage, message, usage as newUsage } from './contract.js';
import { validate } from './validate.js';

export const RESULT_TOOL = 'emit_result';

function attachUsage(e, total) {
  if (e && typeof e === 'object') {
    if (e.usage && typeof e.usage === 'object') addUsage(total, e.usage);
    e.usage = total;
  }
}

function extract(mechanism, step) {
  if (mechanism === 'tool') {
    if (!step.tool_calls.length) return [null, 'no tool call was emitted'];
    const call = step.tool_calls[0];
    if (call.args === null) return [null, `tool arguments were not valid JSON: ${(call.args_raw ?? '').slice(0, 200)}`];
    return [call.args, null];
  }
  let text = (step.text ?? '').trim();
  if (text.startsWith('```')) {
    text = text.replace(/^`+|`+$/g, '');
    if (text.startsWith('json')) text = text.slice(4);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return [null, `output was not valid JSON: ${e.message}`];
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return [null, 'output JSON was not an object'];
  return [data, null];
}

/**
 * @returns {Promise<{data: Object|null, text: string|null, attempts: number,
 *   usage: import('./contract.js').Usage, mechanism: string, latency_s: number, error: string|null}>}
 */
export async function ask(adapter, instruction, inputText, params, { schema = null, mechanism = null, example = null, maxAttempts = 3 } = {}) {
  const start = Date.now();
  const total = newUsage();
  const result = (r) => ({ data: null, text: null, attempts: 1, usage: total, mechanism: 'none', error: null, latency_s: (Date.now() - start) / 1000, ...r });

  if (schema === null) {
    // prose one-shot — a bare generate, no retry loop
    let step;
    try {
      step = await adapter.complete({ system: instruction, messages: [message({ role: 'user', text: inputText })] }, [], { ...params });
    } catch (e) {
      attachUsage(e, total);
      throw e;
    }
    addUsage(total, step.usage);
    return result({ text: step.text });
  }

  mechanism ??= params.thinking ? 'json' : 'tool';
  let system;
  let tools;
  let callParams;
  if (mechanism === 'tool') {
    system = `${instruction}\n\nReturn your result by calling the \`${RESULT_TOOL}\` tool.`;
    tools = [{ name: RESULT_TOOL, description: 'Emit the structured result.', input_schema: schema }];
    callParams = { ...params, force_tool: RESULT_TOOL };
  } else if (mechanism === 'json') {
    system = `${instruction}\n\nReturn your result as a single JSON object matching this JSON Schema exactly — no prose, no code fences:\n${JSON.stringify(schema)}`;
    if (example !== null) system += `\n\nExample of the desired output shape:\n${JSON.stringify(example)}`;
    tools = [];
    callParams = { ...params, response_format: { type: 'json_object' } };
  } else {
    throw new Error(`unknown mechanism: ${mechanism}`);
  }

  let messages = [message({ role: 'user', text: inputText })];
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let step;
    try {
      step = await adapter.complete({ system, messages }, tools, callParams);
    } catch (e) {
      attachUsage(e, total); // earlier attempts already burned tokens
      throw e;
    }
    addUsage(total, step.usage);

    const [data, extractError] = extract(mechanism, step);
    const errors = extractError ? [extractError] : validate(schema, data);
    if (!errors.length) return result({ data, attempts: attempt, mechanism });

    lastError = errors.join('; ');
    const previous = data ? JSON.stringify(data) : (step.text ?? '').slice(0, 500);
    messages = [...messages, message({ role: 'user', text: `Your previous attempt was:\n${previous}\nIt failed validation:\n${lastError}\nReturn a corrected result.` })];
  }
  return result({ data: null, attempts: maxAttempts, mechanism, error: lastError });
}
