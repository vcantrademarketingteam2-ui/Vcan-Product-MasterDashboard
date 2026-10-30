# Promotion Plan Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Promotion Plan tab's Grid + Calendar Pulse views with a per-store Plan table (Year · Quarter · Month · Period selector, detail panel) and a cross-store Product view; keep Spotlight.

**Architecture:** All date/period/selector/product-row logic moves into a new pure module `src/promoPlan.js` (no React, `today` injected) with `node:test` coverage. `src/PromoSection.jsx` keeps the UI as plain function calls (`PlanView()`, `ProductView()`, `DetailPanel()` — never `<PlanView/>`, v2.18.0 remount rule) and imports the pure helpers. Old views are deleted last.

**Tech Stack:** React 19 + Vite 8, inline styles via the `t` theme object, ESLint, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-30-promo-plan-table-lookup-design.md` (read it first; it is the source of truth). Behaviour reference only (throwaway, uncommitted): spike worktree `D:\Project Vcan Dashboard\vcan-dashboard\.claude\worktrees\agent-a72c03888a923125e\src\PromoSection.jsx` — read it, do not copy it wholesale.

## Global Constraints

- Work only in this worktree on branch `feat/promo-plan-redesign`. Never push; never touch the main checkout (the 9:00 `update_dashboard.bat` runs there).
- CLAUDE.md rule 2: before editing in each task, copy the files you will change into `backups/<YYYYMMDD_HHmmss>/` (git-ignored).
- CLAUDE.md rule 1: version → `3.15.0` in `package.json`, both `package-lock.json` version fields, and the `src/App.jsx` header badge — done in Task 8 (branch commits are not shipped before then).
- No new dependencies. No changes to `convert_promo.py`, `promo_data.js`, `deptPins.js`, Spotlight internals, `CalcModal`, LINE alerts.
- Cost/GP/compensate render ONLY when `unlocked && canSeeRetailer(unlocked, <that row's retailer>)`; values come from data (`pd.compensate`, item `gp`) — no client recomputation.
- Colours: route activity colours through `neon()`; NOW markers use `nowLine` (bronze `t.accent`), never green. Selector signals: solid `GOLD_GRAD` fill = the single pick; soft `${GOLD_A}22` tint + bold = in-range periods; 4px bronze dot = contains today; existing NOW tag = live period. No borders on individual selector chips (grey segment boxes instead).
- Mobile (`isMobile`): touch targets ≥ 40px; product column 112px, period columns min 104px; detail panel = bottom sheet (`borderRadius: '16px 16px 0 0'`, `maxHeight: '95dvh'`).
- Run all tests with `node --test test/`; lint with `npm run lint`; build with `npm run build`.

## Review Focus

1. Switching store while a cell from another store is selected → panel closes, no stale panel (Task 6 test via `selFor` guard).
2. `Sales (Regional)` PIN in Product view → Tops/Villa/TWD/Boots rows show no GP/compensate while Foodland/Homepro rows do (Task 7 browser check, Task 4 has no money logic).
3. Barcode carried by several stores under different promo names → one Product view, master name in header (Task 4 test `productRows uses barcode identity`).
4. Label-only promo (BOGO, `salePrice: null`, `compensate: null`) → shown everywhere, never ranked best, panel says "No unit compensate (mechanic promo)" (Task 4 test + Task 6 check).
5. Store whose periods are all undated or all past (Watsons / Big C) → selector still usable (Undated chip / last dated month), stale note only for Big C (Task 3 tests).

---

### Task 1: Date parsing module with the spike's fixes

**Files:**
- Create: `src/promoPlan.js`
- Create: `test/promoPlan.test.mjs`
- Modify: `src/PromoSection.jsx:62-147` (remove local `parseDR`, `MONTH_NAMES`, `inferPeriodDate`; import them)

**Interfaces:**
- Produces (all exported from `src/promoPlan.js`):
  - `MONTH_NAMES: string[]` (`'Jan'..'Dec'`)
  - `parseDR(dr: string, today = new Date()): {s: Date, e: Date} | null`
  - `inferPeriodDate(p: {name: string}, today = new Date()): {s, e} | null`
  - `dayDiff(a: Date, b: Date): number` — whole calendar days b − a
  - `periodRange(p: {name, dateRange}, today = new Date()): {s, e} | null` — `parseDR(p.dateRange) || inferPeriodDate(p)`, then `null` when `dayDiff(s, e) > 62`
  - `periodStatus(r, today = new Date()): 'past' | 'now' | 'future' | 'unknown'`

- [ ] **Step 1: Write failing tests** in `test/promoPlan.test.mjs` (`import test from 'node:test'`, `assert from 'node:assert/strict'`), with `const T = new Date(2026, 9, 30)` and a helper `ymd = d => [d.getFullYear(), d.getMonth() + 1, d.getDate()]`:
  - `parseDR puts the written year on the END date`: `parseDR('23/12-5/01/27', T)` → s `[2026,12,23]`, e `[2027,1,5]`.
  - `parseDR no-year range crossing new year`: `parseDR('27/12-9/01', T)` → s `[2026,12,27]`, e `[2027,1,9]`.
  - `parseDR allows spaces around the dash`: `'26/06 - 30/07/26'` → `[2026,6,26]`..`[2026,7,30]`.
  - `parseDR existing formats unchanged`: `'29.10.26 - 25.11.26'` (Villa), `'22/10/26 - 18/11/26'` (Watsons), `'1-31/10/2569'` (Foodland → 2026-10-01..2026-10-31).
  - `periodRange 62-day guard counts whole days`: `{dateRange:'26/03-27/05/26'}` (Boots SP6, 62 days) → not null; `{dateRange:'23/12/25-5/01/27'}` (Watsons 2701/02) → null.
  - `periodRange falls back to the name`: `{name:'Oct', dateRange:''}` → `[2026,10,1]..[2026,10,31]`; `{name:'2603/04', dateRange:''}` → null.
  - `periodStatus`: range containing T → `'now'`; ended before → `'past'`; starts after → `'future'`; `null` → `'unknown'`.

- [ ] **Step 2: Run** `node --test test/` — expected: promoPlan tests FAIL (module not found); promoAlerts/workerAlerts still pass.

- [ ] **Step 3: Implement `src/promoPlan.js`.** Move `parseDR`/`inferPeriodDate`/`MONTH_NAMES` from `PromoSection.jsx` unchanged except: (a) every use of module `TODAY` becomes the `today` param; (b) in the `d/m-d/m(/yy)` branch accept `\s*[–-]\s*` and, when `e < s`: if a year was written move **s** back one year, else move **e** forward one year; (c) add `dayDiff`, `periodRange`, `periodStatus` per the Interfaces block (end-of-day `e` stays `23:59:59.999`).

- [ ] **Step 4: Wire PromoSection** — delete the moved definitions, `import { MONTH_NAMES, parseDR, inferPeriodDate, dayDiff, periodRange, periodStatus } from './promoPlan.js'`. Existing callers (`periodIsCurrent`, Calendar, Pulse, Spotlight) keep calling `parseDR(x)` / `inferPeriodDate(p)` with the default `today`.

- [ ] **Step 5: Verify** — `node --test test/` all PASS; `npm run lint` and `npm run build` green.

- [ ] **Step 6: Commit** — `git add src/promoPlan.js test/promoPlan.test.mjs src/PromoSection.jsx` → `fix: promo date parsing — year belongs to end date, spaced dashes, 62-day guard (promoPlan.js)`.

### Task 2: Per-store plan columns

**Files:** Modify `src/promoPlan.js`, `test/promoPlan.test.mjs`

**Interfaces:**
- Consumes: Task 1 `periodRange`, `periodStatus`.
- Produces: `buildPlan(periods: {name, dateRange}[], today = new Date()): { cols: Col[], hasNow, hasFuture, hasUnknown }` where `Col = { name, idx /* source index */, r /* {s,e}|null */, status }`. Order: stable sort by `r.s`; if ANY period is undated keep source order.

- [ ] **Step 1: Failing tests** (`T` as before):
  - `buildPlan sorts by start date`: TWD-like input `[{name:'Oct',dateRange:'1-31/10/26'},{name:'Bro.10',dateRange:'25/09 -29/10/26'},{name:'Bro.11',dateRange:'30/10- 26/11/26'},{name:'Nov',dateRange:'1-30/11/26'}]` → names `['Bro.10','Oct','Bro.11','Nov']`; statuses of Oct and Bro.11 both `'now'`; `hasNow === true`.
  - `buildPlan keeps source order when any period is undated`: `[{name:'2647/48',dateRange:'22/10/26 - 18/11/26'},{name:'2603/04',dateRange:''}]` → names unchanged, second `status 'unknown'`, `hasUnknown === true`.
  - `buildPlan all past`: two 2023 ranges → `hasNow false, hasFuture false, hasUnknown false`.

- [ ] **Step 2: Run** `node --test test/` → new tests FAIL.
- [ ] **Step 3: Implement `buildPlan`.**
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat: buildPlan period ordering for the plan table`.

### Task 3: Period selector logic

**Files:** Modify `src/promoPlan.js`, `test/promoPlan.test.mjs`

**Interfaces:**
- Consumes: Task 2 `Col`.
- Produces:
  - `type Pick = { lvl: 'q'|'m'|'p'|'u', y?: number, q?: number /*0-3*/, m?: number /*0-11*/, name?: string }`
  - `quarterSpan(y, q): [Date, Date]`, `monthSpan(y, m): [Date, Date]` (end = last day 23:59:59.999)
  - `colsInSpan(cols, span): Col[]` — dated cols overlapping the span
  - `defaultPick(cols, today = new Date()): Pick | null` — month of today if any col is `'now'`; else month of first `'future'` col's start; else month of last dated col's start; else `{lvl:'u'}` if undated cols exist; else `null`
  - `colsForPick(cols, pick): Col[]` — `q`/`m` → `colsInSpan`; `p` → the named col; `u` → undated cols; `null` → `[]`
  - `pickLabel(pick): string` — `'Q4 2026'`, `'Oct 2026'`, `'2647/48 (Nov 2026)'`, `'Undated periods'`, `'No periods'`
  - `pickYears(cols): number[]` — sorted distinct start/end years of dated cols

- [ ] **Step 1: Failing tests** using a Tops-like fixture (`'30/09-13/10/26'` 2641/42, `'14/10-27/10/26'` 2643/44, `'28/10-10/11/26'` 2645/46, `'11/11-24/11/26'` 2647/48, `'23/12-5/01/27'` 2701/02):
  - `defaultPick is today's month when something is live` → `{lvl:'m', y:2026, q:3, m:9}`.
  - `colsForPick month` Oct → `['2641/42','2643/44','2645/46']`; quarter Q4 2026 → all five; `{lvl:'p',name:'2647/48'}` → one col.
  - `defaultPick all past` (Big C 2023 fixture) → month of the last dated col.
  - `defaultPick all undated` → `{lvl:'u'}`; empty cols → `null`.
  - `pickLabel` for each `lvl`; `pickYears` on Tops fixture → `[2026, 2027]`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat: period selector logic (quarter/month/period picks)`.

### Task 4: Product-across-stores rows

**Files:** Modify `src/promoPlan.js`, `test/promoPlan.test.mjs`

**Interfaces:**
- Consumes: Task 2 `buildPlan` output per retailer.
- Produces:
  - `productRows(barcode: string, itemsByRetailer: {[r]: Item[]}, plans: {[r]: Plan}, retailers: string[]): { rows: Row[], notIn: string[] }` where `Item` is an enriched promo item (`barcode`, `periods[name] → pd`), `Row = { retailer, item, now: {col, pd}|null, nowCol: Col|null, moreLive: number, next: {col, pd}|null, nextCol: Col|null, upcoming: {col, pd}|null }`.
    - `now` = live col with a promo for this item, ending soonest; `nowCol` = that col, or the first live col if none has a promo; `moreLive` = other live cols with a promo.
    - `nextCol` = first col (plan order) with status `'future'`; `next` = its promo if any.
    - `upcoming` = first col after `nextCol` (plan order) with a promo and status ≠ `'past'` (undated allowed).
  - `bestNow(rows): { retailer, price, col } | null` — lowest `pd.salePrice` among `row.now` entries with numeric `salePrice`; label-only ignored.

- [ ] **Step 1: Failing tests** (two-store fixture, T as before):
  - `productRows uses barcode identity`: same barcode, different `product` names in two stores → 2 rows, `notIn` lists the third retailer.
  - `now picks the live promo ending soonest`: TWD-like plan, promo in both `Oct` and `Bro.11` → `now.col.name === 'Oct'`, `moreLive === 1`.
  - `bestNow ignores label-only promos`: store A `salePrice 89`, store B `salePrice null, saleLabel '1 แถม 1'` → `{retailer:'A', price:89}`; both label-only → `null`.
  - `upcoming skips past periods`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat: productRows/bestNow for the cross-store product view`.

### Task 5: Toolbar, global data, search

**Files:** Modify `src/PromoSection.jsx` (state block ~172-230, render ~928-1045)

**Interfaces:**
- Consumes: Tasks 2 (`buildPlan`), 1.
- Produces (component scope, used by Tasks 6-7): state `mode: 'plan'|'spot'` (default `'plan'`), `view: 'store'|'product'`, `pb: string|null` (product barcode), `q: string`, `pick: Pick|null`, `sel: {retailer, barcode, name}|null`, `hideEmpty: boolean` (default `true`), `collapsed: {[retailer|brand]: boolean}`; memos `allEnriched` (= `enrich(promoData, rawData)` once), `itemsByRetailer`, `plans` (= `buildPlan(PROMO_META[r]?.periods || [])` per `CUSTOMERS` entry), `productIndex: Map<barcode, {name, brand, hay, stores}>` (`name` = master `rawData` product name, fallback first promo name; `hay` = lowercased names from every store + enriched brand + barcode); helpers `openProductView(barcode)`, `openStorePlan(retailer, barcode, liveColName|null)`, `pickStore(retailer)` (resets `pick`, `sel`, brand filter, `view='store'`).

- [ ] **Step 1:** Backup, then replace the Timeline/Grid + Calendar/Spotlight toggles and the activity legend with ONE toolbar row: `Plan | Spotlight` segmented switch · search input (`placeholder="Search product, brand or barcode"`, 16px font on mobile) · existing Compensate Calc button · existing PIN form. Store pills above, `BrandCategoryFilter` below — both unchanged.
- [ ] **Step 2:** Search dropdown: ≥ 2 chars, matches `productIndex.hay`, max 8, row = `<name> — <brand> · in N store(s)`; pick → `openProductView`. While on Plan view the query also filters the table rows. Close on blur/Escape.
- [ ] **Step 3:** Render: `mode === 'spot'` → existing `Spotlight()`; else `view === 'product' ? ProductView() : PlanView()` (stubs returning `null` until Tasks 6-7). Old `Calendar()`/`CalendarPulse()` stay defined but unrendered (deleted in Task 8).
- [ ] **Step 4: Verify** — `npm run lint` + `npm run build` green; `npm run dev`, Promotion Plan tab: one toolbar row, search shows Vnew suggestions for "vnew", Spotlight still renders.
- [ ] **Step 5: Commit** — `feat: promo toolbar — Plan|Spotlight switch, product search, global enrich`.

### Task 6: Plan view — selector, table, detail panel

**Files:** Modify `src/PromoSection.jsx` (add `PlanView()`, `PeriodSelector()`, `PlanCell()`, `DetailPanel()` as plain functions)

**Interfaces:**
- Consumes: Task 3 (`defaultPick`, `colsForPick`, `quarterSpan`, `monthSpan`, `colsInSpan`, `pickLabel`, `pickYears`), Task 5 state.
- Produces: `PlanView()`; `DetailPanel()` reused by nothing else.

- [ ] **Step 1: Selector** exactly per spec "Period selector" (desktop one row: year segment only when `pickYears(cols).length > 1` · four quarter segments each `Qn + 3 months` · `Undated (N)` when undated cols exist · always-reserved `Back to now` link (visibility hidden at default) · `| PERIOD` static strip of ALL cols, `flexWrap: 'nowrap'`, `overflowX: 'auto'`, tints in-range). Strip details (proven in the spike): class `ps-strip` in `PromoSection.css` hides the scrollbar (`scrollbar-width:none` + `::-webkit-scrollbar{display:none}`) and fades only hidden edges via `mask-image` driven by `data-l`/`data-r` set from a scroll listener + `ResizeObserver`; native `wheel` listener `{ passive: false }` maps vertical wheel to `scrollLeft`; the strip element gets `key={retailer + JSON.stringify(pk)}` and its ref callback (once per mount, `requestAnimationFrame` + a 120 ms retry) scrolls the `[data-first]` chip into view with `behavior: 'instant'`. (A ref on the chip itself did NOT re-fire on pick changes in testing — use the keyed strip.) Phone: stacked QUARTER / MONTH / PERIOD rows. Disabled (opacity .3) quarters/months with zero cols. `pk = pick || defaultPick(cols)`; `win = colsForPick(cols, pk)`; changing pick clears `sel`.
- [ ] **Step 2: Summary row**: `pickLabel(pk) · N period(s)`, hide-empty checkbox, "X of Y SKUs · N hidden (no promo in view)" (count shown once, in this row only). Stale note when `!hasNow && !hasFuture && !hasUnknown && cols.length`.
- [ ] **Step 3: Table** per spec Plan view: CSS grid `leadW` 250 / 112 mobile, cols `minmax(150|104px, 1fr)`, sticky header + sticky product column, brand bands (MonogramTile, count, ▾/▸ per `retailer|brand`), product sub-line (RSP, GP% if `canSee(retailer)`, เคลียร์สินค้า, `ยกเลิกขาย from <period>`), header = raw `col.name` + short dates + NOW tag + bronze 2px underline for every live col, cell = price or saleLabel, `−N%` via `offPctOf`, text tags (ลงพื้นที่ / ลงสื่อ / LOOKS / K.Village). Cell click → `sel`; selected ring `GOLD_A`.
- [ ] **Step 4: DetailPanel** per spec (right panel desktop, bottom sheet mobile): status line `Live · ends in N days` / `Starts in N days` / `Ended` / `No dates` via `dayDiff`; Compensate + GP when `canSee(retailer)`, else `Unlock with PIN to see compensate / GP` (or `Not available for your department` when unlocked but denied); `compensate == null` → `No unit compensate (mechanic promo)`; "Later at this store" next 3 promos in plan order; `See across all stores →`. Render only when `sel?.retailer === retailer` and the cell still exists (Review Focus 1).
- [ ] **Step 5: Verify** (dev server, Chrome, desktop + 390px, dark + light): Tops opens on `Oct 2026 · 3 periods`; Q4 → 7 cols; Mar → its cols; one period → 1 col; Back to now; **measure the period strip's x/width/height before and after Q4, Mar, a period and Back to now — must be identical**; the strip shows no scrollbar and Q1 / Q3 / Dec / Back to now / switching to TWD each bring their first in-range chip into view; mouse wheel over the strip scrolls it sideways without scrolling the page; TWD shows two NOW columns; Big C stale note; Watsons `Undated (1)`; 2701/02 reads `23 Dec – 5 Jan 2027`; switch store with a cell selected → panel gone; PIN `4343` (Data) shows compensate + GP. `npm run lint` + `npm run build` green.
- [ ] **Step 6: Commit** — `feat: Plan view — period selector, store table, detail panel`.

### Task 7: Product view

**Files:** Modify `src/PromoSection.jsx` (add `ProductView()`)

**Interfaces:** Consumes Task 4 `productRows`, `bestNow`; Task 5 `productIndex`, `openStorePlan`, `onSelect`/`openProduct`.

- [ ] **Step 1:** Header (name, company · brand · barcode, `Product info` → existing `openProduct`, `← Back to <store>`), Best-price card from `bestNow` (`฿X at <store> −N% · until <end>`; empty state `No price promo running right now at any store.`).
- [ ] **Step 2:** One row per `rows[]` (store `RetailerLogo`, RSP, GP if `canSee(row.retailer)`): Now (+`+N more live`), Next period, Upcoming boxes; empty texts `No current period` / `No promo` / `No next period` / `Nothing planned`; compensate per box only if `canSee(row.retailer)`. Row click → `openStorePlan(retailer, barcode, row.now?.col.name)` which sets `pick` to that period's month. Footer `Not in: …`. Mobile → stacked cards.
- [ ] **Step 3: Verify**: search "vnew" → Vnew Liquid Black & Dark 1.5L → best price card + rows; Tops row → Tops plan with live cell selected; PIN `2001` (Sales Regional) → no GP/compensate on Tops/Villa/TWD/Boots rows, visible on Foodland/Homepro rows; mobile cards. Lint + build green.
- [ ] **Step 4: Commit** — `feat: Product view — one product across every store`.

### Task 8: Remove old views, version, docs

**Files:** Modify `src/PromoSection.jsx`, `src/PromoSection.css`, `src/App.jsx`, `package.json`, `package-lock.json`, `CLAUDE.md`

- [ ] **Step 1:** Delete `Calendar()`, `CalendarPulse()`, `PulseTrackBg()`, `pulseRange`/`pulseWeeks`/`pulseBarPos`/`fullRange`/`planWindow`, `barTip` + overlay, `layout`/`tlView`, `openKey`/`toggleChip` if unused, `IcoTimeline`/`IcoGrid` if unused, and any memo only they used (grep each before deleting; Spotlight's dependencies stay).
- [ ] **Step 2:** Delete unused `.ps-cal-*`, `.ps-sched-*`, `.ps-pulse-*` (EXCEPT plain `ps-pulse` used by Spotlight's live tile), `.ps-bar`, `.ps-chip` selectors — `grep -n "<class>" src/*.jsx` must return nothing for each one removed.
- [ ] **Step 3:** Version `3.15.0` in `package.json`, both `package-lock.json` version fields, `src/App.jsx` badge. `CLAUDE.md`: PromoSection section → Plan + Spotlight (selector + Product view + `promoPlan.js`), mark the "NOW line technique (v3.11.0 Calendar Pulse)" paragraph as removed in v3.15.0, add the v3.15.0 history row (incl. the 2701/02 year bug fix).
- [ ] **Step 4: Verify**: `node --test test/` PASS, `npm run lint`, `npm run build` green; repeat Task 6 Step 5 + Task 7 Step 3 browser checks once on the final build; `wc -l src/PromoSection.jsx` (if > 1,400, report it — spec says re-check before splitting; do not split without approval).
- [ ] **Step 5: Commit** — `feat: Promotion Plan redesign — Plan table + Product view, retire Grid/Calendar Pulse (v3.15.0)`. Do NOT merge or push; hand back for user review + Opus diff review.
