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

### D6 — Email: our own mail server on the VPS, no ESP

*Revised 2026-10-26: Brevo is out. Its default envelope (`brevosend.com`) puts SPF on Brevo's shared domain, its tracking runs on `brevolinks.com`, and the Free plan stamps a Brevo logo on every email. The founder wants SPF and DKIM properly ours, and at five sends a year the volume does not justify an ESP. DKIM was never the shared part — those keys are per sending domain; the shared part is the envelope, and the free plan's footer on every mail.*

*Revised 2026-11-02: Listmonk is out too. It is a second runtime plus a Postgres instance to keep alive, install, upgrade and monitor — for a list of zero. The signup endpoint already writes the address to SQLite in ~40 lines, and everything Listmonk would have done for us (double opt-in token, unsubscribe token, CSV export) is a few columns and two small endpoints. No list manager, no relay, nothing outside the VPS.*

**The stack**

| Piece | Choice | Why |
|---|---|---|
| List + form + double opt-in + unsubscribe | **Our own code**: the Astro signup endpoint + a SQLite file | One store, readable with `sqlite3`, exported with one query. No second runtime to install, upgrade and monitor. |
| Database | **SQLite**, `data/subscribers.sqlite` | One file: backup is a copy, restore is a copy, and it needs no server process. Postgres arrives only when two writers need it. |
| Sending | **Postfix + OpenDKIM** | Our IP, our DKIM key, our SPF. No shared envelope, no third party in the path. |
| Sending domain | `news.<domein>`, DKIM `d=news.<domein>` | Reputation damage stays off the domain that serves the site. |
| Reverse DNS | `mail.<domein>` | Most providers let you set it; a missing PTR is a spam signal. |
| Policy | SPF `v=spf1 ip4:<vps-ip> -all`, DMARC `p=none` → `quarantine` → `reject` | Full alignment, both signals ours. |

**Pre-flight on the actual box** (2026-10-26: the VPS is a LeaseWeb VPS with a dedicated IP, so provider choice is settled):

- **Reverse DNS: solved.** LeaseWeb lets us set the PTR ourselves in the Customer Portal → IP management; it defaults to `hosted-by.leaseweb.com`. Set it to `mail.<domein>` before the first send.
- **Outbound port 25: verified open** (2026-10-26). A TCP connection from the box to `gmail-smtp-in.l.google.com:25` completes, so LeaseWeb does not filter outbound SMTP and Postfix can deliver directly. No unblock ticket needed.
- **IP reputation: check it, do not assume.** The IP already has history from whatever ran on it: `https://multirbl.valli.org/lookup/<ip>`. A listed IP is a different problem from a cold one, and worth knowing before the double opt-in mail is the first thing it sends.

With port 25 open, nothing in the connection path needs working around.

**The known risk, stated plainly:** a cold IP with almost no volume is the worst case for reputation, and the *first* email a subscriber ever gets is the double opt-in confirmation — if that lands in spam, the funnel dies quietly.

**The test, before the form goes live:** send to a **mail-tester.com** address and require **≥9/10** (SPF, DKIM and DMARC all pass, no blocklist hits, no HTML/spam traps), then send to a real Gmail and a real Outlook address and check the folder it lands in. Both, every time the MTA config changes — a signature that passes in mail-tester but lands in Gmail's spam is still a broken funnel.

**No relay, by decision.** There is no SMTP-relay escape hatch. If deliverability disappoints, the fixes are the signals we own: PTR, SPF, DKIM key and selector, DMARC alignment, content, and a slow volume ramp. A relay would be a new decision with its own note, not a config line flipped in a bad week.

**Bots hit a public form. The form defends itself, without an external service:** a hidden honeypot field a human cannot see or tab into, a minimum fill time (a submitted form younger than ~1.5 s is not a human), a same-origin check, and a per-IP rate limit held in memory. Filled honeypot, too-fast submit or rate-limited IP all get the same quiet "done" response, so a bot learns nothing. No CAPTCHA: it is a third party in the path, a privacy statement line, and an accessibility problem, for a threat a rate limit already covers.

**Consequence for the compliance gate:** holding the list means being the data controller from day one — retention rule, breach procedure, a privacy statement that names the mail server. That is now Gate A work, not a >1,000-contact concern.

