// render_ui_block — the agent attaches ONE visual card to its reply, chosen from the
// design's templates (design/screens/d-chat-components.png). "Shown when asked.
// Never all at once."
//
// SELF-DOCUMENTING: each template carries a strict body schema, a purpose line and a
// full example. A wrong body comes back as a retryable error listing exactly what's
// wrong + that template's field guide + the example, so the model fixes it in-band.
// LEARNING: every correction is recorded (chrome.storage.local) and the most common
// past mistakes are fed back into later turns' context, so they stop recurring.
//
// The tool `concludes`: a reply sentence + one successful block ends the turn in a
// single model step. A failed block does NOT conclude — the model gets to fix it.

import { tool, ToolError } from '../runtime/index.js';
import { validate } from '../runtime/validate.js';

// ---------------------------------------------------------------- schema helpers
const str = (maxLength = 120) => ({ type: 'string', minLength: 1, maxLength });
const num = (minimum, maximum) => ({ type: 'number', ...(minimum !== undefined ? { minimum } : {}), ...(maximum !== undefined ? { maximum } : {}) });
const arr = (items, minItems, maxItems) => ({ type: 'array', items, minItems, maxItems });
const obj = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false });
const oneOf = (...values) => ({ type: 'string', enum: values });

const COMMON = {
  headline: { ...str(28), description: 'the big number/word exactly as displayed, e.g. "5.7%", "$713K", "−$94"' },
  caption: { ...str(320), description: '1–2 sentences: what it means for this investor' },
  sources: { ...arr(str(60), 1, 5), description: 'Microburbs endpoints the numbers came from, e.g. "valuation/avm"' },
};
const badge = obj({ text: str(28), tone: oneOf('good', 'warn', 'neutral') });

