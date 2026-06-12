# Porcelain Glass Redesign — v2.19.0

Date: 2026-06-12 · Status: approved by user

## Goal

Professional glassmorphism + neon-accent redesign of the Promotion Plan
(Schedule, Spotlight, Grid), the Analytics tab, and a complete light-mode
overhaul (app-wide) matching the warm-porcelain reference images.

## Decisions (user-confirmed)

1. **Yellow price pill removed.** The `GOLD_GRAD` fallback in
   `getBarStyle()` (promos with no activity type) becomes an **ice-silver
   frosted glass** pill: translucent fill, cool silver-white glow, bold
   theme-color price text. Applies to Schedule bars, Spotlight FeedCards,
   Grid chips.
2. **Gold scope: pills out, refined chrome.** Gold leaves all price
   pills/bars. Selection states, NOW markers, tabs, and the Compensate Calc
   button keep a gold-family accent but refined to a **bronze gradient**
   `#d4a86a → #9c6b35` (reference: the "0.100" numerals).
3. **Neon activity mapping:**
   - ลงสื่อ (media): blue → **Neon Cyan** `#22d3ee` + glow
   - LOOKS Magazine: → **Neon Fuchsia** (brightened `#e879f9` family, strong glow)
   - ลงพื้นที่ (field): stays orange `#f97316`, glow added
   - เคลียร์สินค้า (clearance): cyan → **Neon Coral** `#f43f5e` (frees cyan;
     supplies the "subtle red" accent)
4. **Light mode: cream + aurora glows, app-wide.** Base `#f4efe9` warm
   porcelain; two large fixed radial glows (sage green top-right, coral
   bottom-left, ~6–8% opacity); glass surfaces `rgba(255,255,255,.6)` +
   `backdrop-filter: blur(14px) saturate(1.4)`; accent mustard `#b8850a` →
   bronze. The `t` object is global, so Products/Packshot/sidebar inherit
   the porcelain theme (confirmed desired).

Dark mode: palette unchanged; surfaces gain the matching glass treatment
with slightly stronger neon glows.

## Section work

- **Schedule** — glass month axis; pill bars stay floating-pill geometry but
  glass with activity-colored neon edge + outer glow (ice-silver default);
  TODAY marker = refined bronze dashed line; hover tooltip becomes glass.
- **Spotlight** — stat strip → glass cards, neon top edge, glowing values;
  tabs + period progress restyled bronze; FeedCards → glass with neon left
  edge; period/brand group headers glassed.
- **Grid** — glass chips: translucent fill + neon hairline ring, **no
  per-chip backdrop-filter** (blur on containers only, for scroll perf);
  cleaner header band; current-period column keeps crisp bronze inset edges.
- **Analytics** — KPI cards → glass with neon top glow; semantic tints
  (green = active/positive, coral = gaps/discontinued); Brand Portfolio +
  Retailer Scorecard bars → gradient neon fills, soft glow, glass tracks.

## Constraints

- Backups to `backups/<ts>/` before each file edit; version → **v2.19.0**
  in App.jsx badge + package.json.
- Check desktop + mobile (`isMobile`) and dark + light per CLAUDE.md.
- Keep: `offPctOf` as the only discount helper; views invoked as
  `Calendar()`/`Schedule()`/`Spotlight()` function calls (remount bug);
  RetailerLogo customer pills; PIN gate behavior; all data logic untouched —
  this is styling-only.
- Files: `src/App.jsx` (theme, aurora bg, Analytics), `src/PromoSection.jsx`,
  `src/PromoSection.css`, `package.json`.

## Verification

`npm run lint`, `npm run build`, dev-server visual check in both modes and
at mobile width. No tests are configured in this repo.
