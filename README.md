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
mkdir -p data && chmod 700 data
docker compose up --build -d
# http://localhost:8085
```

`docker compose down -v` leaves `./data` alone. It only removes the container
and its network.

On the VPS, keep the data outside the checkout and let the host's Caddy stay
the public door:

```sh
sudo install -d -o 1000 -g 1000 -m 700 /var/lib/bakmark
BAKMARK_DATA_DIR=/var/lib/bakmark docker compose up -d --build
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

Backup: stop the container, then copy every `subscribers.sqlite*` file — the
`-wal` file holds committed rows that are not in the main file yet.
