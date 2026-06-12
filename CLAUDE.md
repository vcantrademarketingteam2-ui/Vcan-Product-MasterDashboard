# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working rules (IMPORTANT)

These apply to **every** change, not just large ones:

1. **Bump the version on every change.** Update the version string in both [src/App.jsx](src/App.jsx) (the header badge, search `v2.`) and [package.json](package.json) so they always match. Patch bump for fixes/tweaks, minor bump for new features. Never ship a change without moving the version.
2. **Back up before editing, every time.** Copy the files you are about to change into `backups/<YYYYMMDD_HHmmss>/` first, so any change can be reverted if it breaks. `backups/` is git-ignored and stays local. Do this even for small edits.
3. **Ask before acting when in doubt.** If a request is ambiguous — unclear formula, layout choice, which data source, or any decision that would be costly to redo — ask the user a focused question *before* writing code, rather than guessing. Investigating the actual files/data first (to ask a well-informed question) is fine; guessing the intent is not.
4. **Regenerate data after parser/source changes.** When you change [convert_promo.py](convert_promo.py) or [convert_to_data.py](convert_to_data.py), or the user says the source xlsx changed, re-run the relevant script so the generated [src/promo_data.js](src/promo_data.js) / [src/data.js](src/data.js) reflect it, then commit the regenerated files together with the code change. Don't ship a parser change without regenerating.

## Token management & task priority

- **Resource awareness:** Always monitor token usage and the context limit.
- **Priority shifting:** If the context limit is approaching and the overall task is incomplete, immediately pause secondary styling tasks and shift full priority to completing the most critical/core functional components.
- **Pending tasks report:** If you run out of tokens or must stop before completing the entire request, you MUST generate a `[PENDING TASKS REPORT]` at the end of your response. The report must explicitly list:
  1. What has been successfully implemented.
  2. What is partially done.
  3. What is left to do (written so it can be used as the prompt for the next session).

## Code efficiency & safety constraints

- **Modular & DRY code:** Write clean, modular, DRY code to naturally optimize token usage. Do not sacrifice core functionality, error handling, or readability just to make the code arbitrarily shorter.
- **Targeted modifications:** When editing existing files, focus ONLY on the specific logic or UI components being changed to save tokens. Avoid rewriting entire files when only small sections require updates.
- **Strictly NO lazy placeholders:** NEVER use lazy placeholders (e.g., `// ... rest of the code ...`, `// existing code`) if it risks breaking the script during automated file patching. Always provide complete, functional blocks for the sections being modified.

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

Since v2.19.0 light mode is a **warm porcelain** palette (bg `#f4efe9`, bronze accent `#a5784a`) with soft green/coral aurora radial-gradients on the app root; dark mode palette is unchanged. A shared `glassPanel` style object (defined next to `t` in App.jsx) provides the frosted-glass card treatment — spread it into card containers instead of hand-rolling `backdrop-filter` styles. `t` values stay **solid hexes** on purpose: sticky headers/rails need opaque backgrounds to mask scrolling content; translucency is applied per-component only where safe.

### Tabs

- **Products** — filterable table with vendor/brand/status/search filters + stat cards; row click opens `ProductPopup` (data-forward `variant`)
- **Analytics** — portfolio KPIs, brand distribution dot-matrix, distribution gaps, retailer scorecard (driven by the `intel` memo; factual, no auto-recommendations)
- **Packshot** — image gallery; card click opens `ProductPopup` (image-forward `variant`). Images live in `public/packshots/<barcode>_<front|back>.webp`; `.jpg/.png` originals are git-ignored, only `.webp` is committed/deployed
- **Promotion Plan** — live as of v2.13.0; implemented in [src/PromoSection.jsx](src/PromoSection.jsx) (extracted component, not inlined in App.jsx). Reads from [src/promo_data.js](src/promo_data.js). See PromoSection section below.

### PromoSection (Promotion Plan tab)

Implemented in [src/PromoSection.jsx](src/PromoSection.jsx) + [src/PromoSection.css](src/PromoSection.css). App.jsx renders it as:
```jsx
<PromoSection rawData={rawData} retailerData={retailerData} t={t} dark={dark}
              isMobile={isMobile} onSelect={setSelectedProduct} RetailerLogo={RetailerLogo} />
```

**Data source:** `promo_data.js` exports `default` (promo items array), `PROMO_META` (per-retailer period list), `PROMO_ACTIVITY` (activity type definitions), `PROMO_RETAILERS` (ordered retailer list).

**Activity color overrides (in PromoSection, NOT in promo_data.js) — v2.19.0 neon palette:**
- `field` → `#f97316` (orange)
- `media` → `#22d3ee` (neon cyan)
- `looks` → `#f061ff` (neon fuchsia)
- `clearance` → `#f43f5e` (neon coral, `CLEAR_COLOR` constant) — moved off cyan so media owns it
- **No-activity promos** get an **ice-silver frosted-glass pill** via `getBarStyle()` (`bs.ice` flag, `bs.txt` text color) — the old gold-gradient price pill is removed and must NOT come back
- `GOLD_A`/`GOLD_B` are now **bronze** (`#d4a86a`/`#9c6b35`) and are chrome-accent only (selection states, NOW markers, Calc button) — never price pills

**RetailerLogo:** passed as a prop from App.jsx (`RetailerLogo` component). Customer selector pills use logo images, not plain text. Do not replace with text.

**NOW glow line technique:** CSS `calc()` with `%` is unreliable inside `min-width: max-content` containers. The overlay uses `useLayoutEffect` + `getBoundingClientRect` to measure the NOW slot's actual pixel position after each render, then sets the overlay `left` as a hard pixel value. Refs: `calInnerRef` (Calendar) and `tlInnerRef` (Timeline). The measurement function looks for `.ps-now-ph` (Calendar header cell) or `.ps-now-slot` (Timeline data cell).

