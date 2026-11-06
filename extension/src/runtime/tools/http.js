// The network path a tool is GIVEN, and where the allowlist is applied.
// Port of tools/http.py, on fetch.
//
// What it gives you (the control for a MISTAKE — a tool pointed at the wrong host):
//   - the allowlist is checked before every request; a blocked host is a typed
//     egress_blocked error naming it, never a mysterious failure
//   - redirects are REFUSED (fetch redirect:'error'). Python follows them manually
//     with a fresh egress check per hop, but in a browser a manual redirect is an
//     opaque response whose Location can't be read — so "follow and re-check" isn't
//     possible, and silently following would let a 302 walk a tool off its hosts
//   - the tool's deadline bounds the whole request (AbortSignal)
//   - oversized bodies are rejected (a runaway response stays out of the context)

import { hostMatches, hostOf } from './egress.js';
import { EgressBlockedError, ToolTimeoutError, UpstreamError } from './errors.js';

export const MAX_RESPONSE_BYTES = 2_000_000;
export const DEFAULT_TIMEOUT_S = 30;

export class HttpResponse {
  constructor(status, headers, text, url) {
    this.status = status;
    this.headers = headers;
    this.text = text;
    this.url = url;
  }

  get ok() {
    return this.status >= 200 && this.status < 300;
  }

  json() {
    try {
      return JSON.parse(this.text);
    } catch (e) {
      throw new UpstreamError('upstream returned a non-JSON body', { hint: 'the upstream shape may have changed', status: this.status });
    }
  }
}

export class AllowlistHttpClient {
  /**
   * @param {string[]} allowedHosts  the EFFECTIVE list (manifest ∩ policy); empty = no network
   * @param {Object} [o]
   * @param {number} [o.timeoutS]
   * @param {number} [o.deadline]   epoch ms; every request gets the REMAINING budget
   * @param {typeof fetch} [o.fetch]
   */
  constructor(allowedHosts, { timeoutS = DEFAULT_TIMEOUT_S, deadline = null, fetch: fetchImpl, credentials = 'omit' } = {}) {
    this.allowedHosts = [...allowedHosts];
    this.timeoutS = timeoutS;
    this.deadline = deadline;
    this.fetch = fetchImpl ?? globalThis.fetch.bind(globalThis);
    // 'omit' (default): no ambient cookies — a tool gets its declared secrets only.
    // 'include' is a HOST decision (never manifest/model), for dev proxies that
    // authenticate by the user's browser session.
    this.credentials = credentials;
  }

  check(url) {
    const host = hostOf(url);
    if (!this.allowedHosts.some((p) => hostMatches(host, p))) {
      throw new EgressBlockedError(`blocked request to ${JSON.stringify(host)}: not in this tool's allowed hosts`, {
        host,
        allowed_hosts: this.allowedHosts,
      });
    }
    return host;
  }

  remainingS() {
    if (this.deadline === null) return this.timeoutS;
    const left = (this.deadline - Date.now()) / 1000;
    if (left <= 0) throw new ToolTimeoutError('the tool ran out of time before the request completed');
    return Math.min(left, this.timeoutS);
  }

  async request(method, url, { params = null, headers = null, json = null } = {}) {
    method = method.toUpperCase();
    const target = new URL(url);
    for (const [k, v] of Object.entries(params ?? {})) target.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
    const host = this.check(target.href);
    const budget = this.remainingS();

    let resp;
    try {
      resp = await this.fetch(target.href, {
        method,
        headers: { ...(json !== null ? { 'Content-Type': 'application/json' } : {}), ...(headers ?? {}) },
        body: json !== null ? JSON.stringify(json) : undefined,
        redirect: 'error',
        credentials: this.credentials,
        signal: AbortSignal.timeout(budget * 1000),
      });
    } catch (e) {
      if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
        throw new ToolTimeoutError(`${host} did not respond within ${Math.round(budget)}s`, { host });
      }
      throw new UpstreamError(`could not reach ${host} (or it redirected): ${e?.message ?? e}`, {
        hint: 'the upstream system may be down, or tried to redirect — redirects are not followed',
        retryable: true,
        host,
      });
    }
    const text = await resp.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      throw new UpstreamError(`${host} returned more than ${MAX_RESPONSE_BYTES} bytes`, { hint: 'narrow the request — page or filter it', host });
    }
    return new HttpResponse(resp.status, Object.fromEntries(resp.headers.entries()), text, target.href);
  }

  get(url, opts) {
    return this.request('GET', url, opts);
  }

  post(url, opts) {
    return this.request('POST', url, opts);
  }
}
