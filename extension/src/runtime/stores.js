// Transcript stores — port of hivemind_runtime/stores.py.
//
// Same flat record format as the Python JSONL store, one record per append:
//   {time: <epoch ms>, type: user|system|agent|tool_request|tool_response, ...fields}
//   {time, type: 'event', event: turn_started|turn_suspended|..., invocation_id, ...}
// Empty/default fields are not serialised. `time` lives on the record, never on the
// message, so assembly stays clock-free.
//
// RecordTranscript holds all the read logic; subclasses supply two storage methods
// (_append / records). MemoryTranscript is for tests and one-shot pages;
// IndexedDbTranscript persists per thread in the extension's IndexedDB (shared by the
// panel and the tracker page — same origin).

import { message } from './contract.js';

export const MESSAGE_TYPES = new Set(['user', 'system', 'agent', 'tool_request', 'tool_response']);

const DEFAULTS = { text: null, reasoning: null, call_id: null, is_error: false };

/** Drop default-valued fields, like pydantic exclude_none + exclude_defaults. */
function compactMessage(m) {
  const out = {};
  for (const [k, v] of Object.entries(m)) {
    if (k === 'role') continue;
    if (k === 'calls') {
      if (v.length) out.calls = v.map((c) => Object.fromEntries(Object.entries(c).filter(([, cv]) => cv !== null)));
      continue;
    }
    if (v === null || v === undefined || DEFAULTS[k] === v) continue;
    out[k] = v;
  }
  return out;
}

export class RecordTranscript {
  // -- storage (override) -------------------------------------------------
  /** @param {Object} _record */
  async _append(_record) {
    throw new Error('not implemented');
  }

  /** @returns {Promise<Object[]>} records in append order */
  async records() {
    throw new Error('not implemented');
  }

  // -- writes ---------------------------------------------------------------
  async appendMessage(m) {
    await this._append({ time: Date.now(), type: m.role, ...compactMessage(m) });
  }

  async appendTurnEvent(event, invocationId, extra = {}) {
    await this.appendEvent(`turn_${event}`, invocationId, extra);
  }

  async appendEvent(event, invocationId, extra = {}) {
    await this._append({ time: Date.now(), type: 'event', event, invocation_id: invocationId, ...extra });
  }

  // -- reads ----------------------------------------------------------------
  async messages() {
    const out = [];
    const seenResponseIds = new Set();
    for (const r of await this.records()) {
      if (!r || !MESSAGE_TYPES.has(r.type)) continue; // events + unknown future types skipped
      // defensive dedupe: first tool_response per call_id wins
      if (r.type === 'tool_response' && r.call_id) {
        if (seenResponseIds.has(r.call_id)) continue;
        seenResponseIds.add(r.call_id);
      }
      const { type, time, ...data } = r;
      out.push(message({ role: type, ...data }));
    }
    return out;
  }

  async resolvedToolCallIds() {
    return new Set((await this.messages()).filter((m) => m.role === 'tool_response' && m.call_id).map((m) => m.call_id));
  }

  /** Calls requested but not yet answered. */
  async unresolvedPending() {
    const resolved = await this.resolvedToolCallIds();
    return (await this.messages())
      .filter((m) => m.role === 'tool_request')
      .flatMap((m) => m.calls)
      .filter((c) => !resolved.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, args: c.args, delivery: c.delivery }));
  }

  /** Invocations whose latest turn_* lifecycle event is turn_suspended. */
  async suspendedInvocations() {
    const state = new Map();
    for (const r of await this.records()) {
      if (r.type === 'event' && String(r.event).startsWith('turn_')) state.set(r.invocation_id, r.event);
    }
    return [...state].filter(([, e]) => e === 'turn_suspended').map(([inv]) => inv);
  }
}

export class MemoryTranscript extends RecordTranscript {
  constructor(records = []) {
    super();
    this._records = [...records];
  }

  async _append(record) {
    this._records.push(structuredClone(record));
  }

  async records() {
    return this._records.map((r) => structuredClone(r));
  }
}

const DB_NAME = 'fine-print';
const STORE = 'transcript_records';

function openDb(indexedDB) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const os = req.result.createObjectStore(STORE, { keyPath: 'seq', autoIncrement: true });
      os.createIndex('thread', 'thread_id');
    };
    req.onsuccess = () => {
      req.result.onversionchange = () => req.result.close(); // let a host schema upgrade through
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * One transcript per thread id in IndexedDB. Append-only; ordering by the
 * autoIncrement key preserves append order. A host that keeps its own stores in
 * the same database passes `db` (a Promise<IDBDatabase> that already has
 * `transcript_records` with a `thread` index) and owns the schema version.
 */
export class IndexedDbTranscript extends RecordTranscript {
  constructor(threadId, { indexedDB = globalThis.indexedDB, db = null } = {}) {
    super();
    this.threadId = threadId;
    this._db = db ?? openDb(indexedDB);
  }

  async _append(record) {
    const db = await this._db;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).add({ ...record, thread_id: this.threadId });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async records() {
    const db = await this._db;
    const rows = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).index('thread').getAll(this.threadId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return rows.sort((a, b) => a.seq - b.seq).map(({ seq, thread_id, ...r }) => r);
  }
}
