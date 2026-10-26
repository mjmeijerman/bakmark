# bakmark

Source for **De Ongeknipte Thuisbakker** — a static Astro site.

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
├── src/pages/          # /, /recepten, /recepten/soezendeeg, /waarom, /wie,
│                       # /hoe-het-werkt, /contact
├── src/layouts/        # Layout.astro: head, header, footer, theme script
├── src/components/     # SiteHeader, ThemeToggle, NewsletterForm, PlaceholderImage,
│                       # RecipeCard
├── src/styles/         # global.css: tokens + base styles
├── docs/design-tokens.md
├── public/             # static assets, copied as-is
├── astro.config.mjs
└── package.json
```

Design tokens and typography are documented in [`docs/design-tokens.md`](docs/design-tokens.md).
