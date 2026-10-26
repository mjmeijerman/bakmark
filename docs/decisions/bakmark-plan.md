# De Ongeknipte Thuisbakker — execution plan

Decision record of the 4-round Agent Office meeting (Chair, Pragmatist, Skeptic), 1 round per part. Supersedes the original draft plan.

**One-line verdict:** the plan as written is a software project wearing a content business costume. Cut it to one video, one recipe page, one print view, one donate link — then let traffic decide what gets built next.

---

## 1. What this business is

- **Product:** no-cut (real-time, one-shot) baking videos of complete techniques, with chapters so they work as a real-time guide.
- **Site:** static, clean, no ads, no email walls. Printable recipe view, a bake mode that keeps the screen awake, findable recipes.
- **Money, year 1:** voluntary tips. Nothing else is real yet.
- **Chosen order of operations:** reach first, revenue second, product third. Every technical item is judged by whether it ships a video or moves a viewer one step.

---

## 2. Decisions

### D1 — Video 1 is soezendeeg. Publish order: soezendeeg → fondant → brooddeeg → chocolade tempereren → Italiaanse meringue

**Why:** the first take is a rig-and-audio experiment; burning the flagship (fondant) on it is wasteful. Soezendeeg is forgiving, has a visible payoff (it puffs), and finishes in a photogenic product. Fondant — the founder's actual thesis, and the highest-intent Dutch search query of the five — lands as video 2, three weeks later, with a proven production chain.

