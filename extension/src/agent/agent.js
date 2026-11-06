// Host wiring: settings -> snapshot + adapter + tools + store, then runTurn.
// This is the HOST side of the runtime contract (owns storage, keys, context).

import {
  ToolError,
  adapterFor,
  agentSnapshot,
  ChromeStorageSecretProvider,
  IndexedDbTranscript,
  message,
  runTurn,
  ToolRegistry,
} from '../runtime/index.js';
import { addressFromPage, formatAddress } from './address.js';
import { fetchListingBrief, listingBriefTool } from './listing-brief.js';
import { testBrief } from './test-data.js';
import { microburbsTools } from './microburbs-tools.js';
import { openAppDb, PropertyMemory, propertyMemoryTools } from './property-memory.js';
import { pageContextText } from './page-context.js';

export const DEFAULT_SETTINGS = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  mbSource: 'test', // 'test' (bundled data) until the team key lands; then 'api'
  brief: { budget: 800000, deposit: 160000, minYield: 4.0, holdYears: 10 },
};

export async function loadSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings ?? {}), brief: { ...DEFAULT_SETTINGS.brief, ...(settings?.brief ?? {}) } };
}

function systemPrompt(brief) {
  return `You are Fine Print, a sharp, independent buyer's agent for property investors in the City of Sydney.
You ride along while the investor browses listings and tell them what the listing doesn't say.

Investor brief: budget $${brief.budget.toLocaleString('en-AU')}, deposit $${brief.deposit.toLocaleString('en-AU')}, minimum gross yield ${brief.minYield}%, holding ${brief.holdYears} years.

How to work:
- Microburbs is the source of truth for every number. Never invent figures; if data is missing, say so.
- Start with get_listing_brief for the listing's address: one call returns the matched property, prices, rent estimate, yield, weekly cost, supply pipeline, competition, market and hazards, all computed. Quote its numbers; don't recompute them.
- Use the individual tools only to dig deeper on a follow-up question. Suburb tools need the exact suburb name.

Memory:
- Every property you analyse with get_listing_brief is saved automatically, with its listing link and main image. You don't need to save anything yourself.
- Use recall_properties to compare this listing with ones the investor looked at before ("cheaper to hold than the Waterloo one you saw yesterday"), to rank what they've seen (by yield, weekly cost or price), or to find a property they mention by street or suburb. Use get_saved_property for the full saved brief of one of them.
- When you mention a saved property, give its address and when it was analysed. Saved figures are from that day; say so if they may be stale.
- Answer like a buyer's agent: lead with the verdict in one sentence, then the 2–4 numbers that matter. Short. Australian English. Say "property" or "apartment", never "flat". General information, not financial advice.`;
}

async function llmKey(provider) {
  const { secrets } = await chrome.storage.local.get('secrets');
  const key = secrets?.[provider];
  if (!key) throw new Error(`No ${provider} API key — set it in the options page.`);
  return key;
}

/**
 * Run one turn for a thread. Returns the TurnResult.
 * @param {Object} o
 * @param {string} o.threadId
 * @param {string} o.text                 the user's message
 * @param {{url?: string, title?: string}} [o.listing]  current tab, injected as ephemeral context
 * @param {(d: Object) => void} [o.onDelta]
 * @param {(e: Object) => void} [o.onEvent]
 * @param {() => boolean} [o.shouldContinue]
 */
/**
 * The data pipeline — no LLM. Page → address → strict GNAF match → brief (all
 * Microburbs endpoints in parallel) → saved to property memory. The panel calls this
 * the moment it opens so widgets can render before anyone asks anything.
 * @returns {Promise<{ok: true, brief: Object, address: Object} | {ok: false, reason: string, message: string, hint?: string, address?: Object}>}
 */
export async function loadBrief({ listing, onProgress = () => {} }) {
  const address = addressFromPage(listing?.page);
  if (!address) return { ok: false, reason: 'no_address', message: 'Could not read an address from this page.' };
  onProgress({ stage: 'address', ...address, text: formatAddress(address.parts) });
  const settings = await loadSettings();
  try {
    const brief = settings.mbSource === 'test' ? testBrief(address.parts, settings.brief) : await fetchListingBrief({
      parts: address.parts,
      source: settings.mbSource,
      secretProvider: new ChromeStorageSecretProvider(),
      investor: settings.brief,
      onProgress,
    });
    brief.listing = { url: listing.url ?? null, image: listing.page?.image ?? null, portal: listing.page?.listing?.portal ?? null, listing_id: listing.page?.listing?.listing_id ?? null, address_source: address.source };
    await new PropertyMemory().save(brief, { url: listing.url, image: listing.page?.image, title: listing.page?.heading }).catch(() => {});
    return { ok: true, brief, address };
  } catch (e) {
    if (e instanceof ToolError) return { ok: false, reason: e.errorCode, message: e.message, hint: e.hint, address };
    return { ok: false, reason: 'error', message: String(e?.message ?? e), address };
  }
}

