# Products one-stop page + transparent PNG export (v3.17.0)

Status: approved by the user on 2026-11-13 after five mockup rounds. Target version **v3.17.0**.

Visual reference (the approved mockup, proposal C): open
`D:\Project Vcan Dashboard\vcan-dashboard\design-drafts\mainpage-overhaul\artifact\index.html#c`
in a browser (`#c-light`, `#c-phone`, `#c-table`, `#c-open` for other states). Its source is
`design-drafts/mainpage-overhaul/mockup.src.html` in the main checkout (git-excluded, so it is NOT in
this worktree): `viewC()`, `pmodal()`, `listedAt()`, `tlogo()` and the `.doors` / `.tile` / `.btl` /
`.bcat` / `.pcard` / `.la` / `.stb` / `.tlg` CSS rules are the layout to port. The mockup is vanilla
JS with CSS classes; the app uses React inline styles driven by the `t` theme object. Port the look,
not the code.

## Why

The Products tab stacks four stat cards, a search card, a customer card and a brand card above the
table, splits filters between the sidebar and the page, and shows 14 dot columns that are mostly empty.
The Packshot tab is the same list with the same filters and a different popup. The user wants one
page that is easier to use and looks modern: every filter in one place, results beside them, no
second page.

Separately, the user reported that PNG packshot downloads are not transparent. Cause: 139 of 202
front packshots are stored without an alpha channel (they came in as JPG on white).

## Goals

1. Products and Packshot become one page. Navigation has three entries: Products, Analytics,
   Promotion Plan.
2. Every product filter lives in a left filter panel on the Products page and filters the list in
   place: Status, Customer, Brand (with the Vcan / Moola switch).
3. The list shows as packshot cards (default) or as a table.
4. One product popup for every entry point, photo-forward on desktop.
5. PNG downloads of white-background packshots get a transparent background.

## Non-goals

- No change to Analytics or Promotion Plan content (PromoSection keeps receiving the same props,
  including `BrandCategoryFilter`, which must stay defined).
- No change to data files, parsers, the update pipeline, the worker, or `src/promoPlan.js`.
- No new dependency.
- No redesign of the popup's internals (pricing/PIN, promo tab, zoom, export size picker all stay).
- No "Missing photo" filter. The user removed it from the mockup; do not add it.
- No thumbnail pipeline. Cards and table rows use the existing packshot files with lazy loading.

## Anti-goals (these make it a failure even if it works)

- A coloured multi-bar strip to show store coverage. The user found it confusing. Coverage is shown
  with store logos and plain words.
- Controls that change size or reflow when clicked; sideways scrolling inside the filter panel.
- Solid bronze fills for picked state. Picked = soft tint (accent ~14%) + thin outline, everywhere.
- Emoji as icons. Use the existing inline SVG icon components.
- Horizontal top tabs for navigation on desktop. The user asked for the vertical bar.

## Design

### 1. Navigation

- Desktop: the sidebar becomes a fixed narrow icon rail (about 78px): Vcan mark/logo on top, then
  Products, Analytics, Promotion Plan as icon-over-label buttons, then the existing
  "Made by Meth / Trade Marketing" credit at the bottom in small text. The Vendor and Status
  filters leave the sidebar (they move to the filter panel). The collapse hamburger and
  `sidebarOpen` state go away.
- Phone (`isMobile`): no drawer. A fixed bottom tab bar with the same three entries (min 48px tall,
  respects `env(safe-area-inset-bottom)`); page content gets matching bottom padding. The header
  hamburger and `mobileNavOpen` go away. Bottom sheets and modals (ProductPopup, PromoSection's
  portalled sheet, Calc modal) must sit above the tab bar.
- The `packshot` tab key, its JSX block, and its private state (`psSearch`, `psRetailers`,
  `psFiltered`, `togglePsRetailer`) are deleted.
- The header keeps every existing control (title, version badge, data-source chip, bell, access
  log, theme toggle, Import CSV).

### 2. Products page layout (desktop)

Two columns under the header, each with its own vertical scroll so the filter panel stays put while
the list scrolls:

**Left: filter panel, 384px wide.** Three cards, top to bottom:

- **Status**: 2x2 grid of buttons: All, Active, Pending, Discontinued, each with its count
  right-aligned. Clicking a picked status again returns to All. Counts and semantics are exactly
  today's `stats` / `statsBase` / `toggleStatus` / `effStatusFor` logic (per-retailer status when a
  retailer is picked). Do not change that logic.
