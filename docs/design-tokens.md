# Design tokens

Source of truth: `src/styles/global.css`. This file records the decisions so the
recipe template reuses them instead of inventing a second system.

## Type scale

Body never drops below 17px. Headings are serif, body is the system sans stack,
so nothing has to be downloaded before text is readable.

| Token | Size | Use |
|---|---|---|
| `--text-sm` | 15px | captions, form labels, footer |
| `--text-body` | 17px | body copy |
| `--text-lead` | 19–22px | intro paragraph under an h1 |
| `--text-h3` | 19–21px | subheadings, card titles |
| `--text-h2` | 24–30px | section headings |
| `--text-h1` | 32–52px | page title |

Line height 1.65 for body, 1.2 for headings. Line length is capped at
`--measure: 65ch`; page width at `--measure-wide: 72ch`.

## Colour

Warm paper, one accent, no pure white or pure black. Every pair is declared as
`light-dark(light, dark)`, so `prefers-color-scheme` works without JavaScript.
The toggle only stores `light` or `dark` in `localStorage` and sets
`data-theme` on `<html>`; the stored choice is applied before first paint.

| Token | Light | Dark | Contrast |
|---|---|---|---|
| `--bg` | `#fbf7f0` | `#17130f` | — |
| `--surface` | `#f3ece1` | `#201b16` | — |
| `--text` on `--bg` | `#241f1a` | `#eee6da` | 15.3:1 / 14.9:1 |
| `--muted` on `--bg` | `#635a4f` | `#a89c8d` | 6.3:1 / 6.9:1 |
| `--accent` on `--bg` | `#8f3f13` | `#f0a878` | 6.8:1 / 9.3:1 |
| `--on-accent` on `--accent` | `#fbf7f0` | `#17130f` | 6.8:1 / 9.3:1 |
| `--border` on `--bg` | `#ddd2c2` | `#3a322a` | decorative only |

All text pairs clear WCAG AA (4.5:1) and the body pairs clear AAA (7:1) except
`--muted`, which is 6.3:1 in light mode. Borders never carry meaning alone.

## Spacing and shape

`--space-1` to `--space-8` = 0.5, 0.75, 1, 1.5, 2, 3, 4, 6rem. One radius
(`--radius: 0.5rem`) on inputs, buttons and bordered boxes. No shadows, no
gradients, no decorative borders.

## Rules that outlive the tokens

- One accent colour. If a second one is needed, the design is wrong.
- Focus ring: 3px `--accent` with 3px offset, on `:focus-visible` only.
- No meaning by colour alone; links stay underlined.
- No cookie banner: there is nothing to consent to.
- Placeholder images are dashed boxes that say "Placeholder". Never stock photos.
- Body text, line length and heading order stay under WCAG AA at 200% zoom.
