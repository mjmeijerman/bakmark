# Design tokens

Source of truth: `src/styles/global.css`. This file records the decisions so the
recipe template reuses them instead of inventing a second system.

## Type scale

Body never drops below 17px. Headings are serif, body is the system sans stack,
so nothing has to be downloaded before text is readable.

| Token | Size | Use |
|---|---|---|
| `--text-sm` | 15px | captions, chips, form labels, footer |
| `--text-body` | 17px | body copy |
| `--text-lead` | 19–23px | hero and section intro |
| `--text-h3` | 19–22px | card titles, subheadings |
| `--text-h2` | 24–32px | section headings |
| `--text-h1` | 36–60px | page title |

Line height 1.65 for body, 1.18 for headings, 1.05 for the h1. Line length caps
at `--measure: 65ch`; page width at `--measure-wide: 76ch`.

## Colour

Warm paper, one terracotta accent, no pure white or pure black. Every pair is
declared as `light-dark(light, dark)`, so `prefers-color-scheme` works without
JavaScript. The toggle stores `light` or `dark` in `localStorage` and sets
`data-theme` on `<html>`; the stored choice is applied before first paint.

| Token | Light | Dark | Contrast |
|---|---|---|---|
| `--bg` | `#f7f1e6` | `#15100c` | — |
| `--surface` | `#fffaf1` | `#211a14` | — |
| `--surface-warm` | `#f6e7c8` | `#2c2318` | — |
| `--text` on `--bg` | `#221c16` | `#f1e8dc` | 15.0:1 / 15.6:1 |
| `--muted` on `--bg` | `#6a5f52` | `#b3a495` | 5.5:1 / 7.8:1 |
| `--muted` on `--surface` | `#6a5f52` | `#b3a495` | 6.0:1 / 7.1:1 |
| `--accent` on `--bg` | `#a1471b` | `#f4a97c` | 5.4:1 / 9.7:1 |
| `--on-accent` on `--accent` | `#fffaf1` | `#201810` | 5.9:1 / 9.0:1 |
| `--accent-deep` on `--surface-warm` | `#7a3210` | `#ffc9a6` | 7.5:1 / ≥8:1 |
| `--text` on `--surface-warm` | `#221c16` | `#f1e8dc` | 13.8:1 / 12.7:1 |
| `--border`, `--border-strong` | `#e0d3bf`, `#c9b79f` | `#3a2f25`, `#4d4034` | decorative only |

All text pairs clear WCAG AA (4.5:1). Muted text is the lowest at 5.5:1; nothing
relies on colour alone.

## Warmth and shape

- Two very soft radial washes on the body (`--wash-a`, `--wash-b`), no image
  request, plus a diagonal hatch inside placeholder boxes so they read as
  unfinished.
- `--radius: 0.5rem` for inputs and small boxes, `--radius-lg: 1rem` for cards,
  callouts and the newsletter block. Pills (999px) for chips, buttons and the
  theme toggle.
- `--shadow-soft` for resting cards, `--shadow-lift` on hover. Both warm brown
  in light mode, black in dark mode.
- Headings sit above a 3px accent rule on section pages; the kicker above an h1
  is uppercase 15px in accent.
- Spacing scale: `--space-1` to `--space-8` = 0.5, 0.75, 1, 1.5, 2, 3, 4, 6rem.

## Logo

The Bakmark mark is `public/logo-bakmark.png`: the brand badge, gold on a
transparent background, 160px, used at 40px in the header and 32px in the
footer, always next to the wordmark — below 48px the curved `BAKMARK` inside
the badge is not readable, so the text does the name and the badge is the
emblem. The favicon is the same badge on the dark brown `#221c16` tile,
because gold alone disappears in a tab bar.

There is no vector of this artwork; it was generated as a raster and tracing it
produced a 1 MB SVG with ragged edges, so the PNG is the original. Light mode
deepens it by `--logo-filter` (brightness 0.82, saturation 1.15): gold on cream
paper is thin, and on the dark background the untouched artwork already reads.
The mark keeps its own gold, which is the one place where the single-accent
rule does not apply — it is a supplied brand asset, not a UI colour.

## Difficulty icon

`public/koksmuts.svg` is the chef's hat, drawn for this site. It is a plain
black silhouette used as a CSS mask (`.difficulty-icon`), so one file serves
the recipe page, the cards and the filter chips, and the hat takes
`currentColor` (`--accent` in the badge) instead of shipping a copy per card.

## Rules that outlive the tokens

- One accent colour. If a second one is needed, the design is wrong.
- Focus ring: 3px `--accent` with 3px offset, on `:focus-visible` only.
- No meaning by colour alone; links stay underlined.
- No cookie banner: there is nothing to consent to.
- Placeholder images are dashed, hatched boxes that say "Placeholder". Never
  stock photos.
- Body text, line length and heading order stay under WCAG AA at 200% zoom.
