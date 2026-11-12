# bakmark

Source for **Bakmark** — a static Astro site, in Dutch and English.

## Requirements

Node 22.23.4 or newer. The pinned version is in `.nvmrc`:

```sh
nvm use
```

## Commands

```sh
npm install     # once
npm run dev     # dev server on http://localhost:4321
npm run build   # static site in ./dist
```

## Structure

```text
/
├── src/pages/          # Dutch routes: / (the catalogue), /recepten/<slug>,
│                       # /wie, /contact, /privacy; /recepten 301s to /
├── src/pages/en/       # English routes: /en (the catalogue), /en/recipes/<slug>,
│                       # /en/who, /en/contact, /en/privacy; /en/recipes 301s to /en
├── src/views/          # Page bodies, one per page, taking a `lang` prop
├── src/lib/i18n.ts     # route table, t(), path(), alternatePath()
├── src/lib/recipes.ts  # recipe loading, scaling, English text overlays
├── src/layouts/        # Layout.astro: head, header, footer, theme script
├── src/components/     # SiteHeader, ThemeToggle, NewsletterForm, PlaceholderImage,
│                       # RecipeCard, DifficultyBadge, RecipeSection, QrCode
├── src/styles/         # global.css: tokens + base styles
├── recipes/            # one JSON per recipe: the single source of truth
├── recipes/en/         # English text per recipe, words only (see below)
├── docs/design-tokens.md
├── docs/runbook.md    # what to check weekly, monthly, yearly; DKIM rotation
├── public/             # static assets, copied as-is
├── astro.config.mjs
└── package.json
```

### Step photos from the recording

A step carries `t` in `recipes/<slug>.json`: where it starts in the video, in
the same shape as a YouTube chapter (`1:05`, `1:02:03`, or bare seconds). That
timestamp is the only input, so the photo, the chapter and the sheet cannot
disagree.

```sh
npm run step-frames -- soesjes --video ~/opnames/soesjes.mp4   # one recipe
npm run step-frames -- --all --video ~/opnames/                # <slug>.mp4 per recipe
```

Frames land in `public/fotos/<slug>/<step-id>.jpg`, served as
`/fotos/<slug>/<step-id>.jpg`. Re-running skips what exists; `--force` rebuilds
the set. `--width 1600` changes the long edge (default 1200, never upscaled).

ffmpeg is a host tool, not part of the image: this runs on the machine that
holds the recordings. `FFMPEG=/path/to/ffmpeg` if it is not on `PATH`. Steps
without a `t` are named in the last line instead of silently skipped.

## Analytics

Cookieless page counts, self-hosted, off by default. The stack is in
`analytics/compose.yaml` (Umami + Postgres, separate compose project, loopback
only). Nothing is injected into the HTML unless **both** variables are set at
build time:

```sh
UMAMI_SCRIPT_URL=https://analytics.bakmark.nl/script.js
UMAMI_WEBSITE_ID=<the id Umami shows for the site>
```

With both set, `/privacy` grows a "Bezoekcijfers" section, because a privacy
statement that says nothing is counted while counting is a lie. The site itself
sets no cookie: verified on `/script.js` and on `/api/send`, which return no
`Set-Cookie` at all.

Nothing here is a manual step: provisioning creates the directories and the
vhost, the deploy writes the secrets and starts the stack.

1. **Provisioning** (`vps1-provisioning`, `install_docker` and
   `group_vars/production/websites.yml`): `/var/lib/bakmark-analytics` and its
   `data` subdirectory, owned by uid 70 (Postgres inside that image; the deploy
   account cannot read it and does not need to — compose runs as root via the
   daemon), and the nginx vhost `analytics.bakmark.nl` → `127.0.0.1:8091`,
   which also gets certbot's certificate on the same run.
