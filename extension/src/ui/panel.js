// Dev panel: a bare chat over the runtime so the agent + Microburbs tools can be
// tested in Chrome. Not the real design (that's the Paper v3 page).

import { ask, FIRST_READ_TEXT, firstRead, history, loadBrief, TOOL_LABELS } from '../agent/agent.js';
import { readTab } from '../agent/page-context.js';

const $ = (id) => document.getElementById(id);
const thread = $('thread');
// Always runs as the slide-out iframe inside a page (the only surface).
document.body.classList.add('embedded');
$('close').hidden = false;
$('close').addEventListener('click', () => {
  const parentOrigin = location.ancestorOrigins?.[0];
  if (parentOrigin) window.parent.postMessage({ type: 'fineprint:close' }, parentOrigin);
});

/** The tab this panel lives in — the background reads it off the message sender. */
async function currentTab() {
  const tab = await chrome.runtime.sendMessage({ type: 'fineprint:whoami' }).catch(() => null);
  if (tab) return tab;
  const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
  return active;
}

const LISTING_URL = /realestate\.com\.au\/property-|domain\.com\.au\/[^/?#]+-\d{7,}\/?(?:[?#]|$)/;
let listing = null;
let brief = null; // the loaded listing brief (docs/brief.md)
let threadId = null;
let busy = false;

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function scroll() {
  thread.scrollTop = thread.scrollHeight;
}

let lastRole = null;
let firstReadOpen = false; // an agent reply after the hidden system trigger is the first read

function renderMessage(m) {
  const afterTrigger = firstReadOpen;
  if (m.role === 'system') firstReadOpen = true; // legacy hidden trigger (older threads) — never rendered
  if (m.role === 'user') {
    firstReadOpen = m.text === FIRST_READ_TEXT; // the reply to "Read this listing." renders as the read card
    thread.append(el('div', 'msg user', m.text));
  } else if (m.role === 'agent') {
    thread.append(el('div', afterTrigger ? 'msg agent read' : 'msg agent', m.text ?? ''));
    firstReadOpen = false;
  }
  else if (m.role === 'tool_request') {
    if (m.text) thread.append(el('div', 'msg agent pre', m.text));
    for (const c of m.calls) thread.append(toolRow(c.id, c.name, c.args));
  } else if (m.role === 'tool_response') {
    const row = thread.querySelector(`[data-call="${CSS.escape(m.call_id)}"]`);
    if (row) fillTool(row, m.text, m.is_error);
  }
  lastRole = m.role;
}

async function renderHistory() {
  thread.replaceChildren();
  lastRole = null;
  firstReadOpen = false;
  for (const m of await history(threadId)) renderMessage(m);
}

function toolRow(id, name, args) {
  const d = el('details', 'tool');
  d.dataset.call = id;
  const s = el('summary');
  // People see the label ("Checking rentals nearby"); the raw name + args sit in the expanded body.
  s.append(el('span', 'tname', TOOL_LABELS[name] ?? name), el('span', 'tstatus', '…'));
  d.append(s, el('div', 'targs', `${name} ${JSON.stringify(args ?? {})}`), el('pre', 'tbody', 'running…'));
  return d;
}

function fillTool(row, text, isError) {
  row.querySelector('.tstatus').textContent = isError ? 'error' : 'ok';
  row.classList.toggle('err', Boolean(isError));
  let pretty = text ?? '';
  try {
    pretty = JSON.stringify(JSON.parse(pretty), null, 2);
  } catch {
    /* not JSON */
  }
  row.querySelector('.tbody').textContent = pretty.length > 6000 ? `${pretty.slice(0, 6000)}\n… (${pretty.length} chars)` : pretty;
}

async function detectListing() {
  const tab = await currentTab();
  const isListing = tab?.url && LISTING_URL.test(tab.url);
  listing = isListing ? { url: tab.url, title: tab.title, page: await readTab(tab.id) } : null;
  $('listing').textContent = listing
    ? `Reading: ${listing.page?.heading ?? listing.title}${listing.page ? '' : ' (page not readable — URL only)'}`
    : 'No listing detected — you can still ask about any City of Sydney address.';
  $('listing').classList.toggle('dim', !listing);
  const { threads = {} } = await chrome.storage.local.get('threads');
  const key = listing?.url ?? 'scratch';
  threadId = threads[key] ?? `${key}#${Date.now()}`;
  threads[key] = threadId;
  await chrome.storage.local.set({ threads });
  await renderHistory();
  scroll();
  $('starters').hidden = busy;
  // Data first, no LLM: address → GNAF → brief, so widgets render immediately.
  brief = null;
  $('data').hidden = !listing;
  if (listing) await fetchBrief();
}

const money = (n) => (n == null ? 'n/a' : `$${Math.round(n).toLocaleString('en-AU')}`);
const pct = (n) => (n == null ? 'n/a' : `${n}%`);

async function fetchBrief() {
  $('matched').textContent = 'Matching address…';
  $('figures').replaceChildren();
  $('read').disabled = true;
  const res = await loadBrief({
    listing,
    onProgress: (p) => {
      if (p.stage === 'address') $('matched').textContent = `Matching: ${p.text} (${p.source})…`;
      if (p.stage === 'matched') $('matched').textContent = `Matched: ${p.address} · fetching…`;
    },
  });
  brief = res.ok ? res.brief : null;
  window.finePrint = { brief, result: res };
  window.dispatchEvent(new CustomEvent('fineprint:brief', { detail: res }));
  console.log('[fine-print] brief', res);
  if (!res.ok) {
    $('matched').textContent =
      res.reason === 'no_match' ? `No exact match — ${res.message}${res.hint ? ` (${res.hint})` : ''}`
      : res.reason === 'no_address' ? res.message
      : `Couldn't load Microburbs data — ${res.message}`;
    $('read').disabled = false; // the agent can still try / ask the investor
    return;
  }
  const b = res.brief;
  $('matched').textContent = b.meta?.test_data
    ? `TEST DATA · ${b.property.address} (bundled figures, not live Microburbs)`
    : `Matched: ${b.property.address} · ${b.property.gnaf_id}${b.meta?.cached ? ' · cached' : ` · ${b.meta?.fetched_ms} ms`}`;
  const rows = [
    ['Asking', money(b.price.asking)],
    ['Likely sale', money(b.price.likely_sale)],
    ['Est. value', b.price.value ? `${money(b.price.value.estimate)} (${b.price.value.confidence}%)` : 'n/a'],
    ['Rent', b.rent.weekly ? `${money(b.rent.weekly)}/wk · ${b.rent.comparables} comps` : 'n/a'],
    ['Yield', `${pct(b.returns.gross_yield_pct_at_asking)} asking · ${pct(b.returns.gross_yield_pct_at_likely)} likely`],
    ['Weekly cost', b.weekly_cost.net_before_tax == null ? 'n/a' : `${money(b.weekly_cost.net_before_tax)}/wk`],
    ['New homes ≤1 km', `${b.supply.new_dwellings_stated} (${b.supply.build_to_rent_dwellings} build-to-rent)`],
  ];
  $('figures').replaceChildren(...rows.flatMap(([k, v]) => [el('dt', null, k), el('dd', null, v)]));
  $('read').disabled = false;
}

async function newThread() {
  const { threads = {} } = await chrome.storage.local.get('threads');
  const key = listing?.url ?? 'scratch';
  threads[key] = `${key}#${Date.now()}`;
  await chrome.storage.local.set({ threads });
  await detectListing();
}

async function send(text) {
  if (busy || !text.trim()) return;
  renderMessage({ role: 'user', text });
  $('input').value = '';
  await run((handlers) => ask({ threadId, text, listing, brief, ...handlers }));
}

async function readListing() {
  await run((handlers) => firstRead({ threadId, listing, brief, ...handlers }), { status: 'Reading this listing…' });
}

/** Run one turn with live streaming + tool lines, then re-render from the transcript. */
async function run(runner, { status = null } = {}) {
  if (busy) return;
  busy = true;
  $('send').disabled = true;
  $('starters').hidden = true;
  const statusLine = status ? el('div', 'meta', status) : null;
  if (statusLine) thread.append(statusLine);
  let live = null; // streaming bubble for the current step
  const started = Date.now();
  try {
    const result = await runner({
      onDelta: (d) => {
        if (d.type !== 'text') return;
        if (!live) {
          live = el('div', 'msg agent live', '');
          thread.append(live);
        }
        live.textContent += d.text;
        scroll();
      },
      onEvent: (e) => {
        if (e.event === 'step' && live) {
          live.remove(); // the persisted record re-renders below
          live = null;
        }
        if (e.event === 'tool_start') {
          const line = el('div', 'meta', `${e.label ?? e.name}…`);
          line.dataset.call = e.call_id;
          thread.append(line);
          scroll();
        }
        if (e.event === 'tool') {
          const line = thread.querySelector(`.meta[data-call="${CSS.escape(e.call_id)}"]`) ?? thread.appendChild(el('div', 'meta'));
          line.textContent = `${e.error ? '✕' : '✓'} ${e.label ?? e.name}`;
          scroll();
        }
        if (e.event === 'retry') thread.append(el('div', 'meta', `retrying (${e.reason})…`));
      },
    });
    // re-render from the transcript: it is the only state
    await renderHistory();
    const u = result.usage;
    thread.append(
      el('div', 'meta', `${result.status} · ${result.steps} steps · ${u.input_tokens + u.output_tokens} tokens${u.cost ? ` · $${u.cost.toFixed(4)}` : ''} · ${((Date.now() - started) / 1000).toFixed(1)}s`),
    );
    if (result.status === 'failed') thread.append(el('div', 'msg error', `Failed: ${result.failure?.message ?? result.failure_reason}`));
  } catch (e) {
    live?.remove();
    thread.append(el('div', 'msg error', String(e?.message ?? e)));
  } finally {
    busy = false;
    $('send').disabled = false;
    $('starters').hidden = false;
    scroll();
  }
}

$('ask').addEventListener('submit', (e) => {
  e.preventDefault();
  send($('input').value);
});
$('input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send($('input').value);
  }
});
$('starters').addEventListener('click', (e) => {
  if (e.target.tagName === 'BUTTON') send(e.target.textContent);
});
$('new').addEventListener('click', newThread);
$('read').addEventListener('click', readListing);
$('copy-brief').addEventListener('click', () => navigator.clipboard.writeText(JSON.stringify(window.finePrint?.result ?? null, null, 2)));
$('opts').addEventListener('click', () => chrome.runtime.openOptionsPage());
detectListing();
