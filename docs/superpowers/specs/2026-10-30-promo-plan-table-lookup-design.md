# Promotion Plan redesign — Plan table (C) + Product lookup (B)

Date: 2026-10-30 · Status: draft for user approval (period selector approved via spike 2026-10-30) · Target version: v3.15.0 (minor)

## Why

The user said (2026-10-22) the Promotion Plan tab is "too complicated". Evidence from the
2026-10-22 diagnosis: 8 control groups and a 7-item legend sit above the data; views are nested
two deep (Timeline/Grid → Calendar/Spotlight); ~90% of promo cells carry no activity tag
(Tops 738/833), so the colour system mostly decorates nothing; each store runs its own period
system, which a shared time axis (Calendar Pulse) blurs.

Frequent users: the user, their boss, a data analyst. Their real questions are
"what is this store running now / next?" and "what is this product doing across stores?".

Reference: interactive prototype `design-drafts/promo-ideas/project/Prototype.dc.html`
(canvas https://claude.ai/artifact/7k7LwU9sSyuegUW4eDkkhV). The prototype is throwaway; this doc
is the source of truth where they differ.

## Decisions (user)

- Build B + C together; A ("Now board") dropped as it duplicates Spotlight.
- **Replace** the current Grid view and Timeline › Calendar Pulse view. **Keep Spotlight.**

- **Overlapping periods** (TWD monthly + "Bro." periods; Foodland short deals inside months):
  columns are **sorted by start date** (stable sort; a store with any undated period keeps
  its source order instead — Watsons), and
  **every** live period gets the NOW tag/tint. Default window anchors at the first live period.
  Product view "Now" = the live period with a promo for that product (if several, the one
  ending soonest; others listed as "+N more live"); "Next" = first period starting after today.

## Goals

1. **Plan view (C)** — one table per store, columns = that store's own periods.
2. **Product view (B)** — one product across every store, reached by search or by clicking a
   product name.
3. Fewer controls above the data than today.

## Non-goals

- No changes to `convert_promo.py`, `promo_data.js` or the data shape.
- No change to Spotlight's internals (only how you switch to it).
- No change to the Compensate Calc modal, PIN logic (`deptPins.js`), or LINE alerts.
- No new dependencies.

## Anti-goals (would be a failure even if it "works")

- Showing cost/GP/compensate without a valid PIN for that retailer (`canSeeRetailer`).
- Bringing back a shared calendar/time axis or pixel-measured NOW lines.
- More toolbar rows than today.

## Layout (desktop)

Top to bottom inside the tab:

1. **Store pills** — existing customer logo pills (unchanged, `RetailerLogo`).
2. **One toolbar row**: view switch `Plan | Spotlight` · global product search box ·
   Compensate Calc button · PIN unlock (both unchanged, moved into this row).
3. **Brand filter** — existing shared `BrandCategoryFilter` (`idPrefix="ps-promo"`), unchanged.
4. **Main card**: header (store name, "N of M SKUs", hidden count, "Planning Date") then the
   active view.

The activity legend row is removed; activities appear as **text tags** inside cells
(ลงพื้นที่ / ลงสื่อ / LOOKS / K.Village), colours via the existing `neon()` helper.

## Plan view (C)

- **Columns**: every period of the selected store that overlaps the **range picked in the
  period selector** (below), in display order. Period dates use the existing `parseDR` /
  `inferPeriodDate` helpers (with the fixes under "Date parsing") — no new date parser.
- **Period selector** (replaces the ‹ › stepper — user rejected left/right stepping,
  2026-10-30). One bar under the card header; picks ONE of quarter, month or single period:
  - **Desktop — one row** (redesigned 2026-11-03; the sideways-scrolling period strip is gone, users
    didn't realise it scrolled): `[year segment] [Q1 Jan Feb Mar] [Q2 …] [Q3 …] [Q4 …] [Period dropdown]`.
    All 12 months are always visible. Year chips show for every store with dated periods.
  - **Phone — stacked rows**: QUARTER (year chips + Q1–Q4), MONTH (three months of the selected
    quarter), PERIOD (dropdown, full width).
  - **Quarter** → columns = all periods overlapping that quarter. **Month** → all periods
    overlapping that month. **Period** → just that period.
  - Quarters/months with no periods are disabled (dimmed).
  - **Period dropdown**: a native select laid invisibly over a fixed-width label. The list holds every
    period of the store grouped by start quarter, with dates and NOW; undated periods sit in an
    "Undated" group led by "All undated (N)". The first option follows the pick ("All 7 periods",
    or "All in Q4 2026" from a single period, which returns to that quarter).
  - **"Back to now"** sits beside the summary line, with its slot always reserved.
  - **Colour signals — one meaning each**: soft bronze tint + thin outline = the one thing picked
    (softened 2026-11-03, solid bronze read too bright); small bronze dot under a quarter/month =
    contains today; NOW tag = live period. Year segment uses a neutral grey "on" state unless the
    full year itself is picked.
  - **Full year** (own labelled button since 2026-11-03, users didn't find it on the year chip): shows
    every period of the selected year. Year chips only switch year: they keep a full-year view,
    otherwise go to that year's first quarter with periods.
  - **Default** on tab open / store change = the current quarter for every store with any dated period,
    even when that quarter is empty (Big C, 2023 dates only; user's call 2026-11-03), else Undated.
  - A summary line above the table reads "Oct 2026 · 3 periods" / "Q4 2026 · 7 periods" /
    "2647/48 (Nov 2026) · 1 period". Changing the pick clears the selected cell.
  - A quarter can be 7+ columns (Tops Q4): the table scrolls horizontally (sticky product
    column), as it does today.
- **Column header**: raw period code (not `periodLabel()`, which turns Foodland's
  `30/10-10/11/2569` into "Nov"), date range in short form (e.g. "1 – 14 Oct"); every live
  period gets the existing NOW tag, tinted column, and a **bronze** underline (`nowLine` /
  `t.accent`) — **not green** (user, 2026-10-30).
- **Rows**: grouped by brand with a collapsible brand band (MonogramTile + name + SKU count,
  caret ▾/▸). Collapse state is per store+brand.
- **Product cell (sticky left)**: master product name (same as Product view/search; click →
  Product view), sub-line
  `RSP ฿x` · GP% (PIN only, as today) · เคลียร์สินค้า tag · "ยกเลิกขาย from <period>" when
  `disconFrom` is set.
- **Promo cell**: price (or sale label for mechanic promos, e.g. "1 แถม 1"), discount
  `−N%` via existing `offPctOf`, activity text tags. Empty = blank. Click selects the cell
  (bronze ring) and opens the detail panel.
- **Empty rows always hidden** (toggle removed 2026-11-02 at user's request): hides SKUs with no promo in the visible window;
  header shows "· N hidden (no promo in view)".
- **Stale-plan note**: if every period of a store is dated AND in the past (Big C; not
  Watsons, which has undated periods), show one line:
  "Every period in this plan is in the past — the source sheet still carries old dates."
- Watsons now has real data (in `PROMO_RETAILERS`), so it gets a normal Plan table; the
  `comingSoon` branch stays only as a guard for a store with no data.

## Date parsing fixes (found in the spike)

- **Year belongs to the END date** in `d/m-d/m/yy`: `23/12-5/01/27` (Tops 2701/02) currently
  parses as 23 Dec 2027 – 5 Jan 2028 in the live app (bug on `main`). When a year is written
  and end < start, move the START back a year; only when no year is written move the end
  forward.
- Allow spaces around the dash in the no-year format (`26/06 - 30/07/26`, TWD Bro7), or TWD
  falls back to source order.
- 62-day typo guard compares whole days (`dayDiff > 62`), not raw milliseconds — otherwise
  Boots SP6 (`26/03-27/05/26`) is wrongly undated.
- Spotlight still uses `periodIsCurrent` (no guard); leave it unless it misbehaves.

## Promo detail panel

Right-side panel on desktop (table narrows), bottom sheet on mobile. Contents:

- Brand · store, product name, big price/label, RSP, `−N%`.
- Period code + dates + status line: "Live · ends in N days" / "Starts in N days" / "Ended".
- Activity tags (or "No activity tag").
- **Compensate & GP**: shown only when `canSeeGP` — uses the existing `pd.compensate` and
  item GP from the data (no client-side recomputation; the prototype's `vatDiv` formula is
  NOT used). Locked state shows "Unlock with PIN to see compensate / GP".
- "Later at this store": next up to 3 periods with a promo for this product.
- Buttons: "See across all stores" (→ Product view), close.

## Product view (B)

- Entry: product-name click in Plan view, or picking a search suggestion.
- Search: matches product name, brand, or barcode, min 2 chars, across **all** stores;
  up to 8 suggestions, each "<product> — <brand> · in N stores".
- Header: product name, company · brand · barcode, a "Back to <store>" link, and a
  "Product info" button that opens the existing master `ProductPopup` via `onSelect`
  (preserves today's name-click behaviour).
- "Best price now": lowest current unit price across stores + store + "until <date>".
- **One row per store** carrying the product: store logo, RSP, **Now**, **Next**,
  **Upcoming** (first later non-past period with a promo). Each box shows price/label,
  `−N%`, period code + dates, tags; "No promo" / "No current period" / "Nothing planned"
  when empty. GP/compensate per row only when PIN-unlocked for that retailer.
- Clicking a row → Plan view for that store, window at now, current cell selected if any.
- Footer: "Not in: <stores>".

## Mobile (`isMobile`)

- Period selector stacks into rows (see Plan view); sticky product column 112px, period
  columns min 104px so two columns fit a 390px screen without clipping.
- Detail panel = bottom sheet (`borderRadius: 16px 16px 0 0`, `maxHeight: 95dvh`), like the popup.
- Product view: store rows become stacked cards (Now / Next / Upcoming stacked).
- Touch targets ≥ 40px (window arrows, toggle, collapse carets, cells).

## Code removal

Delete from `PromoSection.jsx`: `Calendar()`, `CalendarPulse()`, `PulseTrackBg()`, the
`pulseRange`/`pulseWeeks`/`pulseBarPos`/`fullRange`/`planWindow` memos and state, `barTip`
and its overlay, `layout`/`tlView` state and the Timeline/Grid toggles, `openKey`/`toggleChip`
if unused. Delete now-unused `.ps-cal-*` / `.ps-sched-*` / `.ps-pulse-*` / `.ps-bar` CSS
(check each selector is unused before removing; Spotlight's classes stay — notably the plain
`ps-pulse` class on Spotlight's live tile must survive).
Update `CLAUDE.md`: PromoSection section (two views → Plan + Spotlight; "NOW line technique"
paragraph marked historical/removed) and add the v3.15.0 history row.

## Builder's calls (not user-decided; change if wrong)

- Brand filter keeps the shared `BrandCategoryFilter` (multi-select) instead of the
  prototype's single `<select>` — consistency with Products/Packshot.
- **Undated periods** (most Watsons periods have an empty `dateRange` and names like
  `2603/04`): status "unknown", kept in source order, no NOW/countdown; the default-window
  anchor uses dated periods only. **Typo guard:** a parsed range longer than 62 days is treated
  as undated (Watsons `2701/02` reads `23/12/25-5/01/27`, which would otherwise be "current"
  for a year).
- **Best price now** ranks unit-price promos only; label-only promos (BOGO, "2 for 699",
  ~33% of cells, `salePrice: null`) are shown in their store row but not ranked.
- **Product identity** = barcode. Header and search suggestions use the master `rawData`
  product name, falling back to the first store's promo name (68 of 133 barcodes are named
  differently per store). Search matches every store's name, the enriched brand (raw promo
  `brand` is often empty — use `enrich()`'s), and barcode.
- Compensate/GP panel needs an empty state even when unlocked: `compensate` is `null` for
  label-only promos ("No unit compensate — mechanic promo").
- New view code lives in `PromoSection.jsx` as plain function calls (`PlanView()`,
  `ProductView()`) — the remount rule from v2.18.0 still applies. Split to a new file only if
  `PromoSection.jsx` would exceed ~1,400 lines — the spike (old views still in place) reached
  ~1,750, so once Grid/Calendar Pulse are deleted re-check before deciding.
- Spike reference (throwaway, uncommitted): worktree `.claude/worktrees/agent-a72c03888a923125e`
  — behaviour reference for the real build, not code to merge as-is.
- Default view on tab open = Plan.

## Verification

- `npm run build` and `npm run lint` green.
- Browser check (desktop 1440px + mobile 390px, dark + light): Tops opens on the month containing today
  (its periods, the current one marked NOW, bronze underline); Q4 → 7 periods, Mar → Mar's periods, a single
  period → 1 column, Back to now → default; **period strip position/width/height identical
  across all picks** (measured); 2701/02 reads 23 Dec – 5 Jan 2027; hide-empty count; collapse a brand; select a cell →
  panel; PIN locked vs unlocked (compensate/GP appear only when unlocked for that retailer);
  search "vnew" → suggestion → Product view → row click returns to that store; Big C shows
  the stale-plan note; Watsons shows `Undated (N)` from real data (22 as of 2026-11-02); TWD/Foodland overlapping
periods render per the rule above; Spotlight still works.
- Compare against `Prototype.dc.html` behaviour; list deviations.