2. **The deploy** writes `analytics/.env` in the checkout (git-ignored, next to
   the app's own) the first time — `APP_SECRET` from `openssl rand`, and the
   connection string for user `umami`, host `db`, database `umami`, no password
   (the database trusts the private compose network and publishes no port, so
   there is nothing to repeat). It never overwrites an existing file: a new
   secret signs the dashboard out, a new database URL points at a cluster that
   is not there. Then `docker compose -p bakmark-analytics --env-file … -f
   analytics/compose.yaml up -d`. The env file is there rather than in
   `/var/lib/bakmark-analytics` because that directory belongs to the
   container's uid: a deploy cannot write into it, and should not have to.
3. **One visit to the dashboard** (https://analytics.bakmark.nl, `admin` /
   `umami` on the very first login — change it), then **Websites → Add website**
   once per hostname: `bakmark.nl` and `staging.bakmark.nl`. One website per
   hostname, so staging never counts into production's numbers.

   The id is shown on the website's own page, in the tracking snippet
   (`data-website-id="…"`) and in the URL (`/websites/<id>`). It is stored as a
   deploy secret per environment, because the site is static and the id is baked
   in at build time:

   | secret | used by |
   |---|---|
   | `UMAMI_SCRIPT_URL` | both, `https://analytics.bakmark.nl/script.js` |
   | `UMAMI_WEBSITE_ID_STAGING` | `BAKMARK_ENV=staging` |
   | `UMAMI_WEBSITE_ID_PRODUCTION` | `BAKMARK_ENV=production` |

   `UMAMI_WEBSITE_ID` alone still works as a fallback for a machine that only
   deploys one of the two.

DNS is the only record provisioning does not manage: an A/AAAA record for
`analytics.bakmark.nl` → 5.79.100.71.

### The rescaler

Every recipe page can be rescaled in place: change one amount and every amount
that may scale follows, or ask for a different yield and the ingredients
recalculate. `?ref=250` (grams of the reference ingredient — the first one that
scales) and `?result=100` (soesjes) share the state; `result` wins when both are
present.

- A value is taken when the field is left or Enter is pressed, never while a key
  is down: recomputing per keystroke rewrote the field under the cursor, so
  clearing it and typing the first digit landed on the smallest batch and
  backspace did nothing.
- A factor is bounded to 0.1×–20× of the recipe, and a typed or linked value that
  hits a bound gets a line under the fields that names the bound in the field's
  own unit: "Te kleine hoeveelheden zijn niet makkelijk te maken. De minimum
  hoeveelheid die wij aanhouden is 50 g." Silently producing a tenth of the batch
  is worse than saying so.
- `scale: false` items never move: salt stays a pinch however small the batch.
- A `"round"` step, for things bought in halves: a vanilla pod goes 0,5 / 1 / 1,5
  and never below half. The step is also the floor.
- The unit stays next to the field, in the word the recipe uses — "stokje", not
  the database's "stuk" — and it pluralises from two: 1 stokje, 1,5 stokje,
  2 stokjes. The static table and the yield field use the same rule. Everything
  is grams unless the recipe says otherwise, and a number without its unit is
  not a quantity.
- The field's label follows that unit: "Aantal" for what you count, "Hoeveelheid"
  for what you weigh. "Aantal 600 g" makes a reader doubt the rest of the page.
- An ingredient that is weighed but bought by the piece can say what one piece
  weighs (`"each": {"name": "eidooier", "grams": 17.5}`), and its tooltip then
  follows the batch: 80 g is "ongeveer 4,5 eidooiers", 120 g is 7.
- An ingredient bought by the piece can name a weighed substitute
  (`"substitute": {"name": "vanille-extract", "grams_each": 8}`), and that line
  follows the count: one pod is "Of 8 g vanille-extract", three are 24 g.
- Grams only. There is no millilitre or litre anywhere in the data, and a test
  keeps it that way: a scale is the one instrument every reader has.
- Rounding stops where a scale stops: one decimal below ten, whole numbers above.
- Printing shows the numbers, not the fields, and hides the static ½×/1×/2× table
  once the list is rescaled — two truths on one sheet is worse than one.
- Without JavaScript nothing is injected: the amounts are exactly what was
  rendered, and no field looks editable that is not.

The arithmetic lives in `src/lib/rescale.ts`, shared with the static table, so
1× there and 1× here cannot drift.

### The video description

```sh
npm run chapters -- soesjes > ~/beschrijving.txt
```

Prints the text for YouTube's description field: one chapter per step, from the
same `t=` the printed codes and the step photos use, then the link back to the
recipe page.

YouTube silently drops a chapter list that breaks its rules, so the three that
matter are checked before anything is printed: at least three chapters, the
first at `0:00`, and no chapter shorter than ten seconds. A step without a `t`
is named in the error instead of being skipped.

A long hands-on phase is worth splitting (`"split": true` on the step): twenty
minutes of kneading becomes five chapters a baker can jump between, while thirty
minutes of rising stays one chapter to skip past. When the recording deserves
real names, give the step its own `chapters` array with absolute timestamps —
"kneden tot het deeg van de kom loslaat" beats "deel 3 van 5".

The test suite runs the same check for every recipe whose `video.status` is
`gepubliceerd`, so a broken list cannot reach a video announcement.

### The printed sheet

Printing a recipe gives ingredients, steps and codes, nothing else: no photos,
no explanations, no navigation, no newsletter. The print view is the same page
with CSS doing the filtering, so nothing can drift.

Three things are print-only:

- **A QR code per part that has a published video.** A page built from three
  base recipes prints three codes, each pointing at the video of the part in
  the reader's hand; `video.start` in the recipe JSON makes it open at that
  chapter instead of the first frame. Codes are inline SVG, generated at build
  time (`src/components/QrCode.astro`), so they stay sharp on paper.
- **A QR code to the tip block**, always. Paper has no links, and the tip is the
  one thing a reader cannot act on later.
- **The ½× / 1× / 2× table** (`scaledIngredients()` in `src/lib/recipes.ts`),
  collapsed on screen because the interactive rescaler is a later step. Amounts
  marked `scale: false` stay put: half a batch still needs the vanilla pod, and
  "0,5 pod" is not a thing a kitchen scale can weigh.

Design tokens and typography are documented in [`docs/design-tokens.md`](docs/design-tokens.md).
Maintenance — dependency updates, mail health checks, DKIM rotation — is in
[`docs/runbook.md`](docs/runbook.md).

## Languages

Dutch is the default and lives at the root; English lives under `/en`. A page file
is a three-line wrapper around a view, so the two languages share one template:

```astro
---
import Why from "../views/Why.astro";
---

<Why lang="nl" />
```

Three places hold text:

| Where | Holds | Used by |
|---|---|---|
| `src/lib/i18n.ts` | Shell strings: nav, footer, skip link, language toggle | every page |
| `src/views/*.astro` | A `copy = { nl: {...}, en: {...} }[lang]` object | that one page |
| `recipes/en/<slug>.json` | Recipe words: title, subtitle, context, ingredients, steps, tools, FAQ, mistakes, bake, variants | `localize()` in `src/lib/recipes.ts` |

Links always go through `path(lang, route, param?)`, never a literal `/recepten`:
that is what keeps a reader inside their language. The header toggle uses
`alternatePath()` to find the same page in the other language.

### Translating a recipe

Create `recipes/en/<slug>.json` next to the Dutch file. Only translated fields go
in it — anything missing falls back to Dutch:

```json
{
	"title": "Choux buns",
	"steps": { "stap-1": { "title": "Pipe and bake", "text": "…", "tips": ["…"] } },
	"ingredients": { "boter": { "name": "unsalted butter", "note": "In cubes." } }
}
```

Numbers never live in the overlay. Amounts, factors and the component graph stay in
the Dutch JSON so scaling and `factorFor` keep working in one language, and
`localize()` swaps only the words at render time.

Overlays are cached in a production build and read fresh in `npm run dev`, so a new
translation shows up on the next request without restarting the server.

## Docker

<!-- deploy pipeline check -->


The site runs from one image; the subscriber list is a bind mount on the host,
never a container layer. Removing or rebuilding the container does not touch it.

Local:

```sh
cp env.dist .env   # every variable, documented
./start.sh         # http://localhost:8085
```

Same thing via npm: `npm start`. The script creates `./data` with the right
owner, builds, and starts the container in the background.


### Deploying

The server is prepared by the `vps1-provisioning` project: Docker, the checkout,
and the data directory with the right owner. This repo only ships the app.

```sh
./deploy.sh     # one command, from your machine
```

It fetches `trunk`, builds the image on the server, swaps the container, and
rolls back if the new one never answers. GitHub Actions runs the same script
after every green push to `trunk`, so there is one deploy path and not two that
can drift. If Actions is down, `./deploy.sh` still works.

The subscriber list lives in `/var/lib/bakmark-staging` on the host, so a bad
deploy cannot lose it. `deploy.sh` writes the server's `.env` on every deploy,
which means nothing secret has to live in this repository.

Required secrets for Actions: `STAGING_SSH_KEY`, `STAGING_HOST`,
`STAGING_USER`.


### Staging

Staging runs the real form against the real code, so it gets **its own list**
and its own port. One variable does both:

```sh
BAKMARK_ENV=staging SIGNUP_ALLOWED_DOMAINS=markmeijerman.eu,mail-tester.com ./start.sh
# http://localhost:8086, data in ./data-staging
```

| | data | port |
|---|---|---|
| local | `./data` | 8085 |
| staging | `./data-staging` | 8086 |
| production (VPS) | `BAKMARK_DATA_DIR=/var/lib/bakmark` | its own host |

All three read the same variables through the same code; only the values
differ. `local` and `staging` come with a default path and port because a
throwaway run should not need configuration. `production` has none, because the
values that serve real subscribers belong in its own environment, not in a
script default.

A directory is claimed by the first environment that uses it and records the
name; pointing another environment at it is refused rather than silently mixing
two lists:

`compose.yaml` has no default for `BAKMARK_DATA_DIR`; a bare `docker compose up`
fails rather than guess. `start.sh` also refuses to run with `BAKMARK_ENV=staging`
when the path resolves to a production list (`*/data`, `/var/lib/bakmark`).

Only allowlisted domains may sign up on staging:

An address outside the list is refused, not stored and not mailed. The response
is byte-for-byte the same as for a malformed address, so the visitor learns
nothing about the allowlist and a stranger cannot probe which domains it
contains. Unset or empty means no restriction, which is what development and
production use.

Subdomains of a listed domain are accepted (`a@staging.markmeijerman.eu`), and
look-alikes are not (`a@evilmarkmeijerman.eu`).

### Mail in development

Nothing leaves the machine. `./start.sh` also starts Mailpit — it sits in the
compose `dev` profile, so a staging or production run of the same file never
starts one (their mail goes through the host's Postfix) — and every mail the app
sends is caught there:

- catcher UI: http://localhost:8025
- SMTP: `127.0.0.1:1025`

`src/lib/mail.ts` defaults to the catcher and refuses a non-loopback SMTP host
unless `MAIL_ALLOW_REMOTE=1` is set, so a copied production `.env` cannot mail
a real person. `NODE_ENV=production` has no default at all: without
`SMTP_URL`, sending throws instead of falling back.

Running the app outside Docker (`npm run dev`) works too, as long as the
catcher is up: `docker compose up -d mailpit`.

`docker compose down -v` leaves `./data` alone. It only removes the container
and its network.

On the VPS, keep the data outside the checkout and let the host's nginx stay
the public door:

```sh
sudo install -d -o 1000 -g 1000 -m 700 /var/lib/bakmark
BAKMARK_DATA_DIR=/var/lib/bakmark SMTP_URL=smtp://<mail-host>:25 ./start.sh
```

The vhost is provisioning's, not this repository's: `vps1-provisioning`,
`group_vars/production/websites.yml` → `nginx_server_templates_proxies`,
`proxy-https.conf.j2` with `proxy_pass 127.0.0.1:8085` (8085 production, 8090
staging, 8091 the visit counter). The container publishes on loopback only, so
it cannot collide with the other projects on the box, and Docker's iptables
edits cannot expose it either.

The container runs as uid 1000, so `BAKMARK_DATA_DIR` must be owned by
`1000:1000`. If it is not writable, signups fail with a `[subscribe]` error in
`docker compose logs bakmark`.

### Deleting unconfirmed addresses

An address that was never confirmed is deleted 24 hours after signup
(`src/lib/config.ts`). The confirmation mail states that window, so the number
lives in one place and the job reads it.

The job is a command, run by the **host's** cron, not the container's: a
container's crontab dies with the container. `deploy.sh` installs the entry
itself, on every environment, at 04:17:

```sh
17 4 * * * cd <app dir> && BAKMARK_ENV=<env> /usr/bin/env docker compose run --rm -T bakmark \
  node --experimental-strip-types scripts/purge.mjs >> ~/.bakmark-purge.log 2>&1
```

The block sits between `# >>> bakmark cron` markers in the deploy user's
crontab and is replaced on every deploy, so a deploy never leaves two copies
running. If an older hand-added line for this job exists, delete it: the block
does not know about it, and two purges is harmless, two newsletters is not.

It prints one line, `removed N unconfirmed addresses older than 24 hours`, so
the log answers whether it ran. Run it by hand the same way, without the `--hour`
guard if you copied the newsletter line.

Backup: stop the container, then copy every `subscribers.sqlite*` file — the
`-wal` file holds committed rows that are not in the main file yet.

### Removing addresses that bounce

The newsletter leaves with `bounce@bakmark.nl` as its envelope sender, so a
failure comes back as a delivery report — to a Proton mailbox this code cannot
read. What it *can* read is Postfix's own log on the box that sends the
newsletter, which is where every failed attempt lands anyway.

```sh
# what the daily cron runs, on the host
docker compose run --rm -T bakmark node --experimental-strip-types scripts/bounces.mjs < /var/log/mail.log
```

- **Hard bounce** (`status=bounced` with a `5.x.x` code) → the address is
  deleted. A dead mailbox costs a send every week and hits the sending
  reputation.
- **Soft** (`deferred`, `4.x.x`, an expired queue) → kept. A full mailbox or a
  greylisting server is not an unsubscribe, and the next mail may well arrive.
- One line out, always: `3 hard bounce(s), 3 removed; 2 soft (kept); 40 delivered`.

Reading that log is why `deploy` is in the `adm` group, and why provisioning
sets `ForwardToSyslog=yes`: until it did, `/var/log/mail.log` was empty and this
job had nothing to read.

What it does not catch: a refusal a *receiving* server sends after accepting the
message. That report goes to the Proton mailbox and needs IMAP access
(Proton Bridge) — a separate step, deliberately not in here.

### Weekly newsletter

A video exists in `recipes/<slug>.json` (`video.status` = `gepubliceerd` plus a
`youtube_id`). Every Friday at 19:00 Europe/Amsterdam the production deployment
mails the confirmed list the videos published since the previous newsletter.
Nothing is sent in a week without new videos: a mail that says "no news this
week" trains the list to ignore the next one.

The mail links to the recipe page, not to YouTube: the video is embedded there,
next to the timings and the print view, and a watch link would send the reader
past all of it. Every recipe carries a picture, the same one the card on
`/recepten` shows. Until a recipe has a photo that is
`public/recept-placeholder.png`, a raster stand-in for the CSS placeholder box
(a card cannot be a `<div>` in a mail); the slot is an `<img>`, so a real photo
replaces it one URL at a time. Each subscriber gets their own mail, in their own language, with
their own unsubscribe link and a `List-Unsubscribe` header. Not a bcc: a shared
recipient header shows everyone who else is on the list, and one unsubscribe
link cannot serve all of them.

Only confirmed addresses are mailed. An address that never confirmed asked for
nothing but the confirmation link.

`deploy.sh` installs the cron entry itself, and only when
`BAKMARK_ENV=production`: staging and local runs never schedule it. The entry
lives in the deploy user's crontab, between `# >>> bakmark newsletter` markers,
and is replaced on every deploy, so deploying twice does not mail twice.

Two entries cover daylight saving (17:00 and 18:00 UTC); the job exits unless it
is 19:00 in the Netherlands, so exactly one of them fires. `CRON_TZ` would be
shorter, but a cron that ignores it would send at 21:00 all summer.

Run it by hand the same way cron does:

```sh
cd /srv/bakmark-production && BAKMARK_ENV=production /usr/bin/env docker compose run --rm -T bakmark \
  node --experimental-strip-types scripts/newsletter.mjs
```

Omit `--hour 19` to run regardless of the clock. One line comes out either way:
`1 new video(s) to 12/12 subscriber(s): soesjes` or `0 new; nothing sent`. The
log is `~/.bakmark-newsletter.log` on the server.

Before anything is published, look at the mail itself:

```sh
npm run newsletter -- --preview you@example.com    # against Mailpit in development
```

`--preview` sends every recipe that has a video, concepts included and marked as
such, to that one address, and never writes the snapshot — so a test cannot tell
the next weekly run that this week's work was already sent.

Which ids were already mailed lives in `videos-mailed.json` next to the
subscriber list (`/var/lib/bakmark/`), not in the checkout: a deploy or a
rollback must not turn last week's video into a new one. Delete the file to
re-send the whole back catalogue.