export async function ask({ threadId, text, listing, brief = null, onDelta, onEvent, shouldContinue }) {
  return turn({ threadId, inbound: message({ role: 'user', text }), listing, brief, onDelta, onEvent, shouldContinue });
}

// The hidden first-read prompt: the agent talks first. Persisted as a `system`
// record (a host-injected instruction, never rendered) so follow-up questions keep
// the context of what was already read.
export const FIRST_READ_PROMPT = `The investor clicked "Read this listing". Produce the first read now.

If the listing brief is already in your context, write the read straight from it — no tools. If it isn't, call get_listing_brief ONCE with the listing's full address (include the unit number), then write the read. If there's no exact match, say which address you tried and ask the investor to confirm it.

Reply in PLAIN TEXT only — no markdown, no bold, no tables — in exactly this shape:

MATCHED: <the brief's matched address>

VERDICT: <one sentence against the investor's brief>

ESTIMATES
- Estimated value: <$ range and confidence, or n/a>
- Asking: <$>
- Likely sale: <$ and the agency's quoting record in a few words>
- Rent: <$/wk, range, how many comparables; mention this property's last advertised rent if there is one>
- Gross yield: <at asking> / <at likely sale>
- Weekly cost: <$/wk before tax, with the assumption in a few words>

WARNINGS
- <most serious first, one line each, at most 4>

UPSIDE
- <one line>

If a figure is missing, write "n/a" and say why in a few words.`;

/** Agent-first turn for a fresh listing thread. */
export async function firstRead({ threadId, listing, brief = null, onDelta, onEvent, shouldContinue }) {
  return turn({ threadId, inbound: message({ role: 'system', text: FIRST_READ_PROMPT }), listing, brief, onDelta, onEvent, shouldContinue });
}

async function turn({ threadId, inbound, listing, brief = null, onDelta, onEvent, shouldContinue }) {
  const settings = await loadSettings();
  const snapshot = agentSnapshot({
    agent_version: 'fine-print-dev',
    name: 'fine-print',
    provider: settings.provider,
    model: settings.model,
    stream: true,
    params: { max_tokens: 2048, temperature: 0.3 },
    system_base: systemPrompt(settings.brief),
  });
  const adapter = adapterFor(snapshot, { apiKey: await llmKey(settings.provider), ...(settings.provider === 'openrouter' ? { appTitle: 'Fine Print' } : {}) });
  const secretProvider = new ChromeStorageSecretProvider();
  const memory = new PropertyMemory();
  const tools = new ToolRegistry([
    listingBriefTool({ source: settings.mbSource, secretProvider, investor: settings.brief, memory, listing }),
    ...propertyMemoryTools(memory),
    ...microburbsTools({ source: settings.mbSource, secretProvider }),
  ]);
  const store = new IndexedDbTranscript(threadId, { db: openAppDb() });
  // Ephemeral context: the listing page, re-sent every step, never persisted — so the
  // transcript stays clean and the agent always sees the page as it is now.
  const ephemeralContext = listing?.page
    ? [message({ role: 'system', text: pageContextText(listing.page) })]
    : listing?.url
      ? [message({ role: 'system', text: `The investor is viewing this listing: ${listing.title ?? ''} — ${listing.url}` })]
      : [];
  // The pre-loaded brief rides along as ephemeral context too: the model quotes it
  // instead of calling get_listing_brief (saves a full model round trip).
  if (brief) {
    ephemeralContext.push(message({ role: 'system', text: `Listing brief for the property on screen (from Microburbs; computed, authoritative — quote these numbers):\n${JSON.stringify(brief)}` }));
  }
  return runTurn(snapshot, store, adapter, tools, {
    inbound,
    ephemeralContext,
    onDelta,
    onEvent,
    shouldContinue,
    maxToolSteps: 12,
  });
}

export async function history(threadId) {
  return new IndexedDbTranscript(threadId, { db: openAppDb() }).messages();
}
