# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # start dev server (Vite HMR)
npm run build     # production build → dist/
npm run preview   # preview production build locally
npm run lint      # ESLint
```

Deploy is via `src/deploy.bat` (git add/commit/push), and Netlify auto-builds from the main branch. Live URL: https://vcanproductmasterdashboard.netlify.app

There are no tests configured.

## Architecture

This is a **single-file React app** — all logic, state, and UI lives in [src/App.jsx](src/App.jsx). There is no router and no external state library.

### Data flow

On mount, the app fetches a published Google Sheets CSV (`SHEET_URL` in App.jsx). If the fetch fails, it falls back to hardcoded data in [src/data.js](src/data.js). The user can also import a CSV file manually via the "Import CSV" button, which triggers the same parser.

The CSV parser (`parseCSV`) handles three row layout variants from the spreadsheet format:
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

- **Products** — filterable table with vendor/brand/status/search filters + stat cards
- **Analytics** — brand ranking, retailer coverage bar chart, per-vendor breakdown, retailer penetration table
- **Packshot** — placeholder, coming in v2.0
