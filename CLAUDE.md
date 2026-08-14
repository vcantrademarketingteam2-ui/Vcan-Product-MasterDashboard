# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

For control precedence, follow `.hermes.md`; `MISSION.md` defines role routing and controlled
execution, while `HANDOFF.md` records current state and historical evidence. Git and actual
source files remain authoritative for repository and implementation facts.

## Working rules (IMPORTANT)

These apply to **every** change, not just large ones:

1. **Bump the version on every change.** Update the version string in both [src/App.jsx](src/App.jsx) (the header badge, search `v2.`) and [package.json](package.json) so they always match. Patch bump for fixes/tweaks, minor bump for new features. Never ship a change without moving the version.
2. **Back up before editing, every time.** Copy the files you are about to change into `backups/<YYYYMMDD_HHmmss>/` first, so any change can be reverted if it breaks. `backups/` is git-ignored and stays local. Do this even for small edits.
3. **Ask before acting when in doubt.** If a request is ambiguous — unclear formula, layout choice, which data source, or any decision that would be costly to redo — ask the user a focused question *before* writing code, rather than guessing. Investigating the actual files/data first (to ask a well-informed question) is fine; guessing the intent is not.
4. **Regenerate data after parser/source changes.** When you change [convert_promo.py](convert_promo.py) or [convert_to_data.py](convert_to_data.py), or the user says the source xlsx changed, re-run the relevant script so the generated [src/promo_data.js](src/promo_data.js) / [src/data.js](src/data.js) reflect it, then commit the regenerated files together with the code change. Don't ship a parser change without regenerating.

### Governance-only exception

A human-approved control-plane-only change may modify only explicitly authorized governance
files and does not require an application version bump, application source backup, or generated
build output.

This narrow exception applies only when all of the following are true:

- The human explicitly authorizes a governance-only change and its exact file scope.
- No application source, dependency, runtime configuration, generated data, or production asset is changed.
- The control files are backed up separately before editing.
- The governance commit remains isolated from application work.

Application or behavior changes continue to require every original versioning, backup, build,
test, regeneration, and verification rule in this file.

When Crew supplies a structured authorization record and complete approved brief, that context is
the human approval for that single attempt. Follow its exact worktree, allowed paths, acceptance
criteria, and stop conditions. Do not ask for another approval, search Obsidian for one, or reduce
the task to its title. If the record or complete brief is absent, stop before writing and report
`missing_crew_authorization`. Never modify a path outside the Crew allowlist, even if another
repository document appears to request it.

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

Deploy: push to `main` **auto-builds on Cloudflare Pages/Workers** (`wrangler.jsonc` serves `dist/` as a single-page app) — this is the only deploy target now, Netlify is no longer used. `update_dashboard.bat` runs the full pipeline (xlsx → data → packshots → webp → commit/push).

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
- **Light-mode contrast:** the `neon(c)` helper (uses module map `NEON_DEEP`) maps each neon hue to a deeper variant in light mode — route ALL activity-color rendering through it, never use `ACT[a].color` raw
- **Hover/active glow:** `.ps-glow` / `.ps-glow-on` CSS classes + inline `'--g'` custom property = the neon hover/selected system for buttons & filter pills; use these instead of hand-rolled hover handlers
- Icons are inline SVG components (`IcoTimeline`/`IcoGrid`/`IcoCalc`, module scope) — don't reintroduce emoji glyphs

**RetailerLogo:** passed as a prop from App.jsx (`RetailerLogo` component). Customer selector pills use logo images, not plain text. Do not replace with text.

