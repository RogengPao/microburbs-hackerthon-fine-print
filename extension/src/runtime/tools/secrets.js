// Secrets — port of tools/secrets.py. Credentials enter via a SecretProvider,
// never via messages or the bundle. A tool gets ResolvedSecrets: its DECLARED
// credentials, already resolved, and nothing else.
//
// Providers are async here (chrome.storage is). Values are strings, or field maps
// for multi-field credentials ({{secret:name.field}}).

import { SecretUnavailableError } from './errors.js';

/** Fixed values — tests, or a host that already holds the keys. */
export class StaticSecretProvider {
  constructor(values = {}) {
    this.values = { ...values };
  }

  async get(name) {
    const v = this.values[name];
    if (typeof v !== 'string') throw new SecretUnavailableError(`secret ${JSON.stringify(name)} is not configured`);
    return v;
  }

  async getFields(name) {
    const v = this.values[name];
    if (!v || typeof v !== 'object') throw new SecretUnavailableError(`secret ${JSON.stringify(name)} has no fields configured`);
    return { ...v };
  }
}

/**
 * Reads chrome.storage.local[storageKey] = {name: value | {field: value}}.
 * Keys are pasted into the options page on the day; never in the repo.
 */
export class ChromeStorageSecretProvider {
  constructor({ storageKey = 'secrets', storage = globalThis.chrome?.storage?.local } = {}) {
    this.storageKey = storageKey;
    this.storage = storage;
  }

  async all() {
    if (!this.storage) throw new SecretUnavailableError('chrome.storage is unavailable in this context');
    const got = await this.storage.get(this.storageKey);
    return got?.[this.storageKey] ?? {};
  }

  async get(name) {
    return new StaticSecretProvider(await this.all()).get(name);
  }

  async getFields(name) {
    return new StaticSecretProvider(await this.all()).getFields(name);
  }
}

export class ResolvedSecrets {
  constructor(values = {}, fields = {}) {
    this.values = { ...values };
    this.fields = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { ...v }]));
  }

  has(name) {
    return name in this.values || name in this.fields;
  }

  value(name) {
    if (name in this.values) return this.values[name];
    if (name in this.fields) {
      throw new SecretUnavailableError(`secret ${JSON.stringify(name)} has named fields — reference one as secret:${name}.<field>`, {
        hint: 'this credential is a field map, not a single value',
      });
    }
    throw new SecretUnavailableError(`secret ${JSON.stringify(name)} is not available to this tool`, {
      hint: "declare it in the tool manifest's `secrets` list",
    });
  }

  field(name, field) {
    if (!(name in this.fields)) {
      throw new SecretUnavailableError(`secret ${JSON.stringify(name)} has no fields available to this tool`, {
        hint: "declare it in the tool manifest's `secrets` list",
      });
    }
    const map = this.fields[name];
    if (!(field in map)) {
      throw new SecretUnavailableError(`secret ${JSON.stringify(name)} has no field ${JSON.stringify(field)}`, {
        hint: `available fields: ${Object.keys(map).sort().join(', ')}`,
      });
    }
    return map[field];
  }

  /** Every literal credential — used to redact upstream error bodies. */
  allValues() {
    return [...Object.values(this.values), ...Object.values(this.fields).flatMap((m) => Object.values(m))].filter(Boolean);
  }
}

/** Resolve exactly the declared names. Missing => SecretUnavailableError. */
export async function resolveSecrets(provider, names) {
  const values = {};
  const fields = {};
  for (const name of names) {
    try {
      values[name] = await provider.get(name);
    } catch (e) {
      if (!(e instanceof SecretUnavailableError) || typeof provider.getFields !== 'function') throw e;
      fields[name] = await provider.getFields(name);
    }
  }
  return new ResolvedSecrets(values, fields);
}
