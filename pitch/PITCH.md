# Fine Print — pitch (2:45)

**One line:** Fine Print reads the fine print on any REA or Domain listing — what it'll really sell for, what it'll cost you to hold, and when new supply lands on your rent — right beside the listing.

**Who it's for:** property investors. 2.3 million Australians own a rental; 13 million browse realestate.com.au every month.

**Judged on take-up**, so every beat shows *why someone installs it and keeps it open*: zero setup, both portals, one key (F), and a shortlist they live in.

Read time ≈ 2:40 at a relaxed pace (~390 words). Numbers in [brackets] are read off the panel on recording day.

---

## 0:00 – 0:20 · The problem (face to camera, or the REA listing full screen)

> More than half of Australia's 2.3 million landlords lost money on their rental last year. That's 1.27 million people, from the ATO's own numbers.
>
> And the listing doesn't help. In Sydney, homes that beat their price guide sold a median $117,500 over the top of it. The listing tells you the kitchen is light-filled. It doesn't tell you what you'll actually pay, or what it'll cost you every week.

**Screen:** a real REA listing (Zetland, 20/8 Grandstand Parade). Hidden-price guide visible. Fine Print collapsed in the corner.

## 0:20 – 1:05 · The read (press F)

> So we built Fine Print. You're on a listing, you press F.

**Screen:** press F. Panel slides in, gauge counts up.

> First — what it'll really sell for. The guide says [$850K]. Microburbs knows this agency's record: [Morton Green Square] sells [1.4% under] its quotes, so the likely sale is [$838K] — and that's [over] my [$800K] budget, so it tells me.
>
> Second — the investor's maths, done for you. [4] similar rentals within a kilometre put rent at [$775] a week. That's a [4.7%] yield, and with my deposit it's costing me [$181] a week out of pocket. Nobody shows you that on the listing.

**Screen:** hover the legend → tooltip glides between the numbers.

## 1:05 – 1:40 · The thing nobody else does: *when* supply lands

> Third — and this is the one we're proudest of. Everyone tells you "there's development nearby". We tell you *when*.
>
> [504] build-to-rent homes complete within a kilometre around [2031] — that's year [5] of my hold, right when I'm re-leasing. Build-to-rent towers compete directly for my tenant. That's a rent risk you can't see anywhere else, and NSW has 17,000 of these homes in the pipeline.

**Screen:** the new-homes card, bars by hold year, peak year highlighted.

## 1:40 – 2:05 · Ask it anything

> It's an agent, so I can just ask. "What should I offer?"

**Screen:** tap a suggested question. Tool steps tick, offer card renders.

> It uses the same Microburbs data — sales, rents, the agency's record — and gives me an offer range with the reasoning.

## 2:05 – 2:25 · The shortlist (where they live)

> Every listing I like, I hit Shortlist. And this is where investors actually live: a spreadsheet of every property, every Microburbs number. Sort by yield, filter to under [$900K], and add my own columns — here's "yield at my offer", a formula. Then copy it straight into Excel.

**Screen:** shortlist tab → sort by yield → type `<900k` in Price filter → type an offer → "Yield at my offer" recalculates → Copy.

## 2:25 – 2:45 · Why it gets taken up — the business case

> Take-up is the whole game. It works on both REA and Domain, there's no sign-up, and it's one key to open. The most popular extension in this category has about 10,000 users — out of 13 million people on REA every month — and none of them does the investor's maths.
>
> For Microburbs, Fine Print is distribution: your data, at the exact moment someone's deciding, and a free tier that leads straight to a Microburbs subscription. Fine Print — read it before you buy it.

**Screen:** split REA / Domain with the panel open on both → end card: logo, "Fine Print — read it before you buy it", Microburbs data.

---

## Demo checklist (before recording)

- [ ] Extension reloaded from `extension/dist`; investor brief set (budget, deposit, min yield, hold years)
- [ ] Listings open in tabs: Zetland (REA), a Domain listing, the organisers' Waterloo example
- [ ] Each brief already loaded once (cache warm → instant on camera; the API rate-limits)
- [ ] 3–4 properties shortlisted so the spreadsheet has rows; a "My offer" typed on one
- [ ] Fill every [bracket] from the panel; delete any line whose number didn't come back
- [ ] Close other tabs, hide bookmarks bar, 100% zoom

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
