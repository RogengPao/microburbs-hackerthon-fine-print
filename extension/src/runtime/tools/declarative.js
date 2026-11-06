// Declarative tools — port of tools/declarative.py + the declarative half of
// tools/manifest.py. The DEFAULT tool path: a manifest describes one HTTP request;
// there is no code to isolate.
//
// Template language (deliberately small):
//   {{args.<path>}}            model-supplied, already schema-validated
//   {{context.<path>}}         host-injected projection (the model can't reach it)
//   {{secret:<name>}}          resolved via SecretProvider; must be declared
//   {{secret:<name>.<field>}}  one field of a multi-field credential
// `args.` is the only namespace the model fills. Rendering is SINGLE-PASS: a
// substituted value is never re-scanned, so a model argument containing
// "{{secret:x}}" is inert text. Missing refs: dropped in `query` (optional arg =>
// omitted param), a typed error anywhere else.
//
// Not ported: kind "code" (Python sandbox — not applicable in a browser) and kind
// "ask" (use ask() from a regular tool instead).

import { tool } from '../registry.js';
import { AllowlistEgressPolicy, effectiveHosts } from './egress.js';
import { ManifestError, TemplateError, ToolError, ToolTimeoutError, UpstreamError } from './errors.js';
import { AllowlistHttpClient } from './http.js';
import { resolveSecrets } from './secrets.js';

export const MAX_SYNC_TIMEOUT_SECONDS = 30; // the binding constraint is the human waiting

const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_.:[\]-]+?)\s*\}\}/g;
export const MISSING = Symbol('missing');

// ---------------------------------------------------------------------------
// manifest
// ---------------------------------------------------------------------------

/**
 * Load-time gate: a malformed manifest fails the LOAD, never a live turn.
 * @returns the manifest with defaults applied
 */
export function parseManifest(raw) {
  const fail = (msg) => {
    throw new ManifestError(`invalid tool manifest: ${msg}`, { hint: 'fix the tool manifest' });
  };
  if (!raw || typeof raw !== 'object') fail('manifest must be an object');
  const m = {
    kind: 'declarative',
    effect: 'read',
    delivery: 'sync',
    idempotent: null,
    timeout_seconds: 30,
    secrets: [],
    allowed_hosts: [],
    input_schema: { type: 'object', properties: {} },
    ...raw,
  };
  if (typeof m.name !== 'string' || !m.name) fail('`name` is required');
  if (typeof m.description !== 'string' || !m.description) fail(`tool ${m.name}: \`description\` is required`);
  if (m.kind !== 'declarative') fail(`tool ${m.name}: only kind 'declarative' is supported in the browser runtime`);
  if (!m.request || typeof m.request.url !== 'string') fail(`tool ${m.name}: kind 'declarative' requires request.url`);
  m.request = { method: 'GET', query: {}, headers: {}, json: null, response: {}, ...m.request };
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(m.request.method)) fail(`tool ${m.name}: bad request.method`);
  const shapeKeys = Object.keys(m.request.response);
  if (shapeKeys.some((k) => !['select', 'fields', 'limit'].includes(k))) fail(`tool ${m.name}: response accepts only select/fields/limit`);
  if (m.request.response.limit !== undefined && !(Number.isInteger(m.request.response.limit) && m.request.response.limit >= 1)) {
    fail(`tool ${m.name}: response.limit must be an integer >= 1`);
  }
  if (!['read', 'write', 'long_running'].includes(m.effect)) fail(`tool ${m.name}: bad effect`);
  if (!['sync', 'async'].includes(m.delivery)) fail(`tool ${m.name}: bad delivery`);
  if (m.effect === 'long_running' && m.delivery !== 'async') fail(`tool ${m.name}: effect 'long_running' requires delivery 'async'`);
  if (!(Number.isInteger(m.timeout_seconds) && m.timeout_seconds >= 1)) fail(`tool ${m.name}: timeout_seconds must be an integer >= 1`);
  if (m.delivery === 'sync' && m.timeout_seconds > MAX_SYNC_TIMEOUT_SECONDS) {
    fail(`tool ${m.name}: sync timeout_seconds must be <= ${MAX_SYNC_TIMEOUT_SECONDS}`);
  }
  // idempotent is load-bearing: defaults true only for read; a write must state it
  if (m.idempotent === null) {
    if (m.effect === 'read') m.idempotent = true;
    else fail(`tool ${m.name}: effect ${m.effect} must declare \`idempotent\` explicitly`);
  }
  return m;
}

