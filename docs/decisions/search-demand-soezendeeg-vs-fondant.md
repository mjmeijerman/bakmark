# Search demand: `soezendeeg maken` vs `banketbakkersfondant maken`

**Verdict (pulled 2026-10-26): keep soezendeeg as video 1. Delete `banketbakkersfondant maken` as a target keyword — it is not a query. Video 2 targets `fondant maken`.**

## 1. The numbers

Google Trends, geo `NL`, UI language `nl`, weekly resolution. Each comparison set is normalised to its own peak (100), so read a set top to bottom, never across sets.

**Set 1 — the pair named in the plan, 12 months (53 weeks)**

| Query | Avg index | Peak | Weeks with any data |
|---|---|---|---|
| `soezendeeg maken` | 2.06 | 100 | 2 |
| `banketbakkersfondant maken` | 0.00 | 0 | 0 |

**Set 2 — same pair, 5 years (262 weeks)**

| Query | Avg index | Peak | Weeks with any data |
|---|---|---|---|
| `soezendeeg maken` | 0.42 | 100 | 2 |
| `banketbakkersfondant maken` | 0.00 | 0 | 0 |

**Set 3 — head terms, 12 months (53 weeks)**

| Query | Avg index | Peak | Weeks with any data |
|---|---|---|---|
| `soezendeeg` | 6.34 | 100 | 7 |
| `banketbakkersfondant` | 0.77 | 41 | 1 |
| `fondant maken` | 9.02 | 60 | 11 |

**Set 4 — real fondant query vs soezendeeg, 12 months (53 weeks)**

| Query | Avg index | Peak | Weeks with any data |
|---|---|---|---|
| `soezendeeg maken` | 1.87 | 91 | 2 |
| `fondant maken` | 15.04 | 100 | 11 |

**Set 5 — same pair, 5 years (262 weeks)**

| Query | Avg index | Peak | Weeks with any data |
|---|---|---|---|
| `soezendeeg maken` | 0.24 | 59 | 2 |
| `fondant maken` | 25.79 | 100 | 115 |

Secondary signals, same day:

| Query | Google autocomplete (NL) |
|---|---|
| `soezendeeg` | 10 suggestions (`soezendeeg maken`, `kant en klaar`, `ah`, `kopen`, `invriezen`, `te dun`, `bewaren`, `rutger`, …) |
| `banketbakkersfondant` | 0 suggestions |
| `banketbakkersfondant maken` | 0 suggestions |
| `fondant maken` | 10 suggestions (`recept`, `rutger`, `marshmallows`, `met poedersuiker`, `voor tompouce`, `zonder glucose`, `zelf fondant maken`, …) |

## 2. What it says

1. **`banketbakkersfondant maken` is a non-query.** Zero signal in 262 weeks, zero autocomplete suggestions. The plan named it as the "highest-intent Dutch search query of the five". That claim is wrong for this phrasing.
2. **`soezendeeg maken` is small but real.** Autocomplete has a full suggestion set, so the query exists above Google's suggestion threshold — the same threshold `banketbakkersfondant` does not reach.
3. **`fondant maken` is the volume term.** ~100× `soezendeeg maken` on the 5-year average (25.79 vs 0.24), and it registers in 115 of 262 weeks instead of 2. This is the term the fondant video must be titled on.
4. **The swap condition is not triggered.** D1 said "if fondant dwarfs it, swap videos 1 and 2". Corrected to the real query, fondant does dwarf it — but the reason to keep soezendeeg first was never traffic: the first take is the rig-and-audio experiment, and fondant is the worst pilot (white-on-white sugar work, highest failure rate). Search demand does not move that argument. **Order stays: soezendeeg → fondant.**
5. **Keyword for video 2 changes** from `banketbakkersfondant maken` to `fondant maken` (with `fondant recept`, `zelf fondant maken`, `fondant maken zonder glucose` as long-tail variants from autocomplete). Title becomes `fondant maken | zonder knippen`.

## 3. Caveats

- Trends indices are relative, not absolute volume. Both terms sit at or below Google's reporting floor, so the zeros mean "below threshold", not "nobody".
- The only non-zero weeks for `soezendeeg maken` are 11–17 Oct 2026 and 18–24 Oct 2026 — the weeks this plan was written. Self-generated interest (founder, team, meeting tooling) is a plausible explanation and cannot be excluded. Do not read it as a trend.
- Autocomplete presence is a coarse threshold test, not a volume measurement.
- **These magnitudes do not support "acquisition is search" at year 1.** Every candidate term here is a Dutch long-tail with a handful of weekly queries. This check cannot validate the traffic assumption in §4 of the plan; that needs Search Console impressions after video 1. Flagged, not resolved.

## 4. Method (reproducible)

```bash
# explore: get widget tokens for the comparison
GET https://trends.google.com/trends/api/explore?hl=nl&tz=0&req=<urlencoded comparisonItem JSON>
# timeseries: weekly index per keyword
GET https://trends.google.com/trends/api/widgetdata/multiline?hl=nl&tz=0&req=<widget request>&token=<widget token>
# autocomplete presence
GET https://suggestqueries.google.com/complete/search?client=firefox&hl=nl&gl=nl&q=<query>
```

Both Trends endpoints need a browser user-agent and a cookie jar warmed on `trends.google.com`; unpaced calls return HTTP 429 or empty payloads.

Pairs pulled: `soezendeeg maken` + `banketbakkersfondant maken` (12 months, 5 years), `soezendeeg maken` + `fondant maken` (12 months, 5 years), `soezendeeg` + `banketbakkersfondant` + `fondant maken` (12 months).