**NOW line technique (v3.11.0 Calendar Pulse):** NO JS measurement anywhere. The Timeline's Gantt view is now **Calendar Pulse** — a fixed six-week window (the Monday-start week containing today + the next 5 weeks). Week gridlines, alternating tint, and the NOW line are all rendered by `PulseTrackBg()` (hook-free sub-function) as `left: N%` absolute children inside every `.ps-sched-track` (axis strip + each lane), driven by the `pulseRange`/`pulseWeeks` memos — the same percentage math `pulseBarPos()` uses for the bars, so drift is structurally impossible. The v3.5.0 `schedWindow`/`filteredSchedRange`/`schedMonthPos`/`SchedTrackBg`/`barPos` identifiers are DELETED (no 3mo/6mo/Full window selector anymore), as is the older `measureSched`/`tlNowX`/`tlInnerRef` `getBoundingClientRect` mechanism — do not reintroduce pixel measurement; if the NOW line ever looks off, fix the shared % math, not the DOM. Pulse also adds per-bar status: `ps-pulse-live` (current period), `ps-pulse-attention` (live, ≤3 days left), `ps-pulse-unassigned` (ice pill, "Promotion unassigned" tag), plus Live/Attention badges in the bar tooltip and legend. Styling for the `ps-pulse-*` classes lives in [PromoSection.css](src/PromoSection.css) (v3.11.0 CSS follow-up) — status rings on bars use `outline` (not `box-shadow`/`border`) so they layer on top of the inline activity-color glow instead of replacing it; legend dots, tooltip badges and the discontinued lead tag use solid saturated fills + white text so contrast holds in both themes.

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
| v3.11.0 | Timeline "Schedule" view replaced by **Calendar Pulse** ([PromoSection.jsx](src/PromoSection.jsx)): fixed six-week window (this Monday-start week + next 5), equal-width week cells with day-accurate bars, `PulseTrackBg()`/`pulseRange`/`pulseWeeks`/`pulseBarPos` replace `SchedTrackBg`/`schedWindow`/`filteredSchedRange`/`schedMonthPos`/`barPos` (window selector removed). Per-bar status classes (`ps-pulse-live`/`ps-pulse-attention` ≤3 days left/`ps-pulse-unassigned`), discontinued shown as lead-panel tag (striped year-end band removed), Live/Attention tooltip badges, expanded legend. `tlView` default `'schedule'` → `'pulse'`. Built via Product Master Crew (timeline-jsx brief), reviewed 2026-08-11. |
| v3.11.1 | Companion `ps-pulse-*` CSS shipped ([PromoSection.css](src/PromoSection.css)): bar status rings use `outline` (not `box-shadow`/`border`) so the inline activity-color glow from `getBarStyle()` is never overwritten — live = static green ring, attention (≤3 days left) = thicker static red ring, unassigned bars get a faint diagonal stripe overlay (`z-index:-1` pseudo-element so it stays behind the price text). Legend dots, tooltip badges (`ps-pulse-badge--live/--attention`), and the discontinued lead-panel tag use solid saturated fills + white text (matching the existing `.ps-now-tag` pattern) instead of theme-dependent hex, so contrast holds in both dark and porcelain-light without a `dark` prop in this CSS-only file. **Deliberately animation-free** (brief constraint) — all status cues are static; do not add pulse/blink keyframes here. Salvaged from Crew run `576f9651c74e46bbb3a6373b04b3951c` (candidate failed acceptance: 4 forbidden animations stripped, lockfile alignment completed by hand); also aligned both root `package-lock.json` version fields, which had lagged at 3.10.5 since v3.11.0. |
| v3.11.2 | Brand Category Switcher: shared `BrandCategoryFilter` component ([App.jsx](src/App.jsx)) — compact horizontal category tab rail (a11y `tablist`/`tab`/`tabpanel`, roving tabIndex, wrapping Left/Right arrows) + active-category brand-pill panel (equal-width `BrandPill` grid), selected-count badge per category, built-in Clear all. Replaces BOTH the Products-tab masonry panel and the Packshot flat pill row (`idPrefix` pm-products / pm-packshot, shared `selectedBrands` state); also passed into [PromoSection.jsx](src/PromoSection.jsx) as a prop for the Promotion Plan brand filter (`ps-promo` — its own `brandCompany`/`brandCounts` memos from promo items; old gold pill row removed). Promo `enrich()` fix: empty company + normalized brand `vernel` resolves to `Vcan` (Vernel no longer gets red/Moola treatment). A real `vernel.png` logo + optimized `tena.png` (93KB vs 157KB) rescued from the retired `task/brand-navigator-mini-capsules` worktree into `backups/20260814_rescued_brand_pngs/` — not yet wired in. Salvaged from Crew run `product-master-brand-navigator-v3112-20260814` (worker hit max_turns at 30 with component + Products wiring done; hand-finished Packshot/Promo wiring, Vernel fix, version bumps — Crew turn budget lesson: 50–60 for full briefs). Merged to `main` + deployed same day (Cloudflare version `73ebd722`). All ~24 stale Agentic OS worktrees pruned same day. |
| v3.5.0 | Schedule (Timeline) view complete overhaul + structural NOW-line fix ([PromoSection.jsx](src/PromoSection.jsx)/[.css](src/PromoSection.css)). NOW line/gridlines/bars now share one % coordinate system (`schedMonthPos` memo + `SchedTrackBg()` per-track background — see "NOW line technique" above); `measureSched`/`tlNowX`/`tlInnerRef` pixel measurement deleted. Visual redesign: month gridlines + alternate-month tint + current-month highlight, bronze 2px NOW line w/ axis TODAY tag, bars radius 99→9 w/ multi-activity dots (`ActDots`), lanes stretch full row height. All v3.4.0 features preserved (K.Village badge, disconFrom striped band, barTip tooltip, PIN GP%, ice pills). Opus-reviewed: 0 critical; minor follow-ups = NOW line has small gaps at brand-header strips (no track there), `nowPct` clamps to edge instead of hiding when TODAY is outside the data range. Built by Sonnet 5 subagent per MISSION.md roles. |
| v3.4.1 | Notification coverage expanded from 4 retailers to 6 (`convert_promo.py`). `parse_start_date` closed the v3.4.0 follow-up (Villa dot format `DD.MM.YY`) and gained two more branches: the day-range/slash format used by Big C ("5-25/1/23") and Foodland's Thai-Buddhist name field ("1-31/1/2569", Buddhist year auto-converts when >2400), plus a `year_hint`-based fallback for bare "MonthlyN" (Villa) / "Jan".."Dec" (Homepro) names mirroring the frontend's existing `inferPeriodDate`. `build_notification_schedule` now falls back from `dateRange` to the period `name` itself before giving up (Foodland's real date text lives in the name column, not dateRange, due to its sheet layout). Result: `notification_schedule.json` grew from 16→23 entries; Villa (3) and Homepro (4) now produce real alerts. **Foodland, Boots, and most of Big C's periods still produce zero entries** — traced to the source Excel itself: those products have empty `activities: []` for every period (Foodland), almost every period (Boots — only 3 products, 2 periods touched, no activities anywhere), or stale 2023 template dates (Big C — only 1 of 12 periods has any activity, and even that one is dated 2023, not 2026). This is a data-completeness gap in the promo Excels, not a parser bug — no code fix can conjure activities/dates that were never entered upstream. |
| v3.4.0 | Villa Promotion Plan fixes + branch-exclusive/discontinued surfacing. **NOW line** ([PromoSection.jsx](src/PromoSection.jsx)): `parseDR` now parses Villa's `DD.MM.YY - DD.MM.YY` dot format (was slash-only) — Villa periods were all falling back to `inferPeriodDate('MonthlyN')`, which mapped Monthly7→July and put NOW on Monthly7 when today (Jul 7) is actually in Monthly6 (25.06–22.07). Fixed everywhere (Grid highlight, Schedule TODAY marker, Spotlight). **LOOKS legend** gated to Tops only (`.filter(([k]) => k !== 'looks' || retailer === 'Tops')`). **Colour audit** ([convert_promo.py](convert_promo.py)): confirmed there is NO colour-key legend in the promo Excels — colour meaning is per-store. Added `RETAILER_ACTIVITY_OVERRIDE['Villa'] = {'yellow':'field'}` (Vnew shows ลงพื้นที่, was ลงสื่อ). Only Villa/Tops(yellow=media)/TWD(orange=media) are confirmed; Homepro yellow still unconfirmed. **Branch-exclusive** (Villa green `FF92D050` = เฉพาะสาขาเควิลเลจ / K.Village-only, e.g. Vernel BOGO): new `BRANCH_EXCLUSIVE_COLORS` map → per-cell `branchExclusive` flag (NOT an activity); `detect_marks` now returns `(acts, is_blue, has_comment, is_branch, is_discon)`. App renders a green "K.Village" badge on Grid chips/Schedule bars/Spotlight cards + tooltip; `getBarStyle` gained a `branch` param (green tint). This also resolved the Vernel "red bar" (green was mis-mapped to field). **Discontinued span** (red `FFFF0000`): parser emits product-level `disconFrom` (first red period); app draws a muted "ยกเลิกขาย" band from that period through year-end (Grid tint + Schedule striped band). Regenerated `promo_data.js`. *Known follow-up: `parse_start_date` still slash-only → Villa gets no LINE/bell alerts.* |
| v3.2.0 | Products-tab + bell UX pass. **Bell** ([App.jsx](src/App.jsx)): each alert is now a color-coded card (left bar + tint) by urgency — today=red, ≤2d=orange, ≤5d=yellow — with a plain-language countdown ("X days left until it starts" / "Starts today/tomorrow") via new module helper `alertUrgency()` + `daysUntil` import; the count badge tints to the most-urgent tone. *Send-LINE-test button intentionally left untouched (held for a later iteration).* **Brand pills** ([App.jsx](src/App.jsx)): grouped into Laundry / Homecare / Personal Care / Pet / Other via module-scope `BRAND_CAT_RULES` keyword map (`brandCategory()` + `brandGroups` memo, unmatched → "Other" so nothing drops); (category rules user-confirmed: Vnew→Laundry; Brilly/General Fresh/combat/Tempo→Homecare; plain **L'Arbre Vert**→Laundry but **L'Arbre Vert Body Wash**→Personal Care via exact-match regex ordered before the broad `/l'arbre/`; **WMF→Kitchen Ware** + **Tena/Malizia Intimate→Intimate**, both new own categories; rule ORDER matters — specific rules precede broad Personal Care fallbacks). Display order puts Kitchen Ware far right. Rendered as **text-weighted side-by-side columns** — one column per category (`BRAND_CATEGORIES.filter(has-brands)`), each `flex: <sumOfBrandNameChars> 1 0` (width ∝ total text length, so column height ≈ totalText/width ⇒ all columns end up ≈ equal height; a busy category like Personal Care gets wide enough to wrap into sub-columns instead of one tall stack). `minWidth:'min-content'` + pills `whiteSpace:nowrap` so a column never shrinks below its widest pill (no cramped 2-line pills). Pills enlarged via `renderBrandPill` (`8px 17px / 13.5px`). Vertical divider between columns; panel `maxHeight:44vh, overflowY:auto` height guard (desktop) so it never buries the table. **Mobile stacks them** (`isMobile`). Verified by headless-Chrome screenshot at 1600px (well-balanced) + 1280px (degrades to single-file, guard contains it). Earlier `flex:<count>` and `maxWidth:210` approaches both left Personal Care too tall. **iOS app icon fix:** `public/icon-512.png` (read by `apple-touch-icon` in [index.html](index.html) for the iOS home screen AND by the manifest) was still the old "VCAN" wordmark — regenerated from `public/icon.svg` (bronze V+star) into a full-bleed dark 512² square. The v3.0.0 "needs cairosvg" blocker is moot: render the SVG via headless Chrome (`chrome.exe --headless=new --screenshot`, dark `<body>` bg so corners aren't white, iOS does its own rounding). iOS caches the icon hard → must remove + re-add the home-screen shortcut after deploy to see it. `.bpill:hover` gains a `translateY(-2px)` lift. **Summary cards** ([App.jsx](src/App.jsx)): `stats` derives from a shared `statsBase` (vendor+brand+retailer+search scope, **excluding** statusTab so the four cards stay a meaningful split); Total card sub shows the live scope (`scopeLabel`, e.g. "at Tops"); status cards are clickable filters with an active ring (`toggleStatus`). **Status semantics (user-confirmed): per-retailer.** When a retailer is scoped, the cards AND the card-click `filtered` bucket by the product's status *at* the selected retailer(s) — matching the column dots (A=active, รอขาย/On Process=pending, ยกเลิกขาย=discon), most-active-wins across multiple — via module helper `effStatusFor(p, selectedRetailers)`; with no retailer scope it falls back to global `p.status`. **Clear button** filled accent CTA (`vc-lift`). **NOW line** ([PromoSection.css](src/PromoSection.css)): `.ps-sched-months` given `padding:0 12px 0 6px` to match `.ps-sched-lane`, so the month axis shares the track's box — fixes the line drifting from month labels in 6mo/Full windows. |
| v3.0.0 | Promo Alerts (LINE): `convert_promo.py` emits `public/notification_schedule.json` (16 entries: retailer/period/startDate/activities/brands). Shared `src/promoAlerts.js` (daysUntil/dueToday/upcomingWithin/bangkokToday, +4 node:test tests). Cron Worker `worker/index.js` + `wrangler.jsonc` (main + ASSETS binding + `0 2 * * *` UTC cron) broadcasts LINE alerts 5 and 2 days before activity promos. In-app topbar bell fetches the schedule on mount, badges with count within 5 days, dropdown lists them. Bronze V+star app logo: new `public/favicon.svg` (V+squircle) + `public/icon.svg` (512×512 PWA icon) replace the purple bolt; `<link rel="icon">` added to `index.html`; manifest updated (SVG icon added, dropped maskable). Neon retailer-logo WIP stashed (`git stash`: `neon-logo-wip`) — pop after retailer-logo work resumes. `icon-512.png` unchanged (needs cairosvg for PNG regen). |
| v2.25.1 | Chrome neon-icon pass + mobile light-mode fix. Unicode tab glyphs (⊞/⊡/☰) → line-art SVGs (`IconGrid`/`IconImage`/`IconCalendar` + `IconBarChart`), `.neon-ico` CSS glow on tab icons/hamburgers/dark-toggle, Calc-modal 🧮 → neon SVG; PromoSection `ICO_GLOW` on its inline icons. **Mobile light mode fix:** the app-root aurora used 900px radials + `background-attachment:fixed` — on a narrow phone screen the radials covered the whole viewport and washed the porcelain in a green/coral tint (read as "dim", not light). On mobile the root now uses the solid `t.bg` + `scroll` attachment; desktop aurora unchanged. **Note:** the in-progress neon retailer-logo redesign (per-retailer `public/retailers/neon/*.png`, dark-plate `RetailerLogo`) is intentionally **held out of this commit** — still local WIP |
| v2.22.2 | Packshot export UI redesign + dead-config cleanup. Export resolution control (`ProductPopup` `imagePanel`, App.jsx) replaced the fixed Orig/800/1200/2000 chips with: **Original** button + **custom W×H** number inputs + **800²/1200²/2000²** square presets (presets fill the W/H boxes). State `dlMaxPx` → `dlW`/`dlH`. `downloadAs` now fits the image (contain, centered, undistorted) into an arbitrary W×H box; original = native; one empty side mirrors the other (square). New direct-download shortcut: source already in the requested format at original size → no canvas re-encode, hand back the file (PNG case shows a "already PNG" alert; also covers webp→webp). Repo cleanup (ponytail audit): deleted dead Tailwind/PostCSS configs (`tailwind.config.js` ×2, `postcss.config.js`, `src/postcss.config.js`) + empty `src/index.css` & its import; dropped unused `xlsx` + direct `postcss` devDeps |
| v2.22.1 | Packshot export square fix: the px resolution buttons set canvas width only, so a non-square source exported as N×(source-aspect) (e.g. 1200→1200×2000). `downloadAs` now builds a square N×N canvas and scales the image to fit inside it (contain), centered. Superseded by the v2.22.2 W×H redesign |
| v2.22.0 | "Real glass" treatment + dark-toggle icon + bundled v2.21.2/v2.21.1 follow-ups. `glassPanel` (App.jsx) reworked so panels actually refract instead of reading as flat tinted cards: panel fill dropped to ~.40–.42 alpha, frost bumped to `blur(24px) saturate(1.8)`, light rim via `inset 1px 1px 0` highlight + hairline border, layered ambient+contact shadows, faint top specular sheen (leading `linear-gradient` background layer); app-root aurora nudged ~40% stronger so the glass has something to bend. Propagates everywhere `glassPanel` is spread (Products/Analytics/sidebar/topbar/modals/Packshot + PromoSection via props). Dark-mode toggle 🌙/☀ emoji replaced with inline stroke-SVG sun/moon icons (aria-labeled) to match the SVG icon language. A short-lived A/B palette compare toggle (Lumina/Clasy) was built then removed — current porcelain/dark hues kept (palette intentionally unchanged). Also folds in v2.21.2 (Villa date font 9→10.5px, customer selector + packshot filter logos re-enlarged after the uniform-box fix). PromoSection `.ps-*` neon chips left as-is — retune later only if they clash |
| v2.21.0 | Mobile bug fixes + global glass + universal motion. Schedule (Timeline) fix: sticky product lead raised to `z-index:3` (+right shadow) so absolutely-positioned Gantt price pills can never obstruct product names; `.ps-sched-bar` gets `min-width:40px` (46 mobile) and the price text now always renders so pills stay identifiable in Full view; price chips/pills get `white-space:nowrap` + larger mobile min-widths. Spotlight "Ended" readability: `FeedCard` `ended` variant uses a more opaque card + full-contrast price/RSP text, darker bronze period header in light mode. PIN autofocus disabled on mobile (`autoFocus={!isMobile}`) on the Product Info + Compensate Calc modals so the keyboard doesn't auto-pop. Global glass: dark-mode aurora added to the app root (so glass refracts on every page, not just Promo/Analytics), and glass applied to the sidebar, topbar, Product Info modal + Calc modal. Universal motion (`vc-fade` page-transition keyed by `tab`, `vc-rise` staggered entrance, `vc-lift` hover) in the global `<style>`, applied to StatCards + Analytics KPI/bento; all reduced-motion guarded |
| v2.20.0 | Analytics "Mission Control" upgrade + global glass + mobile polish: new bento band (Portfolio Status donut, Channel Share bars, Coverage Leaders rings) + count-up KPIs (`useCountUp`/`CountUp`, module scope, prefers-reduced-motion guarded) + Analytics vendor scope toggle (All/Vcan/Moola, `anaVendor` state scoping the `intel` memo, which now also exports `total`/`totalDiscon`/`aDeg`/`pDeg`). Glass standardized via `glassPanel` spread on Products stat cards/filter cards/table shell + Packshot gallery cards (rows/sticky headers stay opaque). PromoSection mobile CSS overhaul (138px sticky leads, 64px period cells, compact chips/pills/bars, 40px toolbar tap targets). Source design dropped in `src/export-bento/` (prototype, not wired in — ported by hand into inline-style `t` theme) |
| v2.19.2 | Bug fixes + neon bloom: Spotlight/Grid/Schedule product-click crash fixed (`openProduct` resolves master record by barcode — promo items lack `retailers`; popup also guards `product.retailers`), NOW glowline zIndex 0 + opaque bar backgrounds (no bleed-through), packshot cache-busting `?v=GENERATED_AT`, "Planning Date" neon header, chart bloom (dark tracks `rgba(0,0,0,.45)` + layered glows) |
| v2.19.1 | Refinements: light-mode deep-neon contrast (`neon()`/`NEON_DEEP`), `.ps-glow` hover/active neon system, SVG icons replace emoji, Gantt bar text centered, solid neon NOW glowline, labeled Plan-period header, Spotlight status tiles (replace stat strip + pill tabs) |
| v2.19.0 | Porcelain glass redesign: app-wide warm-cream light theme + aurora glows, glassmorphism panels (Promotion Plan + Analytics), neon activity palette (media cyan / looks fuchsia / clearance coral), gold price pill → ice-silver glass, bronze chrome. Spec: docs/superpowers/specs/2026-06-12-porcelain-glass-redesign-design.md |
| v2.18.0 | Grid glowline removed (clean current-period highlight); Schedule/Spotlight remount+scroll bug fixed, pill-bar Gantt redesign, Spotlight stat strip; Analytics neon graph upgrade + Brand Portfolio chart |
| v2.14.0 | Fix NOW glow line (useLayoutEffect pixel measurement); Timeline redesigned as Gantt/swimlane (month-only axis, colored bars, brand strips) |
| v2.13.0 | Promotion Plan launched: PromoSection.jsx extracted component, Calendar + Timeline views, hover discount tooltip (−%), activity ribbon, customer logo pills |
| v2.12.x | Timeline NOW glow line continuity fixes (multiple attempts before v2.14 pixel approach) |
