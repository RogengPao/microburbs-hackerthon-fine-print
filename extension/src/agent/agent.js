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
import { testBrief, testListingBriefTool } from './test-data.js';
import { LessonBook, uiBlockTool } from './ui-blocks.js';
import { microburbsTools } from './microburbs-tools.js';
import { openAppDb, PropertyMemory, propertyMemoryTools } from './property-memory.js';
import { pageContextText } from './page-context.js';

export const DEFAULT_SETTINGS = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  mbSource: 'test', // 'test' (bundled data) until the team key lands; then 'api'
  brief: { budget: 800000, deposit: 160000, minYield: 4.0, holdYears: 10 },
};

export const HOLD_OPTIONS = [3, 5, 10, 15];

/** Any brief → a valid one: blanks, zeros and junk fall back to the defaults (an empty field once saved holdYears: 0). */
export function cleanBrief(brief = {}) {
  const d = DEFAULT_SETTINGS.brief;
  const pos = (v, fallback) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback);
  const budget = pos(brief.budget, d.budget);
  const deposit = pos(brief.deposit, d.deposit) < budget ? pos(brief.deposit, d.deposit) : Math.round(budget * 0.2);
  const hold = pos(brief.holdYears, d.holdYears);
  return {
    budget,
    deposit,
    minYield: pos(brief.minYield, d.minYield),
    holdYears: HOLD_OPTIONS.includes(hold) ? hold : HOLD_OPTIONS.reduce((a, b) => (Math.abs(b - hold) < Math.abs(a - hold) ? b : a)),
  };
}

/** Save the investor brief from onboarding (marks onboarding done). */
export async function saveBrief(brief) {
  const { settings = {} } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...settings, onboarded: true, brief: cleanBrief({ ...(settings.brief ?? {}), ...brief }) } });
}

export async function loadSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings ?? {}), brief: cleanBrief(settings?.brief) };
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

Cards:
- When a question maps to a card (yield, supply, cash flow, value, area, offer, hold, property, hazards), answer in 1–2 sentences AND call render_ui_block once with that template, filled from the brief. One card per reply, never several. No card for small talk or when the data is missing.
- Answer like a buyer's agent: lead with the verdict in one sentence, then the 2–4 numbers that matter. Short.
- Format in Markdown for a narrow (420 px) panel: **bold** the key numbers, short bullet lists, at most a 2-column table; no long headings, no code blocks. Australian English. Say "property" or "apartment", never "flat". General information, not financial advice.`;
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

// "Read this listing": the button sends a real USER message (models need a user
// turn to answer — an all-system turn made DeepSeek emit junk), and the format
// instructions ride as ephemeral context for that turn only.
export const FIRST_READ_TEXT = 'Read this listing.';
export const FIRST_READ_PROMPT = `The investor clicked "Read this listing". Produce the first read now.

If the listing brief is already in your context, write the read straight from it — no tools. If it isn't, call get_listing_brief ONCE with the listing's full address (include the unit number), then write the read. If there's no exact match, say which address you tried and ask the investor to confirm it.

Reply in Markdown, in exactly this shape (keep it tight — it renders in a 420 px panel):

**<the brief's matched address>**

**Verdict:** <one sentence against the investor's brief>

#### Estimates
| | |
|---|---|
| Estimated value | <$ range and confidence, or n/a> |
| Asking | <$> |
| Likely sale | **<$>** — <the agency's quoting record in a few words> |
| Rent | <$/wk (range), n comparables; this property's last advertised rent if there is one> |
| Gross yield | <at asking> · <at likely sale> |
| Weekly cost | <$/wk before tax> |

#### Warnings
- <most serious first, one line each, at most 4; bold the key number>

#### Upside
- <one line>

If a figure is missing, write "n/a" and say why in a few words. No other headings, no code blocks.`;

/** Agent-first turn for a fresh listing thread. */
export async function firstRead({ threadId, listing, brief = null, onDelta, onEvent, shouldContinue }) {
  return turn({ threadId, inbound: message({ role: 'user', text: FIRST_READ_TEXT }), listing, brief, instructions: FIRST_READ_PROMPT, onDelta, onEvent, shouldContinue });
}

async function turn({ threadId, inbound, listing, brief = null, instructions = null, onDelta, onEvent, shouldContinue }) {
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
  const lessons = new LessonBook();
  const tools = new ToolRegistry(
    settings.mbSource === 'test'
      ? [testListingBriefTool({ investor: settings.brief, memory, listing }), ...propertyMemoryTools(memory), uiBlockTool({ lessons })] // no network
      : [
          listingBriefTool({ source: settings.mbSource, secretProvider, investor: settings.brief, memory, listing }),
          ...propertyMemoryTools(memory),
          uiBlockTool({ lessons }),
          ...microburbsTools({ source: settings.mbSource, secretProvider }),
        ],
  );
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
  // Learning: past render_ui_block mistakes ride along so they stop recurring.
  const lessonText = await lessons.text();
  if (lessonText) ephemeralContext.push(message({ role: 'system', text: lessonText }));
  // Turn-specific instructions go LAST so they're the freshest thing the model reads.
  if (instructions) ephemeralContext.push(message({ role: 'system', text: instructions }));
  return runTurn(snapshot, store, adapter, tools, {
    inbound,
    ephemeralContext,
    onDelta,
    onEvent,
    shouldContinue,
    maxToolSteps: 12,
  });
}

/** name → people-facing label for every tool the agent can call (for rendering transcripts). */
export const TOOL_LABELS = new ToolRegistry([
  listingBriefTool({ source: 'api' }),
  ...propertyMemoryTools(null),
  uiBlockTool({ lessons: new LessonBook(null) }),
  ...microburbsTools({ source: 'api' }),
]).labels();

export async function history(threadId) {
  return new IndexedDbTranscript(threadId, { db: openAppDb() }).messages();
}
