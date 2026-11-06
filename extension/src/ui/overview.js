// The native overview block (design B "Listing + paper panel"): one instant view of the
// listing built straight from the brief — no model call. POC; Carlos polishes in React.
//   header (matched address) · price gauge · legend · 3 readouts · "What the listing
//   doesn't say" signal rows (tap → asks the agent the matching question).
// DOM + textContent only; model text never reaches here.

const SVG = 'http://www.w3.org/2000/svg';
const h = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined && text !== null) n.textContent = String(text);
  return n;
};
const svg = (tag, attrs) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  return n;
};
const K = (n) => (n == null ? 'n/a' : n >= 1e6 ? `$${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : `$${Math.round(n / 1000)}K`);
const titleCase = (s) => String(s ?? '').toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const shortAddress = (a) => titleCase(String(a ?? '').replace(/^UNIT\s+/i, '')).replace(/\s*\(.*\)/, '');

const BLUE = '#2F64D9';
const WARN = '#E3A008';
const GREY = '#E4DFD3';

/** Half-ring of ticks from min→max; colour by budget / likely; dashed needle at the budget. */
function gauge({ min, max, budget, likely }) {
  const W = 360;
  const H = 190;
  const cx = 180;
  const cy = 176;
  const r1 = 122;
  const r2 = 148;
  const N = 47;
  const s = svg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, class: 'ov-gauge-svg' });
  const at = (v) => Math.PI * (1 - Math.max(0, Math.min(1, (v - min) / (max - min || 1)))); // left = min
  for (let i = 0; i < N; i++) {
    const v = min + ((max - min) * i) / (N - 1);
    const a = Math.PI * (1 - i / (N - 1));
    const over = likely != null && budget != null && likely > budget;
    const colour = v <= Math.min(budget ?? Infinity, likely ?? Infinity) ? BLUE : over && v <= likely ? WARN : GREY;
    s.append(
      svg('line', {
        x1: (cx + r1 * Math.cos(a)).toFixed(1),
        y1: (cy - r1 * Math.sin(a)).toFixed(1),
        x2: (cx + r2 * Math.cos(a)).toFixed(1),
        y2: (cy - r2 * Math.sin(a)).toFixed(1),
        stroke: colour,
        'stroke-width': 4.5,
        'stroke-linecap': 'round',
      }),
    );
  }
  if (budget != null) {
    const a = at(budget);
    s.append(svg('line', { x1: (cx + (r1 - 22) * Math.cos(a)).toFixed(1), y1: (cy - (r1 - 22) * Math.sin(a)).toFixed(1), x2: (cx + (r2 + 4) * Math.cos(a)).toFixed(1), y2: (cy - (r2 + 4) * Math.sin(a)).toFixed(1), stroke: '#1E1D1B', 'stroke-width': 1.5, 'stroke-dasharray': '2 3' }));
  }
  return s;
}

function signals(b, investor) {
  const out = [];
  const s = b.supply ?? {};
  if (s.largest?.length) {
    const top = s.largest[0];
    out.push({
      tag: 'SUPPLY',
      tone: s.build_to_rent_dwellings > 0 || s.new_dwellings_stated >= 300 ? 'warn' : 'good',
      text: `${top.dwellings} ${top.build_to_rent ? 'build-to-rent' : 'new homes'}, ${Math.round(top.km * 1000)} m`,
      value: `${s.new_dwellings_stated} homes`,
      ask: 'Is the new supply a dealbreaker?',
    });
  }
  const { asking, likely_sale: likely, value } = b.price ?? {};
  if (asking && likely && likely !== asking) {
    out.push({ tag: 'QUOTE', tone: likely > asking ? 'warn' : 'good', text: likely > asking ? 'Agency sells over quote' : 'Agency sells under quote', value: `${likely > asking ? '+' : '−'}${K(Math.abs(likely - asking))}`, ask: 'What should I offer?' });
  }
  if (asking && value?.estimate) {
    out.push({ tag: 'VALUE', tone: asking > value.estimate ? 'warn' : 'good', text: asking > value.estimate ? 'Asking above estimate' : 'Asking below estimate', value: `${asking > value.estimate ? '+' : '−'}${K(Math.abs(asking - value.estimate))}`, ask: "What's it really worth?" });
  }
  if (b.rent?.weekly) {
    out.push({ tag: 'RENT', tone: 'good', text: `${b.rent.comparables} ${b.property?.beds ?? ''}-bed comps ≤ 1 km`.replace(' -bed', ''), value: `$${b.rent.weekly}/wk`, ask: 'Will it earn enough?' });
  }
  for (const r of (b.risks ?? []).slice(0, 1)) {
    out.push({ tag: 'RISK', tone: 'warn', text: ({ hv_power_line: 'High-voltage power line', flood: 'Flood zone', heritage: 'Heritage overlay', bushfire: 'Bushfire zone' })[r.name] ?? titleCase(r.name.replace(/_/g, ' ')), value: String(r.detail ?? '').replace(/^Not on property;\s*/i, '').replace(/^nearest\s+/i, '').replace(/\s*away$/, ''), ask: 'Any hazards I should check?' });
  }
  // warnings first
  return out.sort((a, c) => (a.tone === c.tone ? 0 : a.tone === 'warn' ? -1 : 1));
}

/**
 * @param {Object} b  the listing brief
 * @param {Object} investor  { budget, deposit, minYield, holdYears }
 * @param {{ onAsk?: (question: string) => void }} [o]
 */
export function renderOverview(b, investor = {}, { onAsk = () => {} } = {}) {
  const root = h('section', 'ov');
  const p = b.property ?? {};
  const price = b.price ?? {};

  // header
  const head = h('div', 'ov-head');
  const who = h('div', 'ov-who');
  who.append(h('div', 'ov-address', shortAddress(p.address)), h('div', 'ov-id', [p.gnaf_id, p.beds != null && `${p.beds} bed`, p.parking != null && `${p.parking} car`].filter(Boolean).join(' · ')));
  head.append(who, h('span', `ov-live ${b.meta?.test_data ? 'ov-test' : ''}`, b.meta?.test_data ? 'test data' : b.meta?.cached ? 'cached' : 'live'));
  root.append(head);

  // gauge
  const budget = investor.budget ?? null;
  const likely = price.likely_sale ?? price.asking ?? price.value?.estimate ?? null;
  if (likely) {
    const pts = [price.value?.low, price.value?.estimate, price.asking, likely, budget].filter((x) => x != null);
    const min = Math.floor((Math.min(...pts) * 0.95) / 50000) * 50000;
    const max = Math.ceil((Math.max(...pts) * 1.04) / 50000) * 50000;
    const g = h('div', 'ov-gauge');
    g.append(gauge({ min, max, budget, likely }));
    const centre = h('div', 'ov-centre');
    const diff = budget != null ? likely - budget : null;
    const sub = h('div', 'ov-sub', `${price.likely_sale ? 'likely sale' : price.asking ? 'asking' : 'estimate'}`);
    if (diff != null) sub.append(' · ', h('span', diff > 0 ? 'ov-warn-ink' : 'ov-blue-ink', `${K(Math.abs(diff))} ${diff > 0 ? 'over' : 'under'} budget`));
    centre.append(h('div', 'ov-big', K(likely)), sub);
    g.append(centre, h('div', 'ov-end ov-min', K(min)), h('div', 'ov-end ov-max', K(max)));
    root.append(g);

    // legend
    const legend = h('div', 'ov-legend');
    const row = (swatch, label, meta, value, cls = '') => {
      const r = h('div', 'ov-legend-row');
      const l = h('div', 'ov-legend-label', label);
      if (meta) l.append(' ', h('span', 'ov-meta', meta));
      r.append(h('span', `ov-sw ov-sw-${swatch}`), l, h('div', `ov-legend-value ${cls}`, value));
      return r;
    };
    if (price.value?.estimate) legend.append(row('ink', 'Estimated value', `AVM · conf ${price.value.confidence}`, K(price.value.estimate)));
    if (price.asking) legend.append(row('muted', 'Asking', null, K(price.asking)));
    if (budget != null) legend.append(row('dash', 'Your budget', null, K(budget)));
    if (price.likely_sale) {
      const a = price.agency;
      legend.append(row('warn', 'Likely sale', a ? `agency +${a.median_over_quote_pct}% over quote · ${Math.round(a.underquote_rate_pct)}%` : null, K(price.likely_sale), 'ov-warn-ink'));
    }
    root.append(legend);
  }

  // readouts
  const readouts = h('div', 'ov-readouts');
  const readout = (label, value, sub, tone) => {
    const c = h('div', 'ov-readout');
    const v = h('div', 'ov-readout-value');
    v.append(h('span', `ov-dot ov-dot-${tone}`), h('span', 'ov-num', value));
    c.append(h('div', 'ov-readout-label', label), v, h('div', 'ov-meta', sub));
    return c;
  };
  const y = b.returns?.gross_yield_pct_at_asking ?? b.returns?.gross_yield_pct_at_likely;
  readouts.append(readout('Gross yield', y != null ? `${y}%` : 'n/a', b.market?.suburb_unit_yield_pct != null ? `suburb ${b.market.suburb_unit_yield_pct}%` : '', y != null && investor.minYield != null && y >= investor.minYield ? 'blue' : 'warn'));
  const net = b.weekly_cost?.net_before_tax;
  readouts.append(readout('Weekly cost', net == null ? 'n/a' : `${net > 0 ? '−' : '+'}$${Math.abs(Math.round(net))}`, b.returns?.price_basis ? `at ${K(b.returns.price_basis)} · pre-tax` : '', net != null && net <= 0 ? 'blue' : 'warn'));
  const vac = b.market?.unit_vacancy_pct;
  readouts.append(readout('Unit vacancy', vac != null ? `${vac}%` : 'n/a', 'suburb units', vac != null && vac < 2 ? 'blue' : 'warn'));
  root.append(readouts);

  // signals
  const sig = signals(b, investor);
  if (sig.length) {
    const box = h('div', 'ov-signals');
    const title = h('div', 'ov-signals-title');
    title.append(h('span', null, "What the listing doesn't say"), h('span', 'ov-meta', 'tap to dig in'));
    const list = h('div', 'ov-signal-list');
    for (const s of sig) {
      const r = h('button', `ov-signal ov-signal-${s.tone}`);
      r.type = 'button';
      r.title = s.ask;
      r.append(h('span', 'ov-bar'), h('span', 'ov-tag', s.tag), h('span', 'ov-text', s.text), h('span', 'ov-value', s.value), h('span', 'ov-chev', '›'));
      r.addEventListener?.('click', () => onAsk(s.ask));
      list.append(r);
    }
    box.append(title, list);
    root.append(box);
  }
  return root;
}