- **Customer**: heading + hint "Tap a store to filter. Tap again to remove it." Then the 14
  retailers as tiles, three across, content centred, and a short last row centred. Each tile:
  the store logo in one fixed box (about 108x44, `object-fit: contain`), then "**N** listed".
  N = products with any non-empty value at that retailer, counted under every other active filter
  (search, vendor, status, brand) but not the customer filter itself. Multi-select, same
  `selectedRetailers` state and `toggleRetailer` as today. Central Department and Boots logo files
  have wide empty margins: render those two with `object-fit: cover` filling the box. Villa,
  The Mall and Golden Place keep a light plate in dark mode; Foodland and Fuji keep their dark
  plate in light mode (same sets as `RETAILER_DARK_PLATE` / `RETAILER_LIGHT_PLATE`).
- **Brand**: heading with the All / Vcan / Moola switch on the right (today's `vendorFilter` and
  `handleVendorChange`). Below, one bordered box per category that has brands (order from
  `BRAND_CATEGORIES`), each with a bold category title and "N brands" on the right, containing
  brand tiles three across, centred like the customer tiles. Each tile: brand logo on a fixed-size
  white plate (monogram fallback when there is no logo: reuse `BrandPlaque` / `brandMonogram`
  logic), the brand name (wraps to two lines), then "**N** items". Brand keys, names, categories
  and counts use the existing `brandKey` / `keyBrand` / `brandCategory` / `visibleBrands` /
  `brandCounts` machinery so split brands (L'Arbre Vert in Laundry and Homecare) keep working.
  Multi-select through `selectedBrands` / `toggleBrand`.

Tiles never move or change size when picked; only their counts and picked styling change.

**Right: results column.**

- Toolbar row: one search box ("Find a product: name, brand or barcode", same `search` state and
  matching as today) and a "Clear all" button that is always present and disabled when nothing is
  active (`hasActiveFilters` / `clearAll`).
- Summary row: "Showing **N** of M products", removable chips for each picked brand and customer,
  then on the right a native `<select>` Sort and a Cards / Table switch. When Table is on and at
  least one customer is picked, also show the dot legend (Active, Pending, On process, Discon).
- Sort options: Master list order (default), Name A to Z, Price low to high, Price high to low,
  Most stores first. Sorting state reuses or replaces today's `sortCol` / `sortDir`; table header
  click-sorting keeps working.
- **Cards view (default)**: responsive grid, `repeat(auto-fill, minmax(196px, 1fr))`. Card, top to
  bottom: front packshot on a white square (placeholder text "No photo yet" when missing), brand
  name in the vendor colour, product name (two-line clamp), RSP + status pill, then a "Sold at"
  block: small logos of the retailers where the product is active (value `A`), and one muted text
  line such as "1 pending · 3 discontinued" when there are any (pending counts `รอขาย` and
  `On process`). When no retailer is active show "No store yet". Hover lifts the card; motion is
  guarded by `prefers-reduced-motion`.
- **Table view**: columns Product (small thumbnail, name, brand in vendor colour, barcode), Pack,
  RSP, Status, then one dot column per *picked* customer (logo header, existing `RetailerDot`),
  then "Sold at" (the same logo row + text, on one line). The product column absorbs spare width;
  the table must not scroll sideways at 1280px wide with no customer picked.
- Empty state: "No product matches these filters." (no emoji).
- Clicking a card or row opens the popup (`setSelectedProduct`).
- The four stat cards, the search card, the customer logo card, the `BrandCategoryFilter` card and
  the old 14-dot-column table are removed from the Products tab.

### 3. Products page (phone)

- The filter panel is not shown. Under the search box: the status control as one full-width row of
  four equal buttons with counts, then two buttons "Brand" and "Customer" (each showing how many
  are picked) and "Clear all". Brand and Customer each open a bottom sheet containing the same
  tiles as the desktop cards (Brand sheet includes the Vcan / Moola switch) with a "Done" button.
- Cards only, two per row (`repeat(2, minmax(0, 1fr))`), nothing clipped at 390px wide. No table
  switch on phone. Sort select stays.
- Touch targets at least 40px.

### 4. Product popup

- Every entry point (Products cards, Products table, Promotion Plan `onSelect`) opens
  `ProductPopup` with the photo-forward layout on desktop (today's `variant="packshot"` /
  `isPackshotView`). The data-forward `'products'` variant is no longer used on desktop; remove the
  `variant` prop and the dead branch if that is a clean cut, otherwise always pass `'packshot'`.
  Phone keeps the existing bottom-sheet layout.
- Everything the popup does today stays: front/back, zoom/pan, export format + size picker,
  pricing behind PIN, promo info, access-log recording.

### 5. Performance

- `PackshotImg` gets `loading="lazy"` and `decoding="async"`.
- Card and row images are below-the-fold lazy; do not preload all 290.

### 6. Transparent PNG export

New pure module `src/cutout.js`:

```js
// Returns true when it changed anything. Mutates data in place.
export function knockOutWhite(data /* Uint8ClampedArray RGBA */, width, height, threshold = 250)
```

- If any pixel already has alpha < 250, do nothing and return false (the photo is already cut out).
- Otherwise flood-fill from every edge pixel through 4-connected pixels whose R, G and B are all
  >= `threshold`, and set alpha 0 on the filled pixels. Iterative (explicit stack / typed array
  queue), no recursion; must handle a 4000x4000 image without blowing the stack.
- White that does not touch the picture edge (inside a bottle handle, a white label) stays opaque.
- No feathering. This matches the trial the user approved (strict threshold 250). Threshold 236
  was tried and rejected because it eats white products.

`downloadAs` in `ProductPopup`: when the chosen format is **png**, after `drawImage` and before
`toBlob`, run `getImageData` → `knockOutWhite` → `putImageData`. Run it on the drawn image region
(or draw at native size, knock out, then composite into the target box) so that padding added by
the size picker stays transparent rather than being treated as picture. JPG keeps its white fill.
WebP export is unchanged. The existing "same format at original size → hand back the file"
shortcut is unchanged (sources are webp, so PNG always goes through the canvas).

Unit tests in `test/cutout.test.mjs` (node:test): white border around a coloured block is removed
and the block kept; enclosed white inside a coloured ring is kept; an image that already has
transparent pixels is untouched and returns false; near-white 249 is kept at threshold 250; a
fully white image becomes fully transparent.

## Constraints

- All repo rules in `CLAUDE.md` apply: back up every file before editing into
  `backups/<YYYYMMDD_HHmmss>/`; bump the version to **3.17.0** in `src/App.jsx` (header badge),
  `package.json` and both version fields of `package-lock.json`; inline styles from the `t` theme
  object; `glassPanel` for card containers; solid `t` hexes for anything sticky; both themes; both
  desktop and phone.
- Highlight colours keep one meaning each: accent tint + outline = picked; green/yellow/red/blue =
  status only.
- The new page may live in a new file `src/ProductsPage.jsx` (same pattern as `PromoSection.jsx`:
  props in, no state library) if that keeps `App.jsx` from growing; filter state stays in `App`.
  Components must be defined at module scope, never inside another component's render (the v2.18.0
  remount bug).