// ---------------------------------------------------------------------------
// rendering
// ---------------------------------------------------------------------------

/** Dotted traversal over objects and arrays — `data.items.0.name`. */
export function walk(value, path) {
  let current = value;
  for (const part of path.split('.')) {
    if (part === '') return MISSING;
    if (Array.isArray(current)) {
      if (!/^-?\d+$/.test(part)) return MISSING;
      let i = Number(part);
      if (i < 0) i += current.length;
      if (i < 0 || i >= current.length) return MISSING;
      current = current[i];
    } else if (current !== null && typeof current === 'object') {
      if (!Object.prototype.hasOwnProperty.call(current, part)) return MISSING;
      current = current[part];
    } else {
      return MISSING;
    }
  }
  return current;
}

export function resolveReference(ref, args, context, secrets) {
  if (ref.startsWith('secret:')) {
    // the FIRST dot separates the credential name from a field name
    const rest = ref.slice('secret:'.length);
    const dot = rest.indexOf('.');
    const name = dot === -1 ? rest : rest.slice(0, dot);
    const field = dot === -1 ? '' : rest.slice(dot + 1);
    try {
      return field ? secrets.field(name, field) : secrets.value(name);
    } catch (e) {
      if (e instanceof ToolError) throw new TemplateError(e.message, { hint: e.hint });
      throw e;
    }
  }
  const dot = ref.indexOf('.');
  const root = dot === -1 ? ref : ref.slice(0, dot);
  const rest = dot === -1 ? '' : ref.slice(dot + 1);
  if (root === 'args') return rest ? walk(args, rest) : args;
  if (root === 'context') return rest ? walk(context, rest) : context;
  throw new TemplateError(`unknown template reference ${JSON.stringify(ref)}`, { hint: 'references must start with args., context. or secret:' });
}

function renderString(text, args, context, secrets) {
  const matches = [...text.matchAll(PLACEHOLDER)];
  if (!matches.length) return text;
  // a string that is EXACTLY one placeholder keeps the referenced value's type
  if (matches.length === 1 && matches[0][0] === text.trim()) return resolveReference(matches[0][1], args, context, secrets);
  return text.replace(PLACEHOLDER, (_, ref) => {
    const v = resolveReference(ref, args, context, secrets);
    return v === MISSING ? '' : String(v);
  });
}

/** Recursive, single-pass. Returns MISSING for exactly one unresolvable placeholder. */
export function render(value, args, context, secrets) {
  if (typeof value === 'string') return renderString(value, args, context, secrets);
  if (Array.isArray(value)) return value.map((v) => render(v, args, context, secrets)).filter((v) => v !== MISSING);
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const r = render(v, args, context, secrets);
      if (r !== MISSING) out[k] = r;
    }
    return out;
  }
  return value;
}

function required(value, where, template) {
  if (value === MISSING) {
    throw new TemplateError(`could not render the ${where} — a required value was missing`, {
      hint: "check the tool's input schema and the injected context",
      template,
    });
  }
  return value;
}

// ---------------------------------------------------------------------------
// response shaping — three knobs, not a query language
// ---------------------------------------------------------------------------

function project(item, fields) {
  const out = {};
  for (const [name, path] of Object.entries(fields)) {
    const found = walk(item, path);
    out[name] = found === MISSING ? null : found;
  }
  return out;
}

