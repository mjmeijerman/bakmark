# Rules for this repo

## Recipe copy lives in two files

Every word a visitor reads in a recipe exists twice:

- `recipes/<slug>.json` — Dutch, the source
- `recipes/en/<slug>.json` — English overlay, keyed by step id (`stap-3`), ingredient id, Dutch tool name, and the `faq` / `mislukt` array index

A copy change is not finished until both are edited. `tests/recipes.test.mjs` fails CI when an English entry is missing, but a test cannot see a wrong translation — whisk-for-spatula passes it. Coverage is machine-checked; correctness is on you.

`faq` and `mislukt` overlays are keyed by array index. Append to the Dutch arrays; reordering them silently moves the English text onto the wrong row.

## Everything else

- Never commit to `trunk`. Branch, push, open a PR, squash-merge.
- `npm test` before pushing; it builds the site first, so a broken Astro template fails there and not in production.
- Footage, renders and Shotcut projects live in `~/bakmark-footage`, never in the checkout. A repo must stay safe to delete.
