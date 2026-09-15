# Free Cash Flow Trend Tracker

Public monthly FCF dashboard. **First paint is complete HTML** — `curl -sL` shows operating cash flow, capex, free cash flow, FCF margin, cumulative FCF, and every month row with no `Loading…` shell. JavaScript only enhances.

Sample series: **18 months** (2025-04 through 2026-09) for Northwind Cloud, Inc., in USD millions.

## Formulas

| Metric | Formula |
| --- | --- |
| Free cash flow | `FCF = OCF − \|capex\|` |
| FCF margin | `FCF / revenue` |
| MoM change | `current − previous` |
| MoM % change | `(current − previous) / \|previous\|` |
| Cumulative FCF | running sum of monthly FCF |
| Target comparison | `actual − target` (met when `actual ≥ target`) |

**Capex sign convention:** capex is stored as a **positive cash outflow (spend)**. The library still applies `Math.abs(capex)`, so a negative filing-style capex produces the same FCF.

Safe math: `null`, empty strings, `NaN`, `Infinity`, empty series, and missing months return **`null`**. Zero OCF and zero capex are valid and compute normally (`0 − |capex|`, `OCF − 0`). Division by zero (margin, MoM %, target %) returns `null`, never `NaN` or `Infinity`.

Default sample targets: **$40.0M** monthly FCF and **10.0%** FCF margin.

## How to re-render

1. Edit `data/fcf.json` (months, targets, or metadata).
2. Bake `index.html`:

```bash
node scripts/render-static.js
```

3. Open `index.html` or serve the folder:

```bash
python3 -m http.server 8080
```

4. Run tests:

```bash
bash scripts/test.sh
```

`js/fcf.js` is a UMD module (`require("./js/fcf.js")` in Node, `window.FCF` in the browser). `js/app.js` only adds a `js-enhanced` class; it does not replace the table.

## Suggested next improvements

- Trailing-twelve-month FCF and FCF conversion (FCF / net income).
- Quarterly and fiscal-year rollups next to the monthly view.
- FCF yield vs market cap if a price series is added.
- Capex plan vs actual, with a toggle between maintenance and growth capex.
- Pull OCF / capex from 10-Q cash-flow statements instead of the sample JSON.
- Export CSV and a printable one-pager for board packs.
