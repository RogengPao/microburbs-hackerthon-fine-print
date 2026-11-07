# Fine Print — pitch

Two parts: a **45-second team pitch** (just us talking, no screen) and a **short demo**.

---

## Part 1 · 45-second pitch (~115 words)

Problem first. One idea per speaker. Speak slower than feels natural.

**Jake — the problem (~22s)**

> Buying an investment property is an eight-hundred-thousand-dollar decision, made on a page written to sell it to you.
>
> The listing tells you the kitchen is light-filled. It doesn't tell you what you'll really pay — in Sydney, homes that beat their guide sold a median $117,500 over the top of it. It doesn't tell you what it'll cost you each week. And it doesn't tell you a build-to-rent tower finishes down the road in year three of your hold, competing for your tenant.

**Carlos — what we built (~13s)**

> Fine Print sits beside every REA and Domain listing. Press F, and you see the likely sale price, your weekly cost, and when new supply lands — all from Microburbs data.

**Yong — why people will use it (~10s)**

> No sign-up, both portals, one key. Thirteen million Australians are on REA every month, and none of the extensions beside it tells you what a property will cost you each week. Fine Print: read it before you buy it.

---

## Part 2 · Demo (~90s, one driver, one narrator)

Every beat proves the problem we just named. Numbers in [brackets] come off the panel on the day; skip any beat whose number doesn't come back.

1. **Press F (0:00–0:10)** — on the REA listing. *"Same listing, press F."* Panel slides in, gauge counts up.
2. **The real price (0:10–0:30)** — *"Guide says [$850K]. This agency sells [1.4% under] its quotes, so likely sale is [$838K] — [over] my budget, and it tells me."* Hover the legend; tooltip glides.
3. **Weekly cost (0:30–0:45)** — *"[4] similar rentals within a kilometre: rent [$775] a week, [4.7%] yield, and with my deposit it costs me [$181] a week."*
4. **When supply lands (0:45–1:05)** — the new-homes card. *"[504] build-to-rent homes finish within a kilometre around [2031] — year [5] of my hold, right when I'm re-leasing."*
5. **Their example, on Domain (1:05–1:20)** — switch tab to the organisers' Waterloo listing. *"Works the same on Domain — this is your Waterloo example."* (Shows both portals and the address match.)
6. **The shortlist (1:20–1:35)** — click the toolbar icon. *"Everything I shortlist lands in a spreadsheet: sort by yield, add my own formula, copy to Excel."*

**Don't demo live:** the "Ask it anything" agent beat — it depends on the model and a rate-limited API. Mention it in Q&A instead.

## Before recording

- [ ] Extension reloaded from `extension/dist`; investor brief set (budget, deposit, min yield, hold years)
- [ ] Tabs open: Zetland (REA), the organisers' Waterloo example, a second Domain listing as backup
- [ ] Every listing opened once already (cache warm → instant on camera; the API rate-limits)
- [ ] 3–4 properties shortlisted, a "My offer" typed on one
- [ ] Pick a listing where the supply card has real numbers — it's our differentiator
- [ ] Close other tabs, hide bookmarks bar, 100% zoom

## Wording we avoid

- **"54% of landlords lost money"** — invites "that's negative gearing, on purpose". Our problem is *visibility*, not loss.
- **"Only one showing development"** — Property Mate has a development radar. Our claim is *timing against your hold* plus weekly cost.
- **"None does the investor's maths"** — YieldMate shows yield. Say "none tells you what it'll cost you each week".
- **Free tier → Microburbs subscription** — not built. Frame the business case as distribution: Microburbs data at the moment of decision.

## Claims and sources (for the Q&A)

| Line | Source |
|---|---|
| 2.3M landlords, 1.27M (54%) made a rental loss | ATO Taxation Statistics 2023–24, Table 8 |
| Sydney above-guide sales a median $117,500 over the top of range | Homer data via Mortgage Professional Australia, May 2026 |
| 13M Australians on REA a month | REA / Ipsos iris, Oct 2025 |
| ~10,000 users for the category leader | Chrome Web Store (Homer), 7 Nov 2026 |
| NSW build-to-rent pipeline ~17,000 homes | BDO build-to-rent data 2026 |
| Agency quoting record | Microburbs API (per listing) |

**If asked "isn't Sydney under-supplied?":** yes, city-wide. Our point is that risk is local and timed — a build-to-rent tower finishing 300 m away in year 2 of your hold matters even in a short market.

**If asked "how is supply timing worked out?":** completion ≈ lodgement + about 9 months to approval + 18–42 months to build by size, spread over ±1 year. Stated as an estimate in the panel.

**Don't claim** "the only one that shows development" — Property Mate has a development radar. Our claim is *timing against your hold* plus the investor maths.
