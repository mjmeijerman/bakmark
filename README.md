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
├── src/pages/          # Dutch routes: /, /recepten, /recepten/<slug>,
│                       # /wie, /hoe-het-werkt, /contact, /privacy
├── src/pages/en/       # English routes: /en, /en/recipes, /en/recipes/<slug>,
│                       # /en/who, /en/how-it-works, /en/contact, /en/privacy
├── src/views/          # Page bodies, one per page, taking a `lang` prop
├── src/lib/i18n.ts     # route table, t(), path(), alternatePath()
├── src/lib/recipes.ts  # recipe loading, scaling, English text overlays
├── src/layouts/        # Layout.astro: head, header, footer, theme script
├── src/components/     # SiteHeader, ThemeToggle, NewsletterForm, PlaceholderImage,
│                       # RecipeCard, DifficultyBadge, RecipeSection
├── src/styles/         # global.css: tokens + base styles
├── recipes/            # one JSON per recipe: the single source of truth
├── recipes/en/         # English text per recipe, words only (see below)
├── docs/design-tokens.md
├── public/             # static assets, copied as-is
├── astro.config.mjs
└── package.json
```

Design tokens and typography are documented in [`docs/design-tokens.md`](docs/design-tokens.md).

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

Nothing leaves the machine. `./start.sh` also starts Mailpit, and every mail
the app sends is caught there:

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

On the VPS, keep the data outside the checkout and let the host's Caddy stay
the public door:

```sh
sudo install -d -o 1000 -g 1000 -m 700 /var/lib/bakmark
BAKMARK_DATA_DIR=/var/lib/bakmark SMTP_URL=smtp://<mail-host>:25 ./start.sh
```

Caddy site block (the container publishes on loopback only, so it cannot
collide with the other projects on the box):

```caddyfile
bakmark.nl {
	reverse_proxy 127.0.0.1:8085
}
```

The container runs as uid 1000, so `BAKMARK_DATA_DIR` must be owned by
`1000:1000`. If it is not writable, signups fail with a `[subscribe]` error in
`docker compose logs bakmark`.

### Deleting unconfirmed addresses

An address that was never confirmed is deleted 24 hours after signup
(`src/lib/config.ts`). The confirmation mail states that window, so the number
lives in one place and the job reads it.

The job is a command, run by the **host's** cron, not the container's: a
container's crontab dies with the container.

```sh
# daily at 04:17
17 4 * * * cd /srv/bakmark && BAKMARK_DATA_DIR=/var/lib/bakmark /usr/bin/env docker compose run --rm -T bakmark node --experimental-strip-types scripts/purge.mjs
```

Run it by hand the same way. It prints one line, `removed N unconfirmed
addresses older than 24 hours`, so a cron log answers whether it ran.

Backup: stop the container, then copy every `subscribers.sqlite*` file — the
`-wal` file holds committed rows that are not in the main file yet.