**Rejected:** Brevo (shared envelope SPF, logo on the free plan); any ESP at launch (the same shared-envelope trade for less control); a full mail suite like Mailu or Postal (more surface than a list of zero needs — Postfix + OpenDKIM is the smallest thing that signs properly); Proton + manual sends (no double opt-in trail, no unsubscribe token); **Listmonk** (a second runtime and a Postgres instance for a list of zero — the rows it would hold are four columns); a relay fallback (a third party in the path for the one thing the decision was about keeping in-house); a CAPTCHA service (external, privacy line, accessibility cost).

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
| Domain + VPS, year 1 (1 GB is enough: Astro server + SQLite + Postfix) | €60–85 |
| Ingredients, 5 videos incl. failures and test bakes | €150–250 |
| Props: marble board, backdrop, diffuser | €60–90 |
| KvK registration (verify the fee on kvk.nl — €52 or €75, do not guess) | €52–75 |
| Umami / Astro / ffmpeg / print-CSS | €0 |
| **Year 1 total** | **€405–615**, ≈ €3–5/month recurring |

Build to video 1: **~32–40h**, plus ~12–18h of content and shooting. Per video after that: 10–12h.

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

### Gate A — ships video 1 · ~32–40h of work, in order, no dates
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
11. Postfix + OpenDKIM on the VPS, and the signup we already run: double opt-in mail with a token, token unsubscribe, bounce mailbox, CSV export from SQLite. Verify with mail-tester.com (≥9/10) plus a real Gmail and Outlook send. *(8–10h)*
12. Donate block under the print button: Stripe payment link, €3/€7/€15/€25 + open field. *(1h)*
13. Legal minimums: privacy statement, contact page, AVG note on the form. *(1h)*
14. Record videos 1 and 2, publish video 1.

**Not in Gate A:** search/filter pages (D12 — they ship at recipe 4), interactive rescaler (D5 — after Gate A), i18n routes, affiliate module, AdSense, English anything, livestreams, accounts/comments.

### Gate B — after video 1: the rescaler, then videos 2–5
- **Interactive rescaler** first (D5), then video 2 (fondant, the flagship) → 3 (brooddeeg) → 4 (tempereren) → 5 (meringue), each when it is recorded and edited. The rescaler lands before video 2 because it applies to every recipe, not to one. Tin scaling (D17) is parked and is not part of Gate B.
- Per-recipe FAQ, tools and context (D16) live as data fields, written while writing the recipe. No "FAQ feature".
- **Search + filter** by category, difficulty and time, plus site search, as soon as recipe 4 is live. Three recipes do not need facets; four do. *(~1 day)*
- Affiliate links once bol.com approves. Expect €0–15/month; no module, just fields in the recipe file.
- Read AVD after video 3. <35% of runtime → video 4 ships hybrid.

### Gate C — gated on evidence, no dates
| Build | Gate to pass first |
|---|---|
| List admin UI (search, manual remove, resend) | >1,000 contacts — the tokens, the table and the export already exist; this is only a screen |
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
| Listmonk + Postgres for the list | A second runtime, a database server and upgrade duty for a list of zero; our own endpoint writes the same rows, and the export is one query |
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

---

## 7. The first ~24 hours, in order

1. **Day 1 (2h):** week-0 test take, headphones, verdict on format and audio.
2. **Day 2 (1h):** KvK status + verified fee; write the number into this file.
3. **Day 3–4 (6h):** local Astro project, then `recipes/soezendeeg.json`. VPS and domain come later, once there is a page worth deploying.
4. **Day 5–7 (8h):** recipe page template, static scale table, print view, bake mode — all on `localhost`.
5. **Day 8 (3h):** Umami, chapter generator, ffmpeg frame extractor.
6. **Day 9 (2h):** signup form with double opt-in, donate block, legal pages.
7. **Day 10:** shoot take 1 of soezendeeg. Second take if the first one fails — that is normal, not a setback.

The **Day** numbers are sequence, not calendar dates — a slow week moves the sequence, it does not put the plan behind.

**Then:** publish video 1, and the next feature is not allowed until video 2 is recorded.