/** Always returns an object; a list becomes {items, count}. */
export function shapeResponse(body, shape = {}) {
  let value = body;
  if (shape.select) {
    value = walk(body, shape.select);
    if (value === MISSING) throw new UpstreamError(`upstream response has no ${JSON.stringify(shape.select)}`, { hint: 'the upstream shape may have changed' });
  }
  if (Array.isArray(value)) {
    if (shape.limit !== undefined) value = value.slice(0, shape.limit);
    if (shape.fields) value = value.map((item) => project(item, shape.fields));
    return { items: value, count: value.length };
  }
  if (shape.fields) value = project(value, shape.fields);
  if (value !== null && typeof value === 'object') return value;
  return { result: value };
}

// ---------------------------------------------------------------------------
// execution
// ---------------------------------------------------------------------------

export function buildRequest(template, args, context, secrets) {
  let url = required(render(template.url, args, context, secrets), 'URL', template.url);
  if (typeof url !== 'string') url = String(url);
  const query = {};
  for (const [k, v] of Object.entries(template.query ?? {})) {
    const r = render(v, args, context, secrets);
    if (r !== MISSING && r !== null && r !== undefined) query[k] = r;
  }
  const headers = {};
  for (const [k, v] of Object.entries(template.headers ?? {})) {
    headers[k] = String(required(render(v, args, context, secrets), `${k} header`, String(v)));
  }
  let body = null;
  if (template.json !== null && template.json !== undefined) body = required(render(template.json, args, context, secrets), 'request body', 'json');
  return { method: template.method, url, params: query, headers, json: body };
}

function redact(text, secrets) {
  for (const v of secrets.allValues()) text = text.split(v).join('***');
  return text;
}

export async function executeDeclarative(template, { args, context, secrets, http }) {
  const req = buildRequest(template, args, context, secrets);
  const resp = await http.request(req.method, req.url, { params: req.params, headers: req.headers, json: req.json });
  if (!resp.ok) {
    throw new UpstreamError(`upstream returned HTTP ${resp.status}`, {
      hint: 'the request was rejected by the upstream system',
      retryable: resp.status === 429 || resp.status >= 500,
      status: resp.status,
      body: redact(resp.text.slice(0, 300), secrets),
    });
  }
  return shapeResponse(resp.json(), template.response);
}

/**
 * Build a registry Tool from a declarative manifest. `context` is bound HERE, by the
 * host — by the time a tool call exists the projection is already closed over,
 * which is why the model cannot reach it.
 *
 * @param {Object} raw  manifest
 * @param {Object} o
 * @param {{get: Function, getFields?: Function}} o.secretProvider
 * @param {Object} [o.context]
 * @param {{allows: Function}} [o.egressPolicy]  host policy; defaults to the manifest's own hosts
 * @param {typeof fetch} [o.fetch]
 */
export function declarativeTool(raw, { secretProvider, context = {}, egressPolicy = null, fetch: fetchImpl, credentials = 'omit' } = {}) {
  const m = parseManifest(raw);
  const hosts = effectiveHosts(m.allowed_hosts, egressPolicy ?? new AllowlistEgressPolicy(m.allowed_hosts));
  return tool({
    name: m.name,
    description: m.description,
    label: typeof raw.label === 'string' ? raw.label : null,
    input_schema: m.input_schema,
    // async delivery = the turn suspends; the host fetches and calls resumeTurn
    delivery: m.delivery === 'sync' ? 'sync' : 'deferred',
    execute:
      m.delivery === 'sync'
        ? async (args) => {
            const started = Date.now();
            const secrets = await resolveSecrets(secretProvider, m.secrets);
            const http = new AllowlistHttpClient(hosts, { timeoutS: m.timeout_seconds, deadline: started + m.timeout_seconds * 1000, fetch: fetchImpl, credentials });
            const result = await executeDeclarative(m.request, { args, context, secrets, http });
            // never return a late success: the tool's budget is binding
            if (Date.now() - started > m.timeout_seconds * 1000) throw new ToolTimeoutError(`${m.name} exceeded its ${m.timeout_seconds}s budget`);
            return JSON.stringify(result);
          }
        : null,
  });
}
