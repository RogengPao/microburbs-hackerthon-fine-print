# Design — Fine Print v3 ("instrument on paper")

Exported from the Paper prototype ([file](https://app.paper.design/file/01M6QMF6C4XBF7VKEADCK9CXFA/p-3-0)) for the React + Tailwind build.

| Folder | What |
|---|---|
| `screens/` | Full artboards at 1×: A setup · B listing + panel · C ask "what should I offer?" · D chat components |
| `components/` | Each part at 2×: the 3 panel states, the Shortlist button, 9 chat cards |
| `jsx/` | The same parts as **Tailwind JSX** (static mocks, verbatim from Paper) |
| `tokens.css` | Design tokens as a Tailwind v4 `@theme` block |

## Panels (the slide-out, 420 px wide)

| State | Screenshot | JSX | Data from the brief (`extension/docs/brief.md`) |
|---|---|---|---|
| Setup (first run) | `components/panel-setup@2x.png` | `jsx/panel-setup.jsx` | settings: budget, deposit, min yield, hold years |
| Read (the listing) | `components/panel-read@2x.png` | `jsx/panel-read.jsx` | `property`, `price.*` (gauge: value / asking / budget / likely), `returns`, `weekly_cost`, `market.unit_vacancy_pct`, signals from `supply`, `price.agency`, `rent` |
| Ask (chat) | `components/panel-ask@2x.png` | `jsx/panel-ask.jsx` | agent thread + one card per tool answer |
| Shortlist button | `components/shortlist-button@2x.png` | `jsx/shortlist-button.jsx` | sits **outside** the panel, under it, full width |

## Chat cards (one per agent answer, shown only when asked)

`card-yield` · `card-supply` · `card-cash-flow` · `card-value` · `card-area` · `card-offer` · `card-hold` · `card-property` · `card-overlays`

Each card has a **Trigger** row (the question) and a **Body** (sentence + chart). Map them to brief fields:

| Card | Brief fields |
|---|---|
| yield | `rent.*`, `returns.gross_yield_pct_*`, `market.suburb_unit_yield_pct` |
| supply | `supply.*` (largest DAs with km + dwellings, build-to-rent) |
| cash flow | `weekly_cost.*` |
| value | `price.value`, `price.asking`, `price.likely_sale`, `recent_sales` |
| area | `market.*` |
| offer | `price.likely_sale`, `price.agency`, `recent_sales`, `competition` |
| hold | `market.unit_growth_5y_pct`, `weekly_cost`, investor hold years |
| property | `property.*`, `price.last_sold`, `risks` |
| overlays | `risks[]` |

## Style rules

- Palette: paper `#FBFAF6` panel, `#F3F0E8` cards, `#E6E1D6` lines, ink `#1E1D1B`, muted `#8C877D`.
- **Blue `#2F64D9`** = good / this property / primary actions. **Yellow `#E3A008`** (ink `#9A6A00`) = warning. No red, no pink.
- Fonts: **Instrument Serif** for big readouts, **Geist** for UI, **Geist Mono** for metadata and labels.
- Rows that dig in must look tappable (chevron, hover).
- Say "property" or "apartment", never "flat".
- The JSX is a static mock with hard-coded Zetland numbers, so swap the text for brief fields. The gauge is an SVG of tick lines, so recompute the tick colours from value / asking / likely / budget.
