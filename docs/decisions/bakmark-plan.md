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

**Why:** the first take is a rig-and-audio experiment; burning the flagship (fondant) on it is wasteful. Soezendeeg is forgiving, has a visible payoff (it puffs), and finishes in a photogenic product. Fondant — the founder's actual thesis, and the highest-intent Dutch search query of the five once corrected from `banketbakkersfondant maken` to `fondant maken` — lands as video 2, with a proven production chain. See [`search-demand-soezendeeg-vs-fondant.md`](search-demand-soezendeeg-vs-fondant.md).

**Rejected:** fondant as video 1 (Pragmatist's position). It is the best *thesis*, but the worst *pilot*: 20+ minutes of white-on-white sugar work with the highest on-camera failure rate, shot on an untested rig. Fondant as flagship is preserved; fondant as first take is not.

### D2 — No-cut stays as the format. Kill/keep test: average view duration

- Premise kept. It is not only a differentiator, it is **production capacity**: editing is the skill the founder doesn't have, and a cut version costs 2–4 days per video that don't exist at 8–10 hours/week.
- Gate: **AVD ≥5 minutes**, read after videos 1 and 3. If AVD <35% of runtime at any read, the *next* video ships hybrid (uncut only for the transformation beats: tableren, tempereren, meringue peaks).
- A 40% retention on 20 minutes (8 min AVD) beats 50% on 8 minutes. Long uncut footage is an advantage for the 4,000-watch-hour monetisation threshold (≈12,000 full views), not a liability. This is why the earlier "retention dies at 40%" objection was withdrawn.

**Rejected:** hybrid from the start (Skeptic R1); a retention-percentage gate (both, withdrawn).

### D3 — No calendar cadence: a video ships when it is recorded, five videos is the count, not a promise

*Revised 2026-10-26: the founder confirmed there is no deadline. Output is elastic — more free time means more videos, less means fewer.*

- **There is no target date anywhere in this plan, and no cadence to hit.** The order is fixed (D1); the timing is not.
- **Per-video budget stays 10–12 hours** (prep, 2–4 takes, cleanup, page, description, step-photo extraction, thumbnail). Not a deadline, just the honest size of a video, which is what makes any estimate trustworthy.
- **Record videos 1 and 2 before publishing video 1.** That is a buffer against a bad week, not a schedule: it means a second video exists before the first one can disappoint.
- **The only pacing rule left is operating rule 1** (§4): no new feature ships while the next video is unrecorded. That is enough to keep the project from turning into a repo with no videos in it.
- Five videos in year 1 is the expected count at 8–10 spare hours per week. More hours, more videos; fewer, fewer. A sixth is upside, never a plan.

**Why:** a deadline nobody asked for gets invented justification for itself — the earlier version then rejected faster cadences *arithmetically*, which quietly turned an elastic hobby into a missed schedule. Order without dates keeps the discipline and drops the guilt.

**Rejected:** 1 video per 3 weeks (a self-imposed deadline, and the reason the plan spent a paragraph defending its own arithmetic); 1 video per 2 weeks (same, worse); batching takes to "catch up later" (uncut takes do not batch — a bad take is a reshoot, not an edit).

### D4 — Stack: static site (Astro) on a small VPS, recipe data as the single source of truth

`recipes/<slug>.json` holds everything: ingredients (`amount`, `unit`, `scale_by`, `scale: true|false`), steps (`id`, `duration`, `t=` timestamp, photo frame), tools (+ affiliate links), FAQ, `result {value, unit}` (what it makes), `yield`, `category`, `tags[]`, `difficulty`, `time`, `context` (the product story), `tin` (shape + dimensions), `bake` (time, temperature).

Rendered from that one file:
1. recipe page — result in the headline, context block, taxonomy as tags, bake mode toggle,
2. YouTube description + chapters (generator script),
3. print view, with or without photos, QR code always on the sheet,
4. later, the interactive scaler's inputs,
5. per-step photos, extracted from the video with ffmpeg at the step timestamps.

**Why:** write once, publish four times, zero drift between video, page and print view. The bidirectional deep link (`site/recipe/x#step-3` ↔ `youtu.be/ID?t=SEC`) is the entire content↔tech synergy and costs ~2 hours.

**Local first.** The site runs at `localhost` from the first hour of work. Domain, VPS and TLS are one late Gate A step, because only analytics and the signup form need a live URL — the design, the recipe JSON, the page template, the print view and the bake mode can all be built, looked at and fixed on a laptop. Nothing in this plan waits on a server existing.

**Rejected:** Gumroad/Teachable (own the asset, no 10% cut, no platform lock-in — but the site stays a *static* site, not a framework project); a CMS/admin panel; a React SPA (5 recipe pages do not need a client-side router); server-side PDF generation (no server to break — render in CI).

### D5 — The calculator is a proportional rescaler, not a baker's percentage

*Revised 2026-10-26 after the founder clarified the intent (issue #77). The meeting read "calculator" as an interactive **baker's-percentage** calculator, flour-anchored, and judged it inapplicable because four of the five launch recipes contain no flour. That reading was wrong: the intent was never flour-anchored, so the applicability objection is void.*

What the feature actually is:

1. **Any ingredient is a driver.** Change the amount of one ingredient, every other scalable amount follows proportionally. Items marked `scale: false` do not follow — eggs, yeast sachets, gelatine leaves, a vanilla pod, a pinch of salt — they round.
2. **The result is a driver, both ways.** "300 gram fondant" and "30 soezen" are inputs, not just labels: ask for 30 soezen and the ingredient list rescales; change an ingredient and the displayed result updates.
3. **The tin is a driver** (D17) for anything baked in a bakvorm: change the diameter, shape or height and the ingredients rescale on volume.
4. **Rounding is a rule, not a guess.** Every scaled amount is formatted per ingredient: grams to sensible precision, eggs in halves then wholes, sachets in wholes. No false precision, no "1.333 eggs".

Order of work:
1. **Gate A (~20 min):** the schema fields — `scale`, `scale_by`, `unit` per ingredient, `result {value, unit}`, `tin`, `bake`. Adding these later is a data migration.
2. **Gate A (~2h):** the **static ½× / 1× / 2× table**, generated at build time per recipe, non-scaling items shown as "2 eggs" / "1 sachet of yeast". Zero JavaScript, works with dough on your hands.
3. **Weeks 4–6 (~1–2 days):** the **interactive rescaler on every recipe page**. Live rescale, `?ref=500` / `?result=30` URL state, `scale: false` respected, mounted in the ingredient block. Not gated on the brooddeeg video and not gated on traffic — applicability and traffic were never the real constraint, only hours.

**Why the static table still ships:** it is 2 hours against 1–2 days, it works when JavaScript does not, and it is the layout the interactive version plugs into. It is a step, not a substitute.

**Rejected:** a flour-anchored baker's-percentage calculator (the misreading — computes a percentage of nothing on the fondant page); the interactive rescaler in Gate A (the budget is full at 22–26h, and Gate A exists to publish video 1); gating the rescaler on the brooddeeg video or on visit counts (both artificial once the flour premise is gone); the rescaler as a separate calculator page (rescaling belongs where the recipe is).

### D6 — Email: EU-owned provider (Brevo), hosted audience, weekly CSV export

- Brevo (France), free tier (300 mails/day) is enough for year 1. Hosted list gives double opt-in, unsubscribe and deliverability for €0 and ~1h.
- **Weekly CSV export** to a git-ignored folder: that export is the exit plan, so migrating to own Postgres later is a data move, not a rebuild.
- Own database + custom token-based unsubscribe only **above 1,000 contacts**. Below that, "AVG-proof" is satisfied by not holding the data yourself (no controller duties, no retention policy, no breach procedure).

**Rejected:** Resend (US company; an EU region is data residency, not EU jurisdiction — the founder's requirement was that the service runs in Europe); Amazon SES (same objection, plus setup cost); a self-built SQLite/Postgres + unsubscribe system at launch (12h building a compliance surface for a list of zero); manual Proton mailing (no automation, no double opt-in trail).

**Sending setup (checked 2026-10-26, after the founder flagged Brevo's authentication):** Brevo's default infrastructure puts the *envelope* on their own shared domains — return-path `brevosend.com`, tracking and images on `brevolinks.com` — so SPF passes on Brevo's domain, not ours, and that SPF covers every Brevo customer. DKIM is **not** shared: keys are per sending domain in our account (1 TXT or 2 CNAMEs). Sending unauthenticated is no longer possible: Gmail/Yahoo required it from Feb 2024, Microsoft from May 2025.

Therefore:

- **Send from a subdomain, not the root**: `news.<domein>`. Reputation damage stays off the domain that serves the site.
- **DKIM + DMARC**, always. DMARC starts at `p=none` for two weeks (watch reports), then `p=quarantine`, then `p=reject`.
- **Branded subdomain** (own domain for return-path, tracking and images, e.g. `mail.news.<domein>`) if the account has the new flow: it makes SPF *aligned* and lets a strict DMARC policy rest on two signals instead of DKIM alone. Optional on shared IPs, strongly recommended, and not yet rolled out to every account — so check, don't assume.
- **Never add `include:spf.sendinblue.com` to the root domain.** It authorises Brevo's whole shared IP space for the domain that serves the website. Not needed: DKIM carries DMARC alignment.
- **Shared IP stays.** A dedicated IP is paid and needs warming; at five emails a year it buys nothing.

**The cost of free:** the Brevo logo is added to every email on the Free plan. Removing it is a paid add-on (~€9/month, from Starter up), i.e. ~€108/year against a year-1 income expectation of €100–300. Open question §6.11: accept the logo, pay, or switch provider. The logo is an ESP footer — the brand promise is about ads, tracking walls and paywalls on the site, not about a mail footer — so the default is to accept it for year 1 and revisit when the list has value.

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

- **Acquisition is search, not retention.** Year-1 traffic is Dutch long-tail ("soezendeeg maken", "fondant maken", "chocolade tempereren seeding"). Title = the literal Dutch query + `| zonder knippen`. Thumbnail = the finished product, close up. This is a bigger lever than any feature in this document.
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

Build to video 1: **~27–33h**, plus ~12–18h of content and shooting. Per video after that: 10–12h.

**Rejected:** the original €110 one-off budget — it counts hardware and hosting and forgets food, props and registration. Understating it by 4× is how a side project dies in month two.

### D12 — Recipes must be findable: the taxonomy is data from day one, the search UI is not

Every recipe carries `category`, `tags[]`, `difficulty` (1–5, revised in D20), `time` (active + total) and `result`. They are shown on the recipe page and on the recipe card, not hidden in metadata.

- **In Gate A:** the fields, ~30 minutes while writing `soezendeeg.json`. Retrofitting a taxonomy over five finished recipes is a data migration.
- **Not in Gate A:** search and filter. Facets (category, difficulty, time, site search) ship at **recipe 4**. With one to three recipes the home page is simply a list; a search box over three items is decoration.

**Why:** in the first weeks findability is irrelevant, and in month six it is the navigation. The cheap half (the data) is paid once, early; the expensive half (the UI) waits for the content that justifies it.

**Rejected:** search/filter in Gate A (solves a problem the site cannot have yet); free-text tags without a fixed category list (five spellings of "deeg"); search only, no categories (you cannot browse a category you cannot name).

### D13 — No PDF. A print view of the recipe, and nothing else on the sheet.

*Revised 2026-10-29: the met foto's / zonder foto's choice is dropped. The sheet carries the ingredients and the steps, and nothing else — no photos, no explanations, no FAQ, no navigation.*

The PDF is cut. Printing is handled by a print button that prints the recipe page itself, with `@media print` hiding everything that is not the recipe. Two A4 sides on the counter.

**Why:** the PDF only ever existed to be printed, and a print view removes a build pipeline plus a second artifact per recipe that can go stale. The photo choice goes too: a sheet you cook from wants the ingredients and the steps, and a photo of the finished product costs ink and a page without helping. The *why* behind each step stays on screen, where you read it once; on paper it is a second page of text you will not read with dough on your hands.

**Consequence for D10:** the conversion metric changes from "PDF download rate ≥10%" to "**print-button click rate ≥10%**" (an Umami event). The donate ask sits directly under the print button on the page; the printed sheet itself carries no QR code yet, because there is no donate link to encode — add it when the Stripe link exists.

**Rejected:** build-time PDF per recipe (removed); a photo yes/no choice (ink and pages for nothing); explanations and FAQ on paper (duplicates the page, lengthens the sheet); email-gated PDF (never); relying on the plain browser print with no print stylesheet (navigation, newsletter and video placeholder end up on the sheet).

### D19 — Recipes reference recipes; a component exists once

*Added 2026-10-29. Extends the D4 schema.*

A recipe is either a **basisrecept** (its own ingredients and steps) or a **gerecht** that lists `components`: links to other recipes by slug. Nothing is copied. Changing `soezenbeslag.json` changes every recipe that uses it, which is the whole point: soesjes, eclairs, Paris-Brest and a filled soesje all share one dough.

**The model:**

| Field | Meaning |
|---|---|
| `role` | `basis` or `gerecht`. The home page shows gerechten; `/recepten` shows everything, basisrecepten marked as such. |
| `components[]` | `{ ref, factor }` or `{ ref, amount, unit }`. With `amount` the factor is derived from the linked recipe's own `result`, so "300 g banketbakkersroom" stays readable and the 1:1 in Zwitserse room is visible in the data. |
| `result` | Every recipe states what one batch makes, in a unit. This is what makes `amount` links possible at all. |
| `aliases[]` | Extra slugs that render the same page. `soezenbeslag` answers to `soezendeeg`, because that is the search query. |
| `variants{}` | Named presets of one recipe: `{ label, note, ingredients: { id: amount } }`. Same steps, different composition. A link picks one with `variant: "water"`. |
| `video` | Per recipe, including components: `{status, youtube_id}`. Every basisrecept gets its own uncut video and its own page. |

**Rendering:** a build-time resolver walks the tree depth-first and flattens it, so a component's steps always come before the steps that assemble it. Ingredient amounts are multiplied by the cumulative factor; `scale: false` items (salt, a vanilla pod, a baking sheet) do not scale. Cycles throw at build time instead of hanging. The page shows one ingredient block and one step block per component, each linking to its own page.

**Variants, not forks:** the dough is 100 ml milk plus 100 ml water by default, and 200 ml water for a firmer dough — the difference between a soesje and a Bossche bol. That is not a second recipe: the steps, the timings and the failure modes are identical. So `soezenbeslag` declares a `water` variant that sets milk to 0 and water to 200, and a link asks for it by name. Fork it into `soezenbeslag-water` instead and the day the dough gets fixed, half the site is stale. Same mechanism covers any "same technique, other mix" case.

**What still lives on the derived recipe:** things that are genuinely different, not parameterised — the size of the pipe, the filling, a glaze, the chocolate. Bossche bollen are therefore `ref soesjes (variant groot)` plus `ref slagroom` plus a glaze component, not a variant of `soesjes`.

**Why references and not a shared ingredient file:** the user's actual requirement is that a fix to the dough lands in every recipe. Options were a shared ingredient library (only ingredients shared, steps still duplicated), a preprocessor that pastes files together (a second artifact, like the PDF), or references resolved at build time. References are the only version where the *steps* and the *timings* are shared too, and they cost one field.

**Consequence for D5:** the rescaler operates on the flat resolved list, and rounding happens per component, not per page. Asking for 60 soesjes doubles the dough and both fillings, and the `factor` shown per block explains where the numbers came from.

**Consequence for D1:** five videos instead of one. Soezenbeslag, soesjes, banketbakkersroom, slagroom and Zwitserse room are each a technique with its own payoff, which fits the format better than one 20-minute video that hides four of them.

**Rejected:** copying ingredients into each recipe (drift, and the requirement was explicitly the opposite); only sharing ingredients, not steps (the timing is the part that gets fixed); a template/include system in the build (another artifact that can go stale); one mega-recipe with all five techniques inline (no separate page, no separate video, no reuse).

### D20 — One category per recipe, facets for everything else, difficulty 1–5

*Added 2026-10-29. Extends D12.*

**The category list is closed and short:** `basistechniek`, `deeg-beslag`, `room-vulling`, `gebak`, `brood`, `chocolade`, `hartig`. One value per recipe. It answers "what is this", which is the only question a single list can answer well.

**Everything that is not "what is this" is a facet, not a category:**

| Facet | Source | Why not a category |
|---|---|---|
| Rol (basisrecept / eindproduct) | `role` | It is the one split this site is built on; putting it in the category list forces a choice between "basisrecept" and "room & vulling". Renamed twice in D20: "gerecht" reads as a savoury dinner, "afgewerkt" reads as a chore. The finished bake is the eindproduct. |
| Moeilijkheid 1–5 | `difficulty` | A property, not a kind. Five steps because 1–3 made the two ends meaningless: whipped cream and a croquembouche both landed in "3". |
| Tijd | `time.total` | A property. Buckets: under 30 min, 30–60 min, over an hour. |
| Ingrediënt | `ingredients[].id` | Derived, so it costs nothing. Covers Laura's manual "recepten per ingrediënt". |
| Gebruikt in | `components[]`, reverse | Unique to this model. Answers "what can I make with this basisrecept" and turns the component graph into navigation. |

**Why not multiple categories:** a recipe in two categories makes the counts lie (six recipes, eight results), makes "alle gebak" ambiguous, and forces every new category decision twice. A thing is one kind of thing; the occasion (Kerst), the diet (glutenvrij) and the technique (kookdeeg) are properties, and those are tags. Tags never appear as filters until a tag has two recipes.

**Every value is clickable, with a live count.** *Revised twice on 2026-10-29.* The ≥2 rule is dropped: greying out a value with one recipe refused a reader who knew what they wanted. Counts are now **context-aware** — each chip shows how many recipes its value holds under the other facets and the search term, so picking "basistechniek" drops "eindproduct" to 0 and the numbers under category stay honest (2, 3, 1) instead of all collapsing to the current total.

**You cannot filter yourself into an empty list.** A chip whose count is 0 in the current context is disabled, so the combinations that would return nothing are unreachable by clicking. The only way to reach zero results is to hand-edit the query string, and then the empty state offers the reset. Zero-value *categories* still render nothing at all.

**Two different numbers, on purpose:** a chip counts its own value; the counter under the panel counts the union ("5 van 6"). A chip is not a prediction of the result total, it is a description of the value — and the union is what facets are OR'd into.

Rutger's 32 categories and Laura's 60+ are not the model here; Meesterlijk van Robert's eight are closer to the right size, and this list is seven.

**The URL is the filter state.** Every change writes `?categorie=…&rol=…&moeilijkheid=…&tijd=…&q=…` with `history.replaceState`, and the page reads that query on load: the chips light up, the keyword returns, the panel opens, and the list is already narrowed. That means a filtered view is linkable, a returned-from-recipe view is intact without re-filtering, and page 2 of D21 inherits the same mechanism.

**Filtering is server-rendered and narrowed client-side:** every card is in the HTML, the chips only hide and reveal. With JavaScript off the full list stays and the chips are inert — no blank page, no spinner. OR within a facet, AND across facets, with a live "x van y recepten" counter and a reset.

**The panel is collapsed by default and sticky.** As a wall of chips it pushed the first recipe off a phone screen, so it is a `<details>` that opens to a summary line, with an active-filter count on the closed state. The header and the filter bar stay visible while scrolling; the bar's `top` is measured from the real header height (the nav wraps on narrow screens), not guessed.

**Keyword search covers the whole recipe, not just the title:** the search blob is built at build time from title, subtitle, role, category, tags, ingredient names, component names, every step title and text, and the FAQ questions. A search box without that data would only find titles. Two-character terms match at a word start (`ei` finds eieren, not kleiner); four characters or more match anywhere, because Dutch compounds would otherwise hide `room` inside `banketbakkersroom`.

**Enter keeps the query.** The form submitted and reloaded the page, which wiped the search field. Enter now prevents the submit, closes the panel so the results are visible, and moves focus to the result list. The input keeps its value, and the query stays in the DOM when the panel is closed.

**Known limitation:** matching is literal, so "soes" finds "soesjes" and "soesje" but not a misspelling, and there is no ranking — with six recipes the count is the ranking. Revisit at ~40 recipes, where a real index (Pagefind) is cheaper than hand-rolled scoring.

### D21 — The catalogue gets pagination, not infinite scroll

*Added 2026-10-29. Nothing is built yet; this records the trigger and the shape.*

Today there is nothing to paginate: six recipes, one page, and the filter narrows client-side. The trigger is **more than 24 recipes**, which is one screen of cards per row-count at three columns.

**Shape when it lands:** static routes `/recepten`, `/recepten/2`, `/recepten/3`, generated at build time, carrying the same filters as `?categorie=…&moeilijkheid=…` so a narrowed view is linkable and crawlable.

**Why pagination and not infinite scroll:** a recipe catalogue is browsed by looking for one thing, and it is shared as a link. Pagination gives every recipe a URL a search engine reaches without scrolling, works with the back button, keeps the footer reachable, and prints. Infinite scroll breaks all four and buys nothing here — the list is short by nature, and a reader who reaches the end of page 1 wants page 2, not a spinner. A "meer laden" button is the acceptable middle ground *if* the URL updates; it is not the default.

**Cost note for the filter at that size:** the client-side filter is O(n) over rendered cards — 6 today, ~few ms at 200, since the search blobs average under 1 KB. Beyond roughly 200 cards the cost is rendering, not matching, so pagination is what fixes it, not a bigger index.

**Rejected:** infinite scroll (breaks crawlability, back button, footer); client-side pagination over one giant HTML page (defeats the crawlability argument); a database-backed search before Pagefind is tried (static index, no server).

**Rejected:** multi-value categories (lying counts); occasion and diet as categories (they multiply the list and every recipe collects three of them); a search box as the primary navigation (there are six recipes; facets are faster than typing and they teach the catalogue); a filter UI before recipe 4 (D12 — the data shipped first; the UI arrives when there is something to filter); difficulty 1–3 (no room to distinguish "folding cream" from "tempering custard").


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

### D17 — Tin scaling: a volume factor plus an honest warning, never a silent promise

> **Status: parked (2026-10-26).** The time/temperature rule below has no decision yet — the founder is not ready to make one. The tin feature waits on it and sits at the bottom of Gate C. Nothing in Gate A or Gate B depends on it; the rescaler (D5) ships without it.

A recipe with a `tin` field rescales on the tin instead of on an ingredient. Factor = new volume / old volume (round: π·r²·h; square/rectangular: l·w·h; sheet tin: area only, height unchanged). Ingredients scale by that factor; `scale: false` items round.

**Baking time and temperature do not scale by that factor.** Baking time is not linear in size, and pretending it is produces a ruined bake. So the page shows a warning with the factor and the practical rule: within roughly ±15% keep the time and check early; beyond that, lower the temperature and bake longer, with one sentence of explanation. Guidance, clearly labelled, not a guarantee.

**Why:** the founder asked for tin scaling, and the baker who goes from 20 cm to 24 cm with no warning is the one person this feature can hurt. Naming the limit is also what keeps it honest.

**Rejected:** scaling time linearly (wrong, and wrong quietly); hiding the feature when the new tin is far from the original (they will do it anyway, just without help); a separate tin-calculator page (it belongs on the recipe); a "correct time" promise (unverifiable across ovens).

### D18 — The first pages: with no recipes yet, the site has to say what it is

**Pages before recipe 1 exists**

| Page | What is on it |
|---|---|
| Home | What this is, in one sentence. The no-cut promise. The finished product, close up. The recipe that is coming. Newsletter. |
| Waarom | The manifesto, short: no cuts, no ads, no email wall, no course upsell. One page, no scrolling essay. |
| Wie | One photo, one paragraph. Why baking, why uncut. No CV, no mission-vision-values. |
| Hoe het werkt | No cuts, chapters work as a real-time guide, print view, free, tips only. Answers "what's the catch" before it is asked. |
| Contact / privacy | The legal minimum (D11 list), in plain Dutch. |

The recipe list appears as a section the moment recipe 1 exists; until then the home page carries a "coming" note, not a fake grid.

**Design constraints, in priority order**

1. **Clean** — no banners, no cookie wall, no popups, no newsletter modal, one ask per page (D10).
2. **Readable for everyone** — body text ≥17px, line length ~65ch, WCAG AA contrast minimum, real heading order, visible focus states, works at 200% zoom, no colour-only meaning. A recipe site is read in a kitchen by people who are tired.
3. **Dark mode** — `prefers-color-scheme` by default, plus a toggle that remembers. Tokens from day one; retrofitting dark mode means touching every component.
4. **Cozy** — warm paper tone rather than pure white, one accent colour, generous whitespace, a serif for headings, nothing that looks like a SaaS dashboard. Cozy is a bias toward warmth and quiet, not decoration.

**Why now, before recipes:** the recipe page template (Gate A) is built on this type scale, these tokens and this layout. Doing the design draft after the template means rebuilding the template.

**Rejected:** a full brand/design system before launch (comfortable procrastination — five pages do not need it); dark mode "later" (a retrofit across every component); a landing page showing a recipe grid that does not exist (looks empty, and it lies); a cooking-blog look (stock-photo hero, three-column cards, sidebar ads) — that is the thing this site is against.

---

## 3. Roadmap

### Gate 0 — first ~4h, €0
1. **3-minute silent no-cut test take** (phone, extractor hood on, one light source, soezendeeg). Watch it back on headphones. This is the €0 gate on both the format and the audio chain — and on whether a €25 lavalier beats the extractor fan at all.
2. Check KvK status. Not registered → register, KOR on. Verified fee goes in this document.
3. Fix the publish order (D1) and the cadence (D3).

### Gate A — ships video 1 · ~27–33h of work, in order, no dates
1. **Local site**: Astro project on `localhost` — page shell, build script, README. No domain, no VPS, no TLS. *(1h)*
2. Design draft (D18): type scale, colour tokens incl. dark mode, and the home / waarom / wie / hoe-het-werkt pages. No recipes yet. *(4–6h)*
3. `recipes/soezendeeg.json` first: ingredients with `scale_by`/`scale:false`, steps with `id`/`duration`/`t=`/photo frame, tools, FAQ, `result`, `yield`, `category`, `tags`, `difficulty`, `time`, `context`. *(2–3h)*
4. Recipe page template + static ½×/1×/2× scale table + step photos from video frames. `result` directly under the title, context block at the top, taxonomy as visible tags, mount point for the rescaler. *(5h)*
5. Bake mode toggle — Screen Wake Lock, off by default, re-acquired on `visibilitychange`. *(1h)*
6. Print button → print view, "met foto's" / "zonder foto's", QR code to the donate block on both. *(2h)*
7. Chapter/description generator — must enforce YouTube's rules: ≥3 timestamps, first at `00:00`, each ≥10s. 20 minutes of unbroken kneading needs 5–6 named phases ("kneden", "rust", "vormen") for skippability. *(2h)*
8. ffmpeg step-frame extractor. *(1h)*
9. **Deploy**: domain + VPS + Caddy + TLS, publish the build that already works locally. *(3h)*
10. Umami self-hosted, cookieless, no cookie banner. *(2h)*
11. Brevo hosted form + double opt-in + weekly CSV export. *(1h)*
12. Donate block under the print button: Stripe payment link, €3/€7/€15/€25 + open field. *(1h)*
13. Legal minimums: privacy statement, contact page, AVG note on the form. *(1h)*
14. Record videos 1 and 2, publish video 1.

**Not in Gate A:** search/filter pages (D12 — they ship at recipe 4), interactive rescaler (D5 — after Gate A), i18n routes, own email DB, affiliate module, AdSense, English anything, livestreams, accounts/comments.

### Gate B — after video 1: the rescaler, then videos 2–5
- **Interactive rescaler** first (D5), then video 2 (fondant, the flagship) → 3 (brooddeeg) → 4 (tempereren) → 5 (meringue), each when it is recorded and edited. The rescaler lands before video 2 because it applies to every recipe, not to one. Tin scaling (D17) is parked and is not part of Gate B.
- Per-recipe FAQ, tools and context (D16) live as data fields, written while writing the recipe. No "FAQ feature".
- **Search + filter** by category, difficulty and time, plus site search, as soon as recipe 4 is live. Three recipes do not need facets; four do. *(~1 day)*
- Affiliate links once bol.com approves. Expect €0–15/month; no module, just fields in the recipe file.
- Read AVD after video 3. <35% of runtime → video 4 ships hybrid.

### Gate C — gated on evidence, no dates
| Build | Gate to pass first |
|---|---|
| Own Postgres + token unsubscribe | >1,000 contacts |
| i18n route prefix | 5 videos live (locale file from day 1, zero English content) |
| €9 PDF e-book to the warm list | ≥500 subs; <30 sales → stop, no cookbook |
| POD pre-order page (no shop integration, no stock) | ≥1,500 subs + e-book validated + written Pumbo quote |
| English: subtitles first, voice-cloning second | proven English demand; disclose the cloning when it happens |
| Tin scaling (D17) — parked | a decision on baking time/temperature for off-size tins. Not blocking anything |

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
| Flour-anchored baker's-percentage calculator | The meeting's misreading of the founder's calculator: computes a percentage of nothing on four of five recipes |
| Interactive rescaler in Gate A | Right feature, wrong gate: Gate A exists to publish video 1, and the rescaler is 1–2 days |
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
2. ~~**Founder sign-off on D5**~~ — **closed 2026-10-26**: the founder overruled the deviation (the calculator is a proportional rescaler, not baker's percentage) and the interactive version ships on every recipe page, weeks 4–6. See D5 and D17.
3. ~~**Search demand check**~~ — **done, see [`search-demand-soezendeeg-vs-fondant.md`](search-demand-soezendeeg-vs-fondant.md).** `banketbakkersfondant maken` is not a query (zero Google Trends signal in 262 weeks, zero autocomplete suggestions). The real term is `fondant maken` (~100× `soezendeeg maken` on the 5-year average). Publish order does **not** change — the swap condition was traffic-driven and the traffic argument for video 1 was never the point; the rig argument stands. Video 2's keyword changes to `fondant maken`. Remaining open: the search-volume assumption cannot be validated at these magnitudes, so re-check with Search Console impressions after video 1.
4. **Donation conversion** — 0.3–1% of engaged visitors at €5–10 is an assumption, not a measurement. First real number after video 1.
5. **Pumbo/BoekenGilde quote** — required before any book copy or margin figure is written.
6. **Video length target** — 20 minutes suits chapters and watch hours; 12–15 minutes may suit retention. Decide after the video-1 AVD number.
7. **Business structure** — eenmanszaak + KOR assumed. Confirm before the first invoice.
8. ~~**Whether the founder actually has 8–10 hours/week.**~~ — **closed 2026-10-26**: not a constraint. There are no dates to derive, only a per-video hour budget (D3).
9. **QR code target and size** — does it encode the donate block anchor or the Stripe payment link, and does it still scan at ~2 cm on a home printer? Test on paper, not on screen.
10. **Baking time/temperature rules for off-size tins (D17)** — parked, not blocking. The ±15% threshold and the wording of the warning need a baker's judgement, not a guess. Revisit when there is an opinion to write down; nothing else waits on it.
11. **Email footer** — accept the Brevo logo on the Free plan, pay ~€9/month to remove it, or move to another EU provider (MailerLite LT, Mailjet FR) whose free tier has no footer branding. Verify branding and free limits before switching; the logo is one line, the migration is an afternoon.

---

## 7. The first ~24 hours, in order

1. **Day 1 (2h):** week-0 test take, headphones, verdict on format and audio.
2. **Day 2 (1h):** KvK status + verified fee; write the number into this file.
3. **Day 3–4 (6h):** local Astro project, then `recipes/soezendeeg.json`. VPS and domain come later, once there is a page worth deploying.
4. **Day 5–7 (8h):** recipe page template, static scale table, print view, bake mode — all on `localhost`.
5. **Day 8 (3h):** Umami, chapter generator, ffmpeg frame extractor.
6. **Day 9 (2h):** Brevo form, donate block, legal pages.
7. **Day 10:** shoot take 1 of soezendeeg. Second take if the first one fails — that is normal, not a setback.

The **Day** numbers are sequence, not calendar dates — a slow week moves the sequence, it does not put the plan behind.

**Then:** publish video 1, and the next feature is not allowed until video 2 is recorded.
