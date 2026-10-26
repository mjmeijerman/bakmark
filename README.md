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
├── src/pages/     # routes; index.astro is /
├── public/        # static assets, copied as-is
├── astro.config.mjs
└── package.json
```