/** template → { title (design tool name), question, purpose, schema, example } */
export const TEMPLATES = {
  yield: {
    title: 'show_yield_comparison',
    question: 'Will it earn enough?',
    purpose: 'Gross yield of this property vs the area, the city and the investor minimum.',
    schema: obj(
      {
        headline: COMMON.headline,
        badge,
        rows: arr(obj({ label: str(28), value_pct: num(0, 20), kind: oneOf('this', 'likely', 'area', 'city', 'minimum', 'other') }), 2, 6),
        threshold_pct: { ...num(0, 20), description: "the investor's minimum gross yield, percent" },
        caption: COMMON.caption,
        sources: COMMON.sources,
      },
      ['headline', 'rows', 'threshold_pct', 'caption', 'sources'],
    ),
    example: {
      headline: '5.2%',
      badge: { text: '+1.2 pts over your 4%', tone: 'good' },
      rows: [
        { label: 'This property', value_pct: 5.2, kind: 'this' },
        { label: 'At likely $852K', value_pct: 4.73, kind: 'likely' },
        { label: 'Zetland units', value_pct: 5.21, kind: 'area' },
        { label: 'Your minimum', value_pct: 4, kind: 'minimum' },
      ],
      threshold_pct: 4,
      caption: '4 one-bed rentals ≤ 1 km, median $775/wk ($740–815).',
      sources: ['listings/for-rent', 'market/yield-pct'],
    },
  },
  supply: {
    title: 'show_future_supply',
    question: 'Will the rent hold up?',
    purpose: 'New homes in development applications within 1 km, biggest first; build-to-rent competes for tenants.',
    schema: obj(
      {
        headline: COMMON.headline,
        badge,
        projects: arr(obj({ dwellings: { type: 'integer', minimum: 1 }, km: num(0, 5), build_to_rent: { type: 'boolean' }, label: str(48) }, ['dwellings', 'km', 'build_to_rent']), 1, 5),
        vacancy: obj({ here_pct: num(0, 100), city_pct: num(0, 100), rank_text: str(40) }, ['here_pct', 'city_pct']),
        caption: COMMON.caption,
        sources: COMMON.sources,
      },
      ['headline', 'projects', 'caption', 'sources'],
    ),
    example: {
      headline: '504',
      badge: { text: 'biggest risk', tone: 'warn' },
      projects: [{ dwellings: 504, km: 0.64, build_to_rent: true, label: '960A Bourke St' }],
      vacancy: { here_pct: 1.52, city_pct: 1.1 },
      caption: '504 build-to-rent homes lodged Oct 2026 compete for tenants directly. DA stage is unknown.',
      sources: ['development/da-list', 'market/vacancy-rate-series'],
    },
  },
  cash_flow: {
    title: 'show_weekly_cash_flow',
    question: 'What will it cost me?',
    purpose: 'Weekly money in and out at the likely price: rent in, interest/strata/rates out.',
    schema: obj(
      {
        headline: COMMON.headline,
        after_tax: str(40),
        lines: arr(obj({ label: str(32), weekly: { ...num(), description: 'dollars per week; positive = money in, negative = money out' }, note: str(40) }, ['label', 'weekly']), 2, 6),
        caption: COMMON.caption,
        sources: COMMON.sources,
      },
      ['headline', 'lines', 'caption', 'sources'],
    ),
    example: {
      headline: '−$181',
      lines: [
        { label: 'Rent', weekly: 775 },
        { label: 'Loan interest', weekly: -799, note: '$692K @ 6.0%' },
        { label: 'Strata', weekly: -112, note: 'Zetland median' },
        { label: 'Rates + insurance', weekly: -45 },
      ],
      caption: 'At the likely $852K with your $160K deposit, before tax.',
      sources: ['market/strata-levies', 'listings/for-rent'],
    },
  },
  value: {
    title: 'show_estimated_value',
    question: "What's it worth?",
    purpose: 'Automated valuation (AVM) with its range and confidence, against asking and likely sale.',
    schema: obj(
      {
        headline: COMMON.headline,
        estimate: num(0),
        low: num(0),
        high: num(0),
        confidence: num(0, 100),
        asking: num(0),
        likely: num(0),
        caption: COMMON.caption,
        sources: COMMON.sources,
      },
      ['headline', 'estimate', 'low', 'high', 'confidence', 'caption', 'sources'],
    ),
    example: {
      headline: '$713K',
      estimate: 712500,
      low: 555750,
      high: 869250,
      confidence: 82,
      asking: 775000,
      likely: 852500,
      caption: 'A computer valuation from nearby sales — a second opinion, not a bank valuation. The range is wide here.',
      sources: ['valuation/avm'],
    },
  },
  area: {
    title: 'show_area_comparison',
    question: 'How does it compare?',
    purpose: 'This property/suburb vs a comparison area on 2–6 metrics, each marked better or worse for the investor.',
    schema: obj(
      {
        headline: COMMON.headline,
        compare_to: str(40),
        metrics: arr(obj({ label: str(28), here: num(), area: num(), higher_is_better: { type: 'boolean' }, unit: oneOf('%', '$', 'days', '') }), 2, 6),
        caption: COMMON.caption,
        sources: COMMON.sources,
      },
      ['headline', 'compare_to', 'metrics', 'caption', 'sources'],
    ),
    example: {
      headline: '2 better, 1 worse',
      compare_to: 'City of Sydney median',
      metrics: [
        { label: 'Gross yield', here: 5.2, area: 4.4, higher_is_better: true, unit: '%' },
        { label: 'Growth, 5 yr', here: 8.4, area: 2, higher_is_better: true, unit: '%' },
        { label: 'Days to sell', here: 44, area: 32, higher_is_better: false, unit: 'days' },
      ],
      caption: 'Better on yield and growth; slower to sell than the city.',
      sources: ['market/yield-pct', 'market/days-on-market'],
    },
  },
  offer: {
    title: 'show_offer_ladder',
    question: 'What should I offer?',
    purpose: 'Recommended offer with an opening bid, aim and walk-away, against estimate, asking and likely sale.',
    schema: obj(
      {
        headline: COMMON.headline,
        open: num(0),
        aim: num(0),
        walk_away: num(0),
        estimate: num(0),
        asking: num(0),
        likely: num(0),
        comps: { ...arr(num(0), 1, 12), description: 'recent nearby same-bed sale prices' },
        caption: COMMON.caption,
        sources: COMMON.sources,
      },
      ['headline', 'open', 'aim', 'walk_away', 'caption', 'sources'],
    ),
    example: {
      headline: '$735K',
      open: 700000,
      aim: 735000,
      walk_away: 785000,
      estimate: 712500,
      asking: 775000,
      likely: 852500,
      caption: 'Agency: Stone Real Estate, "severe underquoter" — 71% of 17 sales went over quote, by a median 10%.',
      sources: ['valuation/agent-quoting', 'comparables/recent-sales-nearby'],
    },
  },
  hold: {
    title: 'show_hold_outcome',
    question: 'Worth it over ten years?',
    purpose: 'Illustrative gain over the hold for 2–4 purchase-price scenarios (after rent and costs, before tax).',
    schema: obj(
      {
        headline: COMMON.headline,
        badge,
        years: { type: 'integer', minimum: 1, maximum: 30 },
        scenarios: arr(obj({ label: str(36), gain: num(), kind: oneOf('best', 'base', 'worst', 'other') }), 2, 4),
        caption: COMMON.caption,
        sources: COMMON.sources,
      },
      ['headline', 'years', 'scenarios', 'caption', 'sources'],
    ),
    example: {
      headline: '$174K',
      badge: { text: 'illustrative', tone: 'neutral' },
      years: 10,
      scenarios: [
        { label: 'Negotiate to $735K', gain: 231000, kind: 'best' },
        { label: 'Pay the asking $775K', gain: 171000, kind: 'base' },
        { label: 'Pay the likely $852K', gain: 57000, kind: 'worst' },
      ],
      caption: 'Assumes 3% growth a year and 6% interest; before tax.',
      sources: ['market/price-growth-5y'],
    },
  },
  property: {
    title: 'show_property_profile',
    question: 'Tell me about the property',
    purpose: 'The matched property: id, key facts and sale history.',
    schema: obj(
      {
        headline: COMMON.headline,
        gnaf_id: str(20),
        facts: arr(obj({ label: str(20), value: str(24) }), 2, 6),
        history: arr(obj({ date: str(10), price: num(0), kind: oneOf('sold', 'listed', 'estimate', 'likely') }), 1, 8),
        caption: COMMON.caption,
        sources: COMMON.sources,
      },
      ['headline', 'gnaf_id', 'facts', 'sources'],
    ),
    example: {
      headline: '38/3 Victoria Park Pde',
      gnaf_id: 'GANSW710358627',
      facts: [
        { label: 'Bed/bath/car', value: '1 / 1 / 0' },
        { label: 'Strata', value: '$1,455/q' },
      ],
      history: [
        { date: '2011-08-31', price: 440000, kind: 'sold' },
        { date: '2022-10-21', price: 660000, kind: 'sold' },
        { date: '2026-11-07', price: 852500, kind: 'likely' },
      ],
      caption: '+29% since the 2022 sale at the likely price.',
      sources: ['properties/basics', 'history/all'],
    },
  },
  overlays: {
    title: 'show_overlays_and_planning',
    question: 'Any hazards?',
    purpose: 'Hazards and planning overlays on or near the title, worst first, plus transport.',
    schema: obj(
      {
        headline: COMMON.headline,
        items: arr(obj({ name: str(36), detail: str(36), status: oneOf('on_property', 'nearby', 'clear') }), 1, 8),
        transport: arr(obj({ label: str(20), value: str(28) }), 1, 4),
        caption: COMMON.caption,
        sources: COMMON.sources,
      },
      ['headline', 'items', 'sources'],
    ),
    example: {
      headline: 'Clear. One thing to check.',
      items: [
        { name: 'High-voltage power line', detail: '23 m', status: 'nearby' },
        { name: 'Flood', detail: 'nearest 384 m', status: 'clear' },
        { name: 'Bushfire · landslide · erosion', detail: 'none', status: 'clear' },
      ],
      sources: ['properties/risks/all'],
    },
  },
};