- `npm run lint`, `npm run build` and `node --test test/*.mjs` must pass.
- Update `CLAUDE.md`: Tabs section (Packshot merged into Products, new layout), Mobile UI rules
  (bottom tab bar, filter sheets, no sidebar drawer), and a v3.17.0 row at the top of the version
  history.

## Left to the builder

Exact spacing, font sizes and hover details (follow the mockup closely); how the filter sheets are
built on phone; whether the page is extracted to its own file; how sort state is stored.

## Calls made by the orchestrator (not explicitly decided by the user)

- Version 3.17.0 (new feature).
- Phone navigation = bottom tab bar, as shown in the mockup's Phone view; the sidebar drawer goes.
- Header controls stay exactly as they are (the mockup's "..." menu is not built).
- The credit line stays, at the bottom of the rail.
- Popup internals are reused, not rebuilt to match the mockup popup pixel for pixel.
- Transparent export applies to PNG only.
- Central / Boots logos are cropped with CSS, not by editing the image files.

## Amendments after the advisor review (2026-11-13). These override anything above that conflicts.

Line numbers refer to `src/App.jsx` at the branch point.

### Popup (replaces Design section 4)

- Always render `ProductPopup` with `variant="packshot"` from every entry point: Products cards and
  table, Promotion Plan `onSelect`, and the Analytics popover (about line 2611).
- The non-photo branch (about 900-915) is NOT dead: phone uses it because
  `isPackshotView = variant === 'packshot' && !isMobile` (776). Keep it for phone.
- The photo-forward desktop branch (about 888-898) currently has no Info / Promos switch and no
  `promoBlock`. Add the same tab row and `promoBlock` to it so promo history stays reachable on
  desktop. This move is authorised; nothing else inside the popup is redesigned.

### Transparent PNG (replaces the integration paragraph of Design section 6)

- Native-only: for PNG, draw the image at scale 1 onto its own canvas (`img.width` x `img.height`),
  `getImageData` → `knockOutWhite` → `putImageData`, then `drawImage` that canvas into the target
  W x H canvas with the existing contain/centre maths. Never run the knock-out on the padded target
  canvas (its transparent padding would trigger the "already cut out" early exit).
- Wrap `getImageData` in try/catch; on failure export as today (no cut-out).
- In `knockOutWhite`, mark pixels visited when pushed (typed array of width*height).
- Known limit, accepted: a local `.png` source at original size takes the existing hand-back
  shortcut and is not cut out. Production sources are webp.

### Counts (replaces the count wording in Design section 2)

- Customer tile count for store R = products that pass search, vendor and brand filters, have a
  non-empty value at R, and (when a status is picked) whose status **at R** matches:
  `effStatusFor(p, [R])`. It answers "how many would I get from this store alone".
- Brand tile count for brand B = products of B that pass search, vendor, the customer filter and
  the status filter exactly as `filtered` applies them (`effStatusFor(p, selectedRetailers)`),
  ignoring the brand filter itself. This needs a new memo; the existing `brandCounts` ignores
  status and stays as it is for PromoSection.
- "Most stores first" sorts by the number of retailers with value `A` (active), ties broken by the
  number of retailers with any non-empty value.
- The pending value is spelled `'On Process'` in code (lines 254, 1320); match case-insensitively.

### Scrolling shell

- Today the browser window scrolls (root is `minHeight: 100vh`, line 1378); `<main>` does not.
  Do not change how Analytics or Promotion Plan scroll.
- Desktop Products page only: give the page its own height-bounded two-column shell (height =
  viewport minus header, using the existing `calc(100vh / 1.05 ...)` zoom pattern from line 1451),
  cancel `<main>`'s padding for this tab if needed, and let the filter panel and the results column
  each scroll with `overflow-y: auto`. The window itself should not scroll on this tab at desktop
  widths.
- Phone: keep normal window scrolling; no `dvh` or zoom maths.

### Phone tab bar

- No `env(safe-area-inset-*)` and no change to `index.html`. A plain fixed bar, 56px tall, pinned
  with `left: 0; right: 0; bottom: 0` (never `100vw`: the root `zoom: 1.05` would overflow).
- z-index between the header (50) and ProductPopup (2000).
- The Brand / Customer sheets are portalled to `document.body` like `PromoSection.jsx:845-851`
  (a `backdrop-filter` ancestor captures `position: fixed`). A portal loses inherited colour, font
  and zoom: set them explicitly on the sheet.
- PromoSection's Calc and PIN modals (`PromoSection.jsx` about 1183 and 1222) are not portalled.
  If the tab bar covers their bottom edge on a phone, portal those two to `document.body` using
  the pattern already in that file. That is the only PromoSection change allowed.

### Sort and Clear all

- "Clear all" clears search, vendor, status, brands and customers. It no longer resets the sort,
  and `hasActiveFilters` keeps ignoring the sort.

### Shared components and clean-up

- New page lives in `src/ProductsPage.jsx`. State and memos stay in `App`; shared components are
  passed as props (as PromoSection receives `RetailerLogo`) so there is no circular import.
  `RETAILERS`, the retailer logo map and the plate sets may move to a small constants module.
- `RetailerDot` is defined inside `App()` (about 1313): hoist it to module scope with a `t` prop.
- `BrandPlaque` resizes as its logo loads (87-105): add a fixed-size mode for the new tiles and
  keep the default behaviour (PromoSection uses it as `MonogramTile`, about 2380).
- `RetailerLogo`: add a cover-fit option for Central Department and Boots.
- `PackshotImg`: add a placeholder prop so cards show "No photo yet" with no emoji; the popup's
  existing placeholder is unchanged.
- Do not reuse `.rp-row` / `.rp-btn` (they dim unpicked tiles), `.bpill` (solid bronze hover) or
  `BrandPill` (vendor ring) for the new tiles.
- Key cards and rows by a value that is stable across filtering (not `barcode + index`), so
  filtering does not remount every card and re-run the image fallback chain.
- Removing the old UI leaves unused code that fails lint: the resize effect's `setMobileNavOpen`
  (about 1033), `StatCard`, `scopeLabel`, `TABLE_COLS`, `SortIcon`, `visibleRetailers`. Delete
  what is unused.
- App's own Calc modal block (about 2390) is unreachable today; leave it alone.

### Build order

1. `src/cutout.js` + `test/cutout.test.mjs`.
2. `downloadAs` integration.
3. Popup: photo-forward on desktop with Info / Promos, phone branch kept.
4. Shell (riskiest): icon rail, phone tab bar, delete Packshot tab + `ps*` state + `sidebarOpen` +
   `mobileNavOpen`. Check Analytics, Promotion Plan (sheet, Calc), bell, access log, CSV import.
5. App-side data: tile count memos, sort keys, hoisted `RetailerDot`, constants module.
6. `ProductsPage.jsx` desktop: filter panel, cards, table (no sideways scroll at 1280px).
7. Phone layout: status row, the two sheets, two-column cards at 390px.
8. Version 3.17.0 in all four places, `CLAUDE.md`, then lint, build, tests.