**Two views:**
- **Calendar** — period-column matrix, compact price chips (`.ps-chip`), brand band rows sticky left, column header shows period code + date range + NOW tag
- **Timeline** — Gantt/swimlane redesign: month-only axis, thin colored brand header strips (`.ps-tl-brand-hdr`), 68px rows with wide Gantt bars (`.ps-bar`) in gradient activity color, white bold price + discount % subtitle + activity dots. Column separators transparent (open look).

**PIN gate:** `DEPT_PINS` maps env var pins → department name. Unlocked state shows GP% in cells and compensate values. `VITE_PIN_SALES` / `VITE_PIN_DATA` env vars (defaults hardcoded as fallback).

**Hover discount tooltip:** `.ps-tip` inside `.ps-chip`, `.ps-tl-pill`, and `.ps-bar` — `opacity: 0` → `1` on parent hover. Shows `−N%` discount off RSP.

### Mobile UI rules (IMPORTANT)

The app supports mobile (`isMobile` = `window.innerWidth < 768`). **Every UI change must be checked against both desktop and mobile.** Key differences:

- **Products table** — mobile shows only 3 columns (No., Brand/Product, Status); no retailer dot columns. The retailer logo filter pills are **hidden on mobile** (`{!isMobile && ...}`) since they filter columns that don't exist there. Row filtering by retailer still applies (products are filtered, just not the columns).
- **Packshot customer filter** — visible on mobile; buttons use larger padding (`6px 9px`) and `minHeight: 40px` for touch targets. Logo height increases to `h={26}` on mobile.
- **Popup** — mobile variant slides up from bottom (`alignItems: flex-end`, `borderRadius: 16px 16px 0 0`, `maxHeight: 95dvh`). Packshot hero layout (`isPackshotView`) is desktop-only (`variant === 'packshot' && !isMobile`).
- **Scrollable tables** (Analytics matrix, Retailer Scorecard, Popup pricing) — always wrapped in `overflowX: 'auto'` with `WebkitOverflowScrolling: 'touch'` and a `minWidth` so they scroll horizontally on small screens.
- **Touch targets** — interactive elements on mobile should be at least 40px tall. Use `isMobile ? '...mobile...' : '...desktop...'` inline for padding/size adjustments.
- Sidebar is a slide-in drawer on mobile (fixed, `transform: translateX`). Filters inside it are always accessible via the hamburger menu.

## Current redesign task (v2.18.0, June 2026)

Reference design: https://topsnonsaletracker.pages.dev/ — clean theme, neon accents, analytics-style graphs.

**Status: all three tasks completed in v2.18.0.**

1. ✅ **Grid** — glowline effect fully removed (overlay div, `calNowX`/`calInnerRef` measurement, and the `.ps-now-ph`/`.ps-now-cell` glow CSS). Current period is now highlighted with a clean gold column: `nowBg` tint + crisp 2px inset edges (`boxShadow: inset ±2px 0 0`) + NOW tag. No glow anywhere in Grid.
2. ✅ **Schedule/Spotlight bugs + redesign** —
   - **Critical remount bug fixed**: views were rendered as `<Calendar />`/`<Schedule />`/`<Spotlight />` but defined *inside* the component, so every state change (e.g. bar tooltip mousemove) remounted the subtree and reset scroll. They are now invoked as plain function calls (`Calendar()` etc.) — keep it that way.
   - Schedule: Window selector moved *outside* the scroll container (it was sticky top:0 and collided with the sticky month axis); glow NOW line replaced with a clean dashed TODAY marker; lanes redesigned as wire-line tracks with floating pill bars (radius 99) + soft neon drop shadow — visually distinct from Grid's chip matrix.
   - Spotlight: added neon stat strip (Live promos / Avg discount / Next wave); "next period" now resolves to the first *future* period when nothing is current (was wrongly `periods[0]`); discount % guarded against missing/zero RSP (`offPctOf` module helper — use it for all discount math); date-display year bug fixed (`dr.s` not `dr.e`).
   - Mobile: sticky lead columns narrowed via media query in PromoSection.css.
3. ✅ **Analytics tab** — KPI cards got neon top border + glowing value; new "Brand Portfolio" horizontal neon bar chart (active SKUs per brand, vendor-colored); Retailer Scorecard bars rounded with neon glow.

No pending tasks from this redesign.

## Version history (recent)

| Version | What changed |
|---------|-------------|
| v2.19.0 | Porcelain glass redesign: app-wide warm-cream light theme + aurora glows, glassmorphism panels (Promotion Plan + Analytics), neon activity palette (media cyan / looks fuchsia / clearance coral), gold price pill → ice-silver glass, bronze chrome. Spec: docs/superpowers/specs/2026-06-12-porcelain-glass-redesign-design.md |
| v2.18.0 | Grid glowline removed (clean current-period highlight); Schedule/Spotlight remount+scroll bug fixed, pill-bar Gantt redesign, Spotlight stat strip; Analytics neon graph upgrade + Brand Portfolio chart |
| v2.14.0 | Fix NOW glow line (useLayoutEffect pixel measurement); Timeline redesigned as Gantt/swimlane (month-only axis, colored bars, brand strips) |
| v2.13.0 | Promotion Plan launched: PromoSection.jsx extracted component, Calendar + Timeline views, hover discount tooltip (−%), activity ribbon, customer logo pills |
| v2.12.x | Timeline NOW glow line continuity fixes (multiple attempts before v2.14 pixel approach) |