**Rejected:** fondant as video 1 (Pragmatist's position). It is the best *thesis*, but the worst *pilot*: 20+ minutes of white-on-white sugar work with the highest on-camera failure rate, shot on an untested rig. Fondant as flagship is preserved; fondant as first take is not.

### D2 — No-cut stays as the format. Kill/keep test: average view duration

- Premise kept. It is not only a differentiator, it is **production capacity**: editing is the skill the founder doesn't have, and a cut version costs 2–4 days per video that don't exist at 8–10 hours/week.
- Gate: **AVD ≥5 minutes**, read after videos 1 and 3. If AVD <35% of runtime at any read, the *next* video ships hybrid (uncut only for the transformation beats: tableren, tempereren, meringue peaks).
- A 40% retention on 20 minutes (8 min AVD) beats 50% on 8 minutes. Long uncut footage is an advantage for the 4,000-watch-hour monetisation threshold (≈12,000 full views), not a liability. This is why the earlier "retention dies at 40%" objection was withdrawn.

**Rejected:** hybrid from the start (Skeptic R1); a retention-percentage gate (both, withdrawn).

### D3 — Cadence: 1 video per 3 weeks, 5 videos in 15 weeks, 1-video buffer

- Per-video budget: **10–12 hours** (prep, 2–4 takes, cleanup, page, PDF, description, step-photo extraction, thumbnail). A failed no-cut take cannot be rescued in an edit — it is a full reshoot, which is what kills the "1 per 2 weeks" fantasy.
- Record videos 1 and 2 before publishing video 1. The buffer is what survives a bad week.

**Rejected:** 1 video / 2 weeks (Pragmatist, Skeptic) — arithmetically incompatible with their own 10–12h/video estimate at 8–10 usable hours per week. A 6th video in year 1 is upside, not a plan.

### D4 — Stack: static site (Astro) on a small VPS, recipe data as the single source of truth

`recipes/<slug>.json` holds everything: ingredients (`amount`, `unit`, `scale_by`, `scale: true|false`), steps (`id`, `duration`, `t=` timestamp, photo frame), tools (+ affiliate links), FAQ, `result` (what it makes), `yield`, `category`, `tags[]`, `difficulty`, `time`, `context` (the product story).

Rendered from that one file:
1. recipe page — result in the headline, context block, taxonomy as tags, bake mode toggle,
2. YouTube description + chapters (generator script),
3. print view, with or without photos, QR code always on the sheet,
4. later, the interactive scaler's inputs,
5. per-step photos, extracted from the video with ffmpeg at the step timestamps.

**Why:** write once, publish four times, zero drift between video, page and PDF. The bidirectional deep link (`site/recipe/x#step-3` ↔ `youtu.be/ID?t=SEC`) is the entire content↔tech synergy and costs ~2 hours.

**Rejected:** Gumroad/Teachable (own the asset, no 10% cut, no platform lock-in — but the site stays a *static* site, not a framework project); a CMS/admin panel; a React SPA (5 recipe pages do not need a client-side router); server-side PDF generation (no server to break — render in CI).

### D5 — The calculator: schema fields now, static scale table at launch, interactive scaler with the brooddeeg video

**The mistake the meeting caught:** the original plan wanted an interactive baker's-percentage calculator on every page. Baker's percentage is defined relative to flour. Four of the five launch recipes contain no flour — fondant is sugar/glucose/water, tempering is chocolate, meringue is egg white, soezendeeg is anchored on liquid/eggs. A flour-anchored calculator on the fondant page computes a percentage of nothing.

Therefore, in three steps:
1. **Gate A (mandatory, ~20 min):** `scale_by` and `scale:false` fields in the schema from day one. Eggs, yeast sachets, gelatine leaves, a vanilla pod and a pinch of salt do not scale linearly and need rounding rules. Adding these later is a data migration.
2. **Gate A (~2h):** a **static ½× / 1× / 2× table** generated at build time, per recipe, using that recipe's own reference ingredient, with non-scaling items shown as "2 eggs" / "1 sachet of yeast" and no false precision. Zero JavaScript, works with dough on your hands, on a phone, in a kitchen.
3. **With the brooddeeg video (first recipe with a real flour basis), ~1 day:** the interactive scaler — one input, live rescale, `?ref=500` URL state, `scale:false` respected, mounted in the ingredient block of recipes that have a reference ingredient.

**This knowingly departs from a founder hard requirement** ("interactive, on every page") and is recorded as a deviation, not a silent cut: the static table delivers the underlying need (scale the recipe) at ~2 hours instead of ~1–2 days, and the interactive version ships with the recipe that actually justifies it.

**Rejected:** interactive calculator in Gate A (Chair R1/R2, Pragmatist R1) — inapplicable on 4 of 5 recipes; "calculator on every page" (scope inflation); a traffic gate on the interactive version (Skeptic's original month-3 visit-count gate) — the right gate is content readiness, not traffic, or it ships never.

### D6 — Email: EU-owned provider (Brevo), hosted audience, weekly CSV export

- Brevo (France), free tier (300 mails/day) is enough for year 1. Hosted list gives double opt-in, unsubscribe and deliverability for €0 and ~1h.
- **Weekly CSV export** to a git-ignored folder: that export is the exit plan, so migrating to own Postgres later is a data move, not a rebuild.
- Own database + custom token-based unsubscribe only **above 1,000 contacts**. Below that, "AVG-proof" is satisfied by not holding the data yourself (no controller duties, no retention policy, no breach procedure).

**Rejected:** Resend (US company; an EU region is data residency, not EU jurisdiction — the founder's requirement was that the service runs in Europe); Amazon SES (same objection, plus setup cost); a self-built SQLite/Postgres + unsubscribe system at launch (12h building a compliance surface for a list of zero); manual Proton mailing (no automation, no double opt-in trail).

### D7 — Payment: site first, provider second, KvK in parallel

Sequence: build site + publish video 1 → **apply for Stripe** (supports one-off iDEAL for NL, works as an individual) in week 3–4 → Mollie after KvK and once donations are real. KvK registration runs parallel in weeks 0–1 (KOR on, <€20k turnover → no VAT administration) and blocks nothing.

**Why:** payment providers review your live site at signup. Applying in week 0, before there is a page with a recipe on it, invites a "complete your website" loop. And there is nothing to donate to until video 1 exists.

**Rejected:** Mollie-first as a week-0 blocker (Pragmatist R2, over-corrected); Tikkie/betaalverzoek as the primary fallback (app-first, no clean desktop pay-link, no fixed amounts — emergency-only); a custom Stripe/Mollie webhook ("thank you" mail at 0 donations), which stays out until there is a reason.

### D8 — Ads: off. Revisit only if a single video passes 50k views

1,000 subscribers + 4,000 watch hours are needed before AdSense is even available; Dutch baking RPM ≈ €2–5, so 10k views ≈ €20–50. That is a rounding error bought with the one promise the brand is built on ("100% clean, no banners").

**Rejected:** AdSense in phase 1 (original plan, gated on "if visitor numbers are high" — now a concrete 50k number).

### D9 — The book: pre-orders only, gated in series

Sequence, in series not parallel: **500 subscribers → €9 e-book (<30 sales from a warm list of 500 = the cookbook is not wanted) → 1,500 subscribers → POD pre-order page → print what is ordered.** No stock, no shop integration, no inventory risk. Book margin: no number in any document until a written Pumbo/BoekenGilde quote exists; assume €6–9 net — the original €13,90 was unverified and colour-interior POD can eat the entire margin.

**Rejected:** building POD drop-shipping in year 1 (most integration risk, zero value before an audience); selling the cookbook to a cold list; €13,90 net in any planning document.

### D10 — Funnel: one ask per page

`Dutch long-tail search → video → chapter deep link → recipe page → print view (no email wall) → donate directly under the print button (€3 / €7 / €15 / €25 + open field), plus the QR code on the printed sheet → email for the next recipe → e-book → pre-order`

- **Acquisition is search, not retention.** Year-1 traffic is Dutch long-tail ("soezendeeg maken", "banketbakkersfondant maken", "chocolade tempereren seeding"). Title = the literal Dutch query + `| zonder knippen`. Thumbnail = the finished product, close up. This is a bigger lever than any feature in this document.
- One metric per recipe page: **print-button click rate ≥10%** (Umami event). Below that the page is the problem, not the traffic.
- Donation placement is the whole game: under the print button, at the moment the recipe worked — not the header, not the footer. The QR code on the printed sheet carries the same ask into the kitchen.
- Email: one send per published video. Nothing else.

**Year-1 income expectation: €100–300, all sources.** Budget nothing on it.

### D11 — Budget (honest, verified lines only)

| Item | Cost |
|---|---|
| Hardware: floor tripod + overhead arm + ring light, DSP lavalier | €85–110 |
| Domain + VPS, year 1 | €25–40 |
| Ingredients, 5 videos incl. failures and test bakes | €150–250 |
| Props: marble board, backdrop, diffuser | €60–90 |
| KvK registration (verify the fee on kvk.nl — €52 or €75, do not guess) | €52–75 |
| Brevo / Umami / Astro / ffmpeg / print-CSS | €0 |
| **Year 1 total** | **€370–575**, ≈ €3–5/month recurring |

Build to video 1: **~22–26h**, plus ~12–18h of content and shooting. Per video after that: 10–12h.

**Rejected:** the original €110 one-off budget — it counts hardware and hosting and forgets food, props and registration. Understating it by 4× is how a side project dies in month two.

### D12 — Recipes must be findable: the taxonomy is data from day one, the search UI is not

Every recipe carries `category`, `tags[]`, `difficulty` (1–3), `time` (active + total) and `result`. They are shown on the recipe page and on the recipe card, not hidden in metadata.

- **In Gate A:** the fields, ~30 minutes while writing `soezendeeg.json`. Retrofitting a taxonomy over five finished recipes is a data migration.
- **Not in Gate A:** search and filter. Facets (category, difficulty, time, site search) ship at **recipe 4**. With one to three recipes the home page is simply a list; a search box over three items is decoration.

**Why:** in the first weeks findability is irrelevant, and in month six it is the navigation. The cheap half (the data) is paid once, early; the expensive half (the UI) waits for the content that justifies it.

**Rejected:** search/filter in Gate A (solves a problem the site cannot have yet); free-text tags without a fixed category list (five spellings of "deeg"); search only, no categories (you cannot browse a category you cannot name).

### D13 — No PDF. A print view with a photo choice and a QR code.

The PDF is cut. Printing is handled by a print button that builds a print view from the same data, with one choice: **met foto's** / **zonder foto's**. The donate QR code prints on both variants, always.

**Why:** the PDF only ever existed to be printed. A print view removes a build pipeline (~2h in Gate A plus its maintenance), removes a second artifact per recipe that can go stale, and hands the printer the same sheet. "Zonder foto's" matters because a recipe you are actually cooking from does not want four pages of pictures on the counter.

**Consequence for D10:** the conversion metric changes from "PDF download rate ≥10%" to "**print-button click rate ≥10%**" (an Umami event), and the printed sheet replaces the PDF as the place the donate ask lives last.

**Rejected:** build-time PDF per recipe (removed); print button without the photo choice (the printer gets photos whether they help or not); email-gated PDF (never); relying on the plain browser print (no photo choice, no QR code, no page-break control).

### D14 — The result is the headline: every recipe says what it makes

`result` — "300 gram fondant", "30 soezen" — is shown directly under the title, on the recipe card, in the print view and in the video description. Not in the third paragraph of the intro.

**Why:** it is the first thing a baker needs and the cheapest differentiator on the page: on Rutger's site you have to hunt the text for how much a recipe yields.

**Rejected:** result only in the intro text (that is the problem being fixed); result only in the structured data/SEO block (invisible to the reader).

### D15 — Bake mode: one toggle that keeps the screen awake

A "bakmodus" toggle on the recipe page using the Screen Wake Lock API: off by default, obvious state, a large tap target for wet hands, re-acquired on `visibilitychange`, and silent on unsupported browsers (no nag, no fallback dialog).

**Why:** people bake from a screen for 20+ minutes at a time. A phone that dims after 30 seconds makes the page useless exactly when it is being used. This is a kitchen-use requirement, not a feature.

**Rejected:** telling people to change their phone's sleep setting (a settings tutorial instead of one hour of work); a permanent wake lock (drains the battery of everyone who never asked); a PWA/install prompt as the "solution".

### D16 — Every recipe carries product context

A `context` block per recipe: what the product actually is, why the technique does what it does, when to use it, what goes wrong. 100–200 words, plain Dutch, written while writing the recipe. It is a data field, not a feature.

**Why:** teaching the *why* is what separates this site from a recipe dump, and it is the part of a page that earns links from search. It also gives the video description and the printed sheet something to say beyond a list of ingredients.

**Rejected:** a separate "kennisbank" section (a second content type to maintain before five recipes exist); context written as SEO padding (readers skip it and so does Google).

---

## 3. Roadmap

### Gate 0 — week 0, ~4h, €0
1. **3-minute silent no-cut test take** (phone, extractor hood on, one light source, soezendeeg). Watch it back on headphones. This is the €0 gate on both the format and the audio chain — and on whether a €25 lavalier beats the extractor fan at all.
2. Check KvK status. Not registered → register, KOR on. Verified fee goes in this document.
3. Fix the publish order (D1) and the cadence (D3).

### Gate A — weeks 1–3, ships video 1 · ~22–26h build
1. Domain + VPS + Caddy + static Astro deploy. *(3h)*
2. `recipes/soezendeeg.json` first: ingredients with `scale_by`/`scale:false`, steps with `id`/`duration`/`t=`/photo frame, tools, FAQ, `result`, `yield`, `category`, `tags`, `difficulty`, `time`, `context`. *(2–3h)*
3. Recipe page template + static ½×/1×/2× scale table + step photos from video frames. `result` directly under the title, context block at the top, taxonomy as visible tags. *(5h)*
4. Print button → print view, "met foto's" / "zonder foto's", QR code to the donate block on both. *(2h)*
5. Bake mode toggle — Screen Wake Lock, off by default, re-acquired on `visibilitychange`. *(1h)*
6. Umami self-hosted, cookieless, no cookie banner. *(2h)*
7. Chapter/description generator — must enforce YouTube's rules: ≥3 timestamps, first at `00:00`, each ≥10s. 20 minutes of unbroken kneading needs 5–6 named phases ("kneden", "rust", "vormen") for skippability. *(2h)*
8. ffmpeg step-frame extractor. *(1h)*
9. Brevo hosted form + double opt-in + weekly CSV export. *(1h)*
10. Donate block under the print button: Stripe payment link, €3/€7/€15/€25 + open field. *(1h)*
11. Legal minimums: privacy statement, contact page, AVG note on the form. *(1h)*
12. Record videos 1 and 2, publish video 1.

**Not in Gate A:** search/filter pages (D12 — they ship at recipe 4), interactive calculator, i18n routes, own email DB, affiliate module, AdSense, English anything, livestreams, accounts/comments.

### Gate B — weeks 4–15, cadence
- Video 2 (fondant, the flagship) → 3 (brooddeeg, **interactive scaler ships here**) → 4 (tempereren) → 5 (meringue). 1 per 3 weeks.
- Per-recipe FAQ, tools and context (D16) live as data fields, written while writing the recipe. No "FAQ feature".
- **Search + filter** by category, difficulty and time, plus site search, as soon as recipe 4 is live. Three recipes do not need facets; four do. *(~1 day)*
- Affiliate links once bol.com approves. Expect €0–15/month; no module, just fields in the recipe file.
- Read AVD after video 3. <35% of runtime → video 4 ships hybrid.

### Gate C — months 8–12, gated on evidence
| Build | Gate to pass first |
|---|---|
| Own Postgres + token unsubscribe | >1,000 contacts |
| i18n route prefix | 5 videos live (locale file from day 1, zero English content) |
| €9 PDF e-book to the warm list | ≥500 subs; <30 sales → stop, no cookbook |
| POD pre-order page (no shop integration, no stock) | ≥1,500 subs + e-book validated + written Pumbo quote |
| English: subtitles first, voice-cloning second | proven English demand; disclose the cloning when it happens |

---

## 4. Five operating rules (the part that keeps this alive)

1. **After video 1 publishes, no new feature ships unless the next video is already recorded.** Programmer plus empty repo is the most likely cause of death here — above retention, above revenue.
2. **Copy the take off the phone the same night and verify it plays.** Airplane mode means no cloud sync, no second camera, no re-edit. Ten minutes against a lost shoot day.
3. **60-second headphone audio test before every take.** No-cut means one cough or fridge hum ruins 20 minutes.
4. **No commercial background music, ever.** Ambient room tone + voice. A claimed video takes the channel and the affiliate account with it.
5. **One ask per page. Title = the Dutch search query.**

---

## 5. Options that lost, and why

| Option | Rejected because |
|---|---|
| Full original plan (calculator, email DB, POD shop, AdSense, English all in year 1) | ~60% too big for 8–10 hours/week; none of it earns before video 1 exists |
| Gumroad/Teachable instead of a custom site | Loses the clean-design and no-email-wall promise, and 10% of the only revenue that exists |
| Full brand/design system before launch | Comfortable procrastination; 5 recipe pages do not need it |
| Interactive calculator at launch, on every page | Inapplicable on 4 of 5 recipes; ~1–2 days for a feature nobody has asked for yet |
| Own email database + custom unsubscribe at launch | 12h to build a compliance surface for a list of zero; Brevo hosted + CSV export gives the same exit plan for 1h |
| Resend / Amazon SES | US-owned; the requirement was that the service runs in Europe |
| Mollie as a week-0 blocker | Requires KvK, and providers review a live site; Stripe covers the gap, KvK runs in parallel |
| AdSense in year 1 | €20–50/year against the brand's core promise; gated at 50k views/video |
| POD integration (Pumbo/BoekenGilde drop-shipping) in year 1 | Real integration risk, zero value before 1,500 warm subscribers; pre-orders instead |
| €13,90 net per book in planning | Unverified; colour POD plus 9% VAT can erase it |
| Livestreams / Patreon / memberships / Discord / comments / user accounts | Each costs maintenance hours that belong to videos 1–5 |
| 10 videos in year 1 | At 10–12h per video that is 100–120 hours of production; 5 is the honest number |
| Build-time PDF per recipe | Removed: a print button that builds a print view gives the same sheet, needs no pipeline and cannot go stale |
| Search/filter UI in Gate A | Three recipes do not need facets. The taxonomy *fields* ship in Gate A; the UI ships at recipe 4 |
| Screen sleep left to the phone's settings | The page is used with dough on both hands; one hour of wake-lock beats a settings tutorial |

---

## 6. Still open

1. **KvK fee** — one verifiable number (€52 or €75) from kvk.nl. Two notes disagree; a plan that gets a one-line number wrong gets discounted entirely.
2. **Founder sign-off on D5** — the static scale table replaces "interactive on every page" for the first five recipes. This is a deliberate deviation from a stated hard requirement and needs a yes.
3. **Search demand check** — confirm relative Dutch search volume for `soezendeeg maken` vs `banketbakkersfondant maken` before locking the publish order; if fondant dwarfs it, swap videos 1 and 2 and accept the rig risk.
4. **Donation conversion** — 0.3–1% of engaged visitors at €5–10 is an assumption, not a measurement. First real number after video 1.
5. **Pumbo/BoekenGilde quote** — required before any book copy or margin figure is written.
6. **Video length target** — 20 minutes suits chapters and watch hours; 12–15 minutes may suit retention. Decide after the video-1 AVD number.
7. **Business structure** — eenmanszaak + KOR assumed. Confirm before the first invoice.
8. **Whether the founder actually has 8–10 hours/week.** Every date in this document is derived from that number.
9. **QR code target and size** — does it encode the donate block anchor or the Stripe payment link, and does it still scan at ~2 cm on a home printer? Test on paper, not on screen.

---

## 7. First 10 working days

1. **Day 1 (2h):** week-0 test take, headphones, verdict on format and audio.
2. **Day 2 (1h):** KvK status + verified fee; write the number into this file.
3. **Day 3–4 (6h):** domain, VPS, Astro deploy, `recipes/soezendeeg.json`.
4. **Day 5–7 (8h):** recipe page template, static scale table, print view, bake mode.
5. **Day 8 (3h):** Umami, chapter generator, ffmpeg frame extractor.
6. **Day 9 (2h):** Brevo form, donate block, legal pages.
7. **Day 10:** shoot take 1 of soezendeeg. Second take if the first one fails — that is normal, not a setback.

**Then:** publish video 1, and the next feature is not allowed until video 2 is recorded.