// ---------------------------------------------------------------- self-documentation
function describe(schema, depth = 0) {
  if (schema.type === 'object') {
    const req = new Set(schema.required ?? []);
    const parts = Object.entries(schema.properties).map(([k, s]) => `${k}${req.has(k) ? '' : '?'}: ${describe(s, depth + 1)}`);
    return `{ ${parts.join(', ')} }`;
  }
  if (schema.type === 'array') return `[${describe(schema.items, depth + 1)}] (${schema.minItems ?? 0}–${schema.maxItems ?? '∞'} items)`;
  if (schema.enum) return schema.enum.map((e) => JSON.stringify(e)).join('|');
  const range = schema.minimum !== undefined || schema.maximum !== undefined ? ` ${schema.minimum ?? ''}–${schema.maximum ?? ''}` : '';
  const len = schema.maxLength ? ` ≤${schema.maxLength} chars` : '';
  return `${schema.type}${range}${len}${schema.description ? ` (${schema.description})` : ''}`;
}

/** The field guide for one template: what the model sees when it gets a body wrong. */
export function templateGuide(name) {
  const t = TEMPLATES[name];
  return `Template "${name}" (${t.question}) — ${t.purpose}\nbody (fields ending ? are optional): ${describe(t.schema)}\nValid example body: ${JSON.stringify(t.example)}`;
}

const templateList = () =>
  Object.entries(TEMPLATES)
    .map(([k, t]) => `${k} — "${t.question}" ${t.purpose}`)
    .join('\n');

// ---------------------------------------------------------------- learning
const LESSONS_KEY = 'ui_block_lessons';

