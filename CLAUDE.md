# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working rules (IMPORTANT)

These apply to **every** change, not just large ones:

1. **Bump the version on every change.** Update the version string in both [src/App.jsx](src/App.jsx) (the header badge, search `v2.`) and [package.json](package.json) so they always match. Patch bump for fixes/tweaks, minor bump for new features. Never ship a change without moving the version.
2. **Back up before editing, every time.** Copy the files you are about to change into `backups/<YYYYMMDD_HHmmss>/` first, so any change can be reverted if it breaks. `backups/` is git-ignored and stays local. Do this even for small edits.
3. **Ask before acting when in doubt.** If a request is ambiguous — unclear formula, layout choice, which data source, or any decision that would be costly to redo — ask the user a focused question *before* writing code, rather than guessing. Investigating the actual files/data first (to ask a well-informed question) is fine; guessing the intent is not.
4. **Regenerate data after parser/source changes.** When you change [convert_promo.py](convert_promo.py) or [convert_to_data.py](convert_to_data.py), or the user says the source xlsx changed, re-run the relevant script so the generated [src/promo_data.js](src/promo_data.js) / [src/data.js](src/data.js) reflect it, then commit the regenerated files together with the code change. Don't ship a parser change without regenerating.

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

### Mobile UI rules (IMPORTANT)

The app supports mobile (`isMobile` = `window.innerWidth < 768`). **Every UI change must be checked against both desktop and mobile.** Key differences:

- **Products table** — mobile shows only 3 columns (No., Brand/Product, Status); no retailer dot columns. The retailer logo filter pills are **hidden on mobile** (`{!isMobile && ...}`) since they filter columns that don't exist there. Row filtering by retailer still applies (products are filtered, just not the columns).
- **Packshot customer filter** — visible on mobile; buttons use larger padding (`6px 9px`) and `minHeight: 40px` for touch targets. Logo height increases to `h={26}` on mobile.
- **Popup** — mobile variant slides up from bottom (`alignItems: flex-end`, `borderRadius: 16px 16px 0 0`, `maxHeight: 95dvh`). Packshot hero layout (`isPackshotView`) is desktop-only (`variant === 'packshot' && !isMobile`).
- **Scrollable tables** (Analytics matrix, Retailer Scorecard, Popup pricing) — always wrapped in `overflowX: 'auto'` with `WebkitOverflowScrolling: 'touch'` and a `minWidth` so they scroll horizontally on small screens.
- **Touch targets** — interactive elements on mobile should be at least 40px tall. Use `isMobile ? '...mobile...' : '...desktop...'` inline for padding/size adjustments.
- Sidebar is a slide-in drawer on mobile (fixed, `transform: translateX`). Filters inside it are always accessible via the hamburger menu.
