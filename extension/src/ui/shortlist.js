// Shortlist dashboard (extension page, opened in a tab from the panel header).
import { loadSettings } from '../agent/agent.js';
import { IndexedDbPropertyBackend } from '../agent/property-memory.js';
import { bestOf, listingKey, shortlistRows, sortRows } from '../agent/shortlist.js';

const $ = (id) => document.getElementById(id);
const h = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = String(text);
  return n;
};
const K = (n) => (n == null ? 'n/a' : n >= 1e6 ? `$${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : `$${Math.round(n / 1000)}K`);
const title = (s) => String(s ?? '').toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/^Unit\s+/, '').replace(/\s*\(.*\)/, '');
const ago = (t) => {
  if (!t) return '';
  const d = (Date.now() - new Date(t).getTime()) / 60000;
  return d < 60 ? `${Math.max(1, Math.round(d))} min ago` : d < 1440 ? `${Math.round(d / 60)} h ago` : `${Math.round(d / 1440)} d ago`;
};
const RISK = { hv_power_line: 'Power line', flood: 'Flood', heritage: 'Heritage', bushfire: 'Bushfire' };

async function setShortlist(update) {
  const { shortlist = {} } = await chrome.storage.local.get('shortlist');
  update(shortlist);
  await chrome.storage.local.set({ shortlist });
}

function metric(label, value, best, tone) {
  const m = h('div', `sl-metric ${best ? 'best' : ''} ${tone ?? ''}`);
  m.append(h('div', 'sl-k', label), h('div', 'sl-v', value));
  return m;
}

function card(r, best) {
  const c = h('article', `sl-card ${r.analysed ? '' : 'pending'}`);
  const img = h('div', 'sl-img');
  if (r.image) img.style.backgroundImage = `url("${encodeURI(r.image)}")`;
  else img.append(h('span', null, 'F'));
  const body = h('div', 'sl-body');
  const head = h('div', 'sl-head');
  const a = h('a', 'sl-address', title(String(r.address).split(',')[0]));
  a.href = r.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  head.append(a, h('div', 'sl-meta', [title(r.suburb), r.beds != null && `${r.beds} bed`, r.gnaf_id].filter(Boolean).join(' · ')));
  const tags = h('div', 'sl-tags');
  if (r.within_budget != null) tags.append(h('span', `tag ${r.within_budget ? 'good' : 'warn'}`, r.within_budget ? 'within budget' : 'over budget'));
  if (r.meets_yield != null) tags.append(h('span', `tag ${r.meets_yield ? 'good' : 'warn'}`, r.meets_yield ? 'meets yield' : 'below yield'));
  if (r.build_to_rent_1km > 0) tags.append(h('span', 'tag warn', `${r.build_to_rent_1km} build-to-rent ≤1 km`));
  for (const k of r.risks) tags.append(h('span', 'tag warn', RISK[k] ?? k.replace(/_/g, ' ')));
  body.append(head, tags);
  if (r.analysed) {
    const m = h('div', 'sl-metrics');
    m.append(
      metric(r.likely_sale ? 'Likely sale' : 'Asking', K(r.price), r.price === best.price, r.within_budget === false ? 'warn' : ''),
      metric('Gross yield', r.yield_pct != null ? `${r.yield_pct}%` : 'n/a', r.yield_pct === best.yield_pct),
      metric('Weekly cost', r.weekly_cost == null ? 'n/a' : `${r.weekly_cost > 0 ? '−' : '+'}$${Math.abs(Math.round(r.weekly_cost))}`, r.weekly_cost === best.weekly_cost),
      metric('New homes ≤1 km', r.new_homes_1km ?? 'n/a', r.new_homes_1km === best.new_homes_1km),
    );
    body.append(m);
  } else {
    body.append(h('p', 'dim sl-pending', 'Not analysed yet — open the listing and Fine Print will read it.'));
  }
  const foot = h('div', 'sl-foot');
  foot.append(h('span', 'dim', r.analysed_at ? `figures from ${ago(r.analysed_at)}` : `added ${ago(r.added_at)}`));
  const remove = h('button', 'sl-remove', 'Remove');
  remove.addEventListener('click', () => setShortlist((s) => delete s[r.key]));
  foot.append(remove);
  body.append(foot);
  c.append(img, body);
  return c;
}

function recentCard(rec) {
  const c = h('div', 'sl-mini');
  const a = h('a', null, title(String(rec.address).split(',')[0]));
  a.href = rec.url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  const y = rec.yield_at_likely ?? rec.yield_at_asking;
  c.append(a, h('span', 'dim', [K(rec.likely_sale ?? rec.asking ?? rec.estimated_value), y != null && `${y}%`, ago(rec.last_analysed_at)].filter(Boolean).join(' · ')));
  const add = h('button', null, '+ Shortlist');
  add.addEventListener('click', () => setShortlist((s) => (s[listingKey(rec.url)] = { url: rec.url, title: rec.listing_title ?? rec.address, heading: rec.address, added_at: Date.now() })));
  c.append(add);
  return c;
}

async function render() {
  const settings = await loadSettings();
  const inv = settings.brief;
  $('brief').textContent = `$${Math.round(inv.budget / 1000)}K · ≥${inv.minYield}% · ${inv.holdYears}y`;
  const { shortlist = {} } = await chrome.storage.local.get('shortlist');
  const records = await new IndexedDbPropertyBackend().all().catch(() => []);
  const rows = sortRows(shortlistRows(shortlist, records, inv), $('sort').value);
  const best = bestOf(rows.filter((r) => r.analysed));
  $('count').textContent = rows.length ? `· ${rows.length}` : '';
  $('rows').replaceChildren(...(rows.length ? rows.map((r) => card(r, best)) : [h('p', 'sl-empty dim', 'Nothing shortlisted yet. Open a listing on realestate.com.au or domain.com.au and tap "Shortlist this property".')]));

  const onList = new Set(Object.keys(shortlist).map(listingKey));
  const recent = records
    .filter((r) => r.url && !onList.has(listingKey(r.url)))
    .sort((a, b) => String(b.last_analysed_at).localeCompare(String(a.last_analysed_at)))
    .slice(0, 8);
  $('recent-wrap').hidden = !recent.length;
  $('recent').replaceChildren(...recent.map(recentCard));
}

$('sort').addEventListener('change', render);
chrome.storage.onChanged.addListener((changes) => {
  if (changes.shortlist || changes.settings) render();
});
render();