/** Lesson memory: what went wrong before, per template, with counts. Storage is injectable for tests. */
export class LessonBook {
  constructor(storage = globalThis.chrome?.storage?.local ?? null) {
    this.storage = storage;
    this.cache = null;
  }
  async all() {
    if (this.cache) return this.cache;
    try {
      this.cache = (this.storage ? (await this.storage.get(LESSONS_KEY))[LESSONS_KEY] : null) ?? {};
    } catch {
      this.cache = {};
    }
    return this.cache;
  }
  async record(template, problems) {
    const book = await this.all();
    const t = (book[template] ??= {});
    // normalise array indexes ("lines/3", "rows[0]") so the same mistake on any item is one lesson
    for (const p of problems) {
      const key = p.replace(/\/(\d+)(?=[:/.]|$)/g, '[]').replace(/\[\d+\]/g, '[]');
      t[key] = (t[key] ?? 0) + 1;
    }
    try {
      await this.storage?.set({ [LESSONS_KEY]: book });
    } catch {
      /* best-effort */
    }
  }
  /** Most frequent past mistakes as prompt text (empty string when none). */
  async text(limit = 6) {
    const rows = Object.entries(await this.all())
      .flatMap(([template, problems]) => Object.entries(problems).map(([p, n]) => ({ template, p, n })))
      .sort((a, b) => b.n - a.n)
      .slice(0, limit);
    if (!rows.length) return '';
    return `Lessons from your earlier render_ui_block mistakes — avoid repeating them:\n${rows.map((r) => `- ${r.template}: ${r.p} (${r.n}×)`).join('\n')}`;
  }
}

/** Stored call args → { template, body } exactly as the tool accepted them (panel uses this). */
export function normaliseBlockArgs(args) {
  let body = args?.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  return { template: resolveTemplate(args?.template), body };
}

/** "yield", "show_yield_comparison", "Yield" → "yield" (null when unknown). */
export function resolveTemplate(name) {
  const n = String(name ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (TEMPLATES[n]) return n;
  return Object.keys(TEMPLATES).find((k) => TEMPLATES[k].title === n || n === `show_${k}`) ?? null;
}

// ---------------------------------------------------------------- the tool
export function uiBlockTool({ lessons = new LessonBook() } = {}) {
  return tool({
    name: 'render_ui_block',
    label: 'Drawing a card',
    concludes: true,
    description: `Attach ONE visual card under your reply (shown when asked — never several at once). Write your 1–2 sentence answer as normal text in the same message, then call this. Pick the template that answers the investor's question, fill body from the listing brief (never invent numbers), and keep text short — it renders in a 420 px panel.
Templates:
${templateList()}
If the body is wrong you'll get back exactly what to fix plus a valid example; correct it and call again.`,
    // Loose outer schema on purpose: template + body are checked INSIDE execute so every
    // mistake gets the self-documenting error (generic arg validation can't teach).
    input_schema: {
      type: 'object',
      properties: {
        template: { type: 'string', description: `which card: ${Object.keys(TEMPLATES).join(' | ')}` },
        body: { type: ['object', 'string'], description: "the card's data as a JSON object — shape depends on the template (see the template's field guide)" },
      },
      required: ['template', 'body'],
    },
    execute: async (args) => {
      const template = resolveTemplate(args.template);
      if (!template) {
        await lessons.record('unknown', [`template "${args.template}" does not exist`]);
        throw new ToolError(`render_ui_block: unknown template "${args.template}"`, {
          hint: `Use one of these template keys (exactly):\n${templateList()}`,
          retryable: true,
          error_code: 'unknown_template',
        });
      }
      let body = args.body;
      if (typeof body === 'string') {
        // models often send nested objects as a JSON string — accept it, but teach the right shape
        try {
          body = JSON.parse(body);
        } catch {
          await lessons.record(template, ['body was a string that is not valid JSON — pass body as an object']);
          throw new ToolError('render_ui_block: body must be a JSON object, not a string', {
            hint: `Pass body as an object.\n${templateGuide(template)}`,
            retryable: true,
            error_code: 'invalid_block_body',
          });
        }
      }
      const t = TEMPLATES[template];
      const problems = validate(t.schema, body).map((p) => p.replace(/^<root>/, 'body').replace(/^(?!body)/, 'body.'));
      if (problems.length) {
        await lessons.record(template, problems);
        throw new ToolError(`render_ui_block: the "${template}" body is invalid — ${problems.join('; ')}`, {
          hint: `Fix exactly these problems and call render_ui_block again with the corrected body.\n${templateGuide(template)}`,
          retryable: true,
          error_code: 'invalid_block_body',
        });
      }
      return JSON.stringify({ rendered: true, template, note: 'The card is shown under your message. Do not restate its numbers; your sentence should interpret them.' });
    },
  });
}
