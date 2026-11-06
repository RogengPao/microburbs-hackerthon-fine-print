// Egress policy — port of tools/egress.py. Network is declared, never ambient:
// a tool reaches manifest.allowed_hosts ∩ host policy, nothing else.
//
// Wildcards: `*.example.com` matches subdomains AND the apex. A host policy can only
// NARROW what a manifest declared; a wildcard survives intersection only when the
// policy can vouch for the whole subtree (allowsPattern), otherwise it narrows to
// its apex.
//
// In the extension, Chrome's host_permissions are the outer boundary; this is the
// per-tool inner one (a Microburbs tool can't be pointed at the LLM endpoint).

import { EgressBlockedError } from './errors.js';

/** Bare lowercase hostname — no scheme, port or credentials. */
export function hostOf(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new EgressBlockedError(`could not determine a host from ${JSON.stringify(url)}`, { url });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new EgressBlockedError(`unsupported URL scheme ${JSON.stringify(parsed.protocol.replace(':', '') || '(none)')}`, {
      hint: 'tools may only make http/https requests',
      url,
    });
  }
  if (!parsed.hostname) throw new EgressBlockedError(`could not determine a host from ${JSON.stringify(url)}`, { url });
  return parsed.hostname.toLowerCase();
}

export function hostMatches(host, pattern) {
  host = host.toLowerCase();
  pattern = pattern.toLowerCase().trim();
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2);
    return host === suffix || host.endsWith(`.${suffix}`);
  }
  return host === pattern;
}

/** Does pattern `outer` admit everything `inner` admits? */
export function patternCovers(outer, inner) {
  outer = outer.toLowerCase().trim();
  inner = inner.toLowerCase().trim();
  if (!inner.startsWith('*.')) return hostMatches(inner, outer);
  if (!outer.startsWith('*.')) return false;
  const o = outer.slice(2);
  const i = inner.slice(2);
  return i === o || i.endsWith(`.${o}`);
}

export class AllowlistEgressPolicy {
  constructor(allowedHosts) {
    this.allowedHosts = [...allowedHosts];
  }

  allows(host) {
    return this.allowedHosts.some((p) => hostMatches(host, p));
  }

  allowsPattern(pattern) {
    return this.allowedHosts.some((p) => patternCovers(p, pattern));
  }
}

export class AllowAllEgressPolicy {
  allows() {
    return true;
  }

  allowsPattern() {
    return true;
  }
}

export class DenyAllEgressPolicy {
  allows() {
    return false;
  }

  allowsPattern() {
    return false;
  }
}

export function policyAllowsPattern(policy, pattern) {
  if (!pattern.trim().startsWith('*.')) return policy.allows(pattern.trim().toLowerCase());
  return typeof policy.allowsPattern === 'function' ? policy.allowsPattern(pattern) : false;
}

/** manifest ∩ policy, computed once per call. Only ever removes reach. */
export function effectiveHosts(declared, policy) {
  const out = [];
  for (const pattern of declared) {
    if (policyAllowsPattern(policy, pattern)) out.push(pattern);
    else if (pattern.trim().startsWith('*.')) {
      const apex = pattern.trim().slice(2).toLowerCase();
      if (apex && policy.allows(apex)) out.push(apex);
    }
  }
  return out;
}
