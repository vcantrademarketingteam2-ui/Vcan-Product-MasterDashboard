# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working rules (IMPORTANT)

These apply to **every** change, not just large ones:

1. **Bump the version on every change.** Update the version string in both [src/App.jsx](src/App.jsx) (the header badge, search `v2.`) and [package.json](package.json) so they always match. Patch bump for fixes/tweaks, minor bump for new features. Never ship a change without moving the version.
2. **Back up before editing, every time.** Copy the files you are about to change into `backups/<YYYYMMDD_HHmmss>/` first, so any change can be reverted if it breaks. `backups/` is git-ignored and stays local. Do this even for small edits.

## Commands

```bash
npm run dev       # start dev server (Vite HMR)
npm run build     # production build → dist/
npm run preview   # preview production build locally
npm run lint      # ESLint
```

Deploy: push to `main` **auto-builds on Cloudflare Pages/Workers only** (primary, `wrangler.jsonc` serves `dist/` as a single-page app). **Netlify is a manual-only backup** — auto builds are turned off in the Netlify dashboard (Build & deploy → "Stop builds"); deploy it by hand from the Netlify Deploys tab → "Trigger deploy" only when the backup needs refreshing. `update_dashboard.bat` runs the full pipeline (xlsx → data → packshots → webp → commit/push). Netlify URL: https://vcanproductmasterdashboard.netlify.app

There are no tests configured.

## Architecture

This is a **single-file React app** — all logic, state, and UI lives in [src/App.jsx](src/App.jsx). There is no router and no external state library.

### Data flow

Product data is generated from `Product Master 2026.xlsx` (on the Y: drive) by [convert_to_data.py](convert_to_data.py), which writes [src/data.js](src/data.js) (products + `GENERATED_AT` build timestamp) and [src/retailer_data.js](src/retailer_data.js) (per-retailer cost/GP). The app imports these directly — there is no live Google Sheets fetch. The user can still import a CSV manually via the "Import CSV" button, which runs the in-app `parseCSV`.

Both parsers (`parse_master` in the Python script, `parseCSV` in App.jsx) must stay in sync. A vendor name (`Vcan`/`Moola`) can share a row with that section's first product — do **not** skip such rows or the product is dropped and following rows inherit the wrong brand. They handle three row layout variants from the spreadsheet format:
- **Layout A** — normal row: `col0=vendor`, `col1=brand`, `col2=barcode`
- **Layout B** — shifted row (e.g. Dove Men): `col0=brand-part`, `col1=barcode`
- **Layout C** — continuation row: `col0` and `col1` empty, brand inherited from previous row

Parsed products have this shape: `{ company, brand, barcode, product, packSize, rsp, status, retailers }` where `retailers` is a map of retailer name → status string.

### Key constants

- `RETAILERS` — ordered list of 12 retailers (Tops, Villa, The Mall, Lotus, …). Retailer columns in the table follow this exact order.
- Vendors: `'Vcan'` (yellow `#f0c040`) and `'Moola'` (red `#f25757`)
- Product status strings are Thai: `'ขาย'` = active, `'รอขาย'` = pending, `'ยกเลิกขาย'` = discontinued
- Retailer dot value `'A'` = active (green); `'รอขาย'` or `'On Process'` = pending (yellow); `'ยกเลิกขาย'` = discontinued (red); empty = not listed

### Theme system

The `t` object (computed from `dark` state) provides all colors used in inline styles throughout the component. All styling uses inline styles — there are no CSS class utilities in use (Tailwind config files exist in the repo but Tailwind is not installed).

### Tabs

- **Products** — filterable table with vendor/brand/status/search filters + stat cards; row click opens `ProductPopup` (data-forward `variant`)
- **Analytics** — portfolio KPIs, brand distribution dot-matrix, distribution gaps, retailer scorecard (driven by the `intel` memo; factual, no auto-recommendations)
- **Packshot** — image gallery; card click opens `ProductPopup` (image-forward `variant`). Images live in `public/packshots/<barcode>_<front|back>.webp`; `.jpg/.png` originals are git-ignored, only `.webp` is committed/deployed
- **Promotion Plan** — placeholder, coming in v2.5
