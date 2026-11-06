// Tool harness: registry + err() envelope + delivery declaration.
// Port of hivemind_runtime/registry.py (the Python bundle bridge is replaced by
// tools/declarative.js#declarativeTool, which builds a Tool from a manifest).
//
// Every tool declares delivery "sync" (result within the step loop) or "deferred"
// (turn suspends; result ingested later via resumeTurn). A sync tool is a deferred
// result arriving in zero time — the loop has ONE code path.

import { toolSchema } from './contract.js';
import { errorEnvelope } from './errors.js';
import { toolOutcome } from './loop.js';
import { ToolError } from './tools/errors.js';
import { validate } from './validate.js';

/** The standardised self-healing error envelope. */
export function err(message, { hint = '', retryable = false, error_code = 'tool_error' } = {}) {
  return errorEnvelope(message, { hint, retryable, error_code });
}

/**
 * @typedef {Object} Tool
 * @property {string} name
 * @property {string} description  for the MODEL: when and how to use the tool
 * @property {string|null} label  for PEOPLE: short present-tense activity line ("Checking rentals within 1 km").
 *   Carried on tool events so a UI/activity feed reads as intent, not function names. Never sent to the model.
 * @property {Object} input_schema
 * @property {'sync'|'deferred'} delivery
 * @property {((args: Object) => (string|Promise<string>))|null} execute  null for deferred tools
 * @property {boolean} concludes  display/side-effect tool: prose beside only these calls is the reply
 * @property {boolean} validateArgs  validate args against input_schema before execute (JS addition)
 */

/** @returns {Tool} */
export function tool({ name, description, label = null, input_schema = { type: 'object', properties: {} }, delivery = 'sync', execute = null, concludes = false, validateArgs = true }) {
  if (delivery === 'sync' && typeof execute !== 'function') throw new TypeError(`sync tool ${name} needs execute()`);
  return { name, description, label, input_schema, delivery, execute, concludes, validateArgs };
}

export class ToolRegistry {
  constructor(tools = []) {
    /** @type {Map<string, Tool>} */
    this.tools = new Map();
    for (const t of tools) this.register(t);
  }

  register(t) {
    this.tools.set(t.name, t);
    return this;
  }

  get(name) {
    return this.tools.get(name) ?? null;
  }

  /** People-facing label for a tool (falls back to null; UIs fall back to the name). */
  label(name) {
    return this.tools.get(name)?.label ?? null;
  }

  /** name → label for every registered tool (for rendering stored transcripts). */
  labels() {
    return Object.fromEntries([...this.tools.values()].map((t) => [t.name, t.label ?? null]));
  }

  schemas() {
    return [...this.tools.values()].map((t) => toolSchema(t));
  }

  /**
   * ToolSource.execute. Unknown tools become error OUTCOMES; a deferred tool returns
   * deferred=true so the loop suspends. Exceptions from execute() are the loop's to
   * envelope. JS addition: args are schema-validated first (Python's bundle executor
   * did this; built-ins relied on the model) — invalid args are a retryable error the
   * model can fix in-band.
   */
  async execute(call) {
    const t = this.get(call.name);
    if (!t) {
      return toolOutcome({
        result: err(`unknown tool: ${call.name}`, { hint: 'use one of the provided tools', error_code: 'unknown_tool' }),
        error: true,
      });
    }
    if (t.validateArgs) {
      const problems = validate(t.input_schema, call.args);
      if (problems.length) {
        return toolOutcome({
          result: err(`invalid arguments: ${problems.join('; ')}`, {
            hint: 're-issue the call with arguments matching the tool schema',
            retryable: true,
            error_code: 'invalid_arguments',
          }),
          error: true,
        });
      }
    }
    if (t.delivery === 'deferred') return toolOutcome({ deferred: true });
    try {
      return toolOutcome({ result: await t.execute(call.args), concludes: t.concludes });
    } catch (e) {
      // Typed tool failures are the MODEL's to recover from: envelope + error flag.
      // Anything else is a tool bug — rethrown for the loop to envelope as retryable.
      if (e instanceof ToolError) return toolOutcome({ result: JSON.stringify(e.envelope()), error: true });
      throw e;
    }
  }
}
