# Porcelain Glass Redesign (v2.19.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Glassmorphism + neon redesign of Promotion Plan (Schedule/Spotlight/Grid) and Analytics, with an app-wide warm-porcelain light-mode overhaul, shipped as v2.19.0.

**Architecture:** Styling-only change. The global `t` theme object in App.jsx gets a new light palette (solid warm hexes so sticky elements stay correct) plus an aurora root background; true glass (translucent fill + `backdrop-filter`) is applied per-component on non-perf-critical containers. PromoSection color constants are re-tokenized (gold→bronze chrome, neon activity palette, ice-glass default pill).

**Tech Stack:** React + Vite, inline styles + PromoSection.css. No tests configured — verification is `npm run lint`, `npm run build`, visual check (dark/light, desktop/mobile).

**Spec:** `docs/superpowers/specs/2026-06-12-porcelain-glass-redesign-design.md`

---

### Task 1: Backups, version bump, theme foundation

**Files:** Modify `src/App.jsx`, `package.json`.

- [ ] Backup `src/App.jsx`, `src/PromoSection.jsx`, `src/PromoSection.css`, `package.json`, `CLAUDE.md` → `backups/<ts>/`
- [ ] Bump `v2.18.1` → `v2.19.0` in App.jsx badge (line ~1075) and package.json
- [ ] Replace the light branch of `t` (App.jsx:633-639) with:

```js
  } : {
    bg: '#f4efe9', surface: '#fbf8f3', surface2: '#f3ede4', border: '#ded3c2',
    text: '#262019', muted: '#70634f', dim: '#e3dacb', accent: '#a5784a',
    green: '#1a7f37', yellow: '#9a6700', red: '#cf222e', blue: '#0969da',
    orange: '#953800', rowHover: '#f6f1e9', sidebarBg: '#efe7dc', headerBg: '#f4efe9',
    vcanClr: '#9c6b35', moolaClr: '#c0392b',
  }
```

- [ ] Aurora background: where the app root div uses `background: t.bg`, switch light mode to layered radial gradients (sage top-right, coral bottom-left, `backgroundAttachment: 'fixed'`):

```js
  const appBg = dark ? t.bg :
    `radial-gradient(900px 600px at 88% -8%, rgba(122,168,116,.13), transparent 62%),
     radial-gradient(820px 620px at -6% 96%, rgba(214,106,90,.11), transparent 62%), ${t.bg}`
```

- [ ] Update theme-color meta (App.jsx:599) `'#edf0f4'` → `'#f4efe9'`
- [ ] Verify: `npm run dev`, light mode renders porcelain + glows; dark unchanged

### Task 2: PromoSection color tokens + pill system

**Files:** Modify `src/PromoSection.jsx:20-30, 350-356`.

- [ ] Re-token constants (keep `GOLD_A/GOLD_B` names = bronze values, minimal diff):

```js
const ACT = {
  ...PROMO_ACTIVITY,
  field: { ...PROMO_ACTIVITY.field, color: '#f97316' },   // orange (unchanged)
  media: { ...PROMO_ACTIVITY.media, color: '#22d3ee' },   // NEON CYAN (was blue)
  looks: { ...PROMO_ACTIVITY.looks, color: '#f061ff' },   // NEON FUCHSIA (brightened)
}
const CLEAR_COLOR = '#f43f5e'                              // NEON CORAL (was cyan)
const GOLD_A = '#d4a86a'   // bronze light  (chrome accent only — never price pills)
const GOLD_B = '#9c6b35'   // bronze deep
```

- [ ] `getBarStyle` — remove gold fallback; return `{ bg, clr, txt }`; ice-glass default (needs `dark` from closure — it's a prop, available):

```js
const getBarStyle = (activities, clearance) => {
  if (clearance) return { bg: `linear-gradient(135deg,${CLEAR_COLOR}e8,${CLEAR_COLOR}99)`, clr: CLEAR_COLOR, txt: '#fff' }
  for (const a of (activities || [])) {
    if (ACT[a]) return { bg: `linear-gradient(135deg,${ACT[a].color}e8,${ACT[a].color}99)`, clr: ACT[a].color, txt: '#fff' }
  }
  // ice-silver frosted glass (no-activity default)
  return { bg: dark ? 'rgba(203,225,243,.13)' : 'rgba(255,255,255,.6)', clr: dark ? '#a8c5da' : '#8fa9bd', txt: tx, ice: true }
}
```

### Task 3: Schedule view glass restyle

**Files:** Modify `src/PromoSection.jsx` (Schedule fn ~476-613), `src/PromoSection.css` (`.ps-sched-bar*`).

- [ ] Bars: `border: 1px solid ${bs.clr}55`, neon glow `boxShadow: inset 0 1px 0 rgba(255,255,255,.3), 0 0 14px -3px ${bs.clr}`, ice bars get `backdropFilter` only if cheap (rows are few per lane — allowed), bar text color = `bs.txt` inline (CSS keeps white default)
- [ ] TODAY marker: bronze `borderLeft: 2px dashed ${GOLD_A}` + small glow `filter: drop-shadow(0 0 4px ${GOLD_A}88)`
- [ ] Month axis + window selector: glass header (`background: rgba` + `backdropFilter: 'blur(12px) saturate(1.4)'` on the sticky axis), bronze active window button
- [ ] Tooltip (barTip popup ~928-973): glass — `background: dark ? 'rgba(18,22,42,.82)' : 'rgba(255,255,255,.78)'` + `backdropFilter: 'blur(16px) saturate(1.5)'`

### Task 4: Spotlight glass restyle

**Files:** Modify `src/PromoSection.jsx` (Spotlight/FeedCard/BrandGroupHdr ~615-793).

- [ ] Stat strip cards: glass fill + blur, keep neon `borderTop: 3px solid ${c}`, add `boxShadow: 0 0 18px -8px ${c}`; "Live promos" stat color stays GOLD_A (now bronze)
- [ ] Period progress: bar gradient already GOLD_A→GOLD_B (auto-bronze) — glass the container
- [ ] Tabs: active = `BRONZE` (GOLD_GRAD) with `color:'#fff'` (was `#1a1505` — too dark on bronze)
- [ ] FeedCard: glass fill (`rgba` + blur), `borderLeft: 3px solid ${bs.clr}`, neon glow on hover, price color = `bs.ice ? tx : bs.clr`
- [ ] BrandGroupHdr + ended period headers: glass fill, keep colored left edge

### Task 5: Grid view restyle

**Files:** Modify `src/PromoSection.jsx` (Calendar fn ~395-473), `src/PromoSection.css` (`.ps-chip`).

- [ ] Chips: NO per-chip backdrop-filter. Activity chips: `color-mix(in srgb, ${mc} 16%, ${s2})` + `border: 1px solid ${mc}88` + subtle `boxShadow: 0 0 8px -4px ${mc}`. Default (no-activity) chips: ice glass `background: dark ? 'rgba(203,225,243,.10)' : 'rgba(255,255,255,.72)'`, `border: 1px solid ${dark ? 'rgba(168,197,218,.4)' : 'rgba(143,169,189,.45)'}` — replaces the `t.accent` gold tint
- [ ] Header cells + brand bands: cleaner — band uses subtle vendor-tinted glass `${coColor}0d`; NOW column keeps bronze inset edges (`nowLine` = t.accent = bronze automatically)
- [ ] `nowBg` constant (~383): re-tint to bronze `dark ? 'rgba(212,168,106,.10)' : 'rgba(156,107,53,.08)'`

### Task 6: Shared chrome (pills, toolbar, modal)

**Files:** Modify `src/PromoSection.jsx` (render ~796-905, CalcModal ~984-1057).

- [ ] Customer/brand pills, seg toggles, Calc button: all GOLD refs auto-bronze via Task 2; fix dark-on-gold text `#1a1505` → `#fff` wherever bg is GOLD_GRAD (brand pills, seg `.on`, calc button, live tab)
- [ ] Main card (~908): glass — `background: dark ? 'rgba(22,27,34,.6)' : 'rgba(251,248,243,.66)'`, `backdropFilter: 'blur(16px) saturate(1.45)'`, soft shadow
- [ ] CalcModal: glass panel + bronze result accent (auto via t.accent)

### Task 7: Analytics overhaul

**Files:** Modify `src/App.jsx` (~1332-1510 analytics block).

- [ ] KPI cards: glass fill + blur, neon top border kept, value `textShadow: 0 0 18px ${c}55`, semantic tint: green card gets faint green wash `${t.green}08`, pending gets yellow wash
- [ ] Brand Portfolio bars: gradient fill `linear-gradient(90deg, ${clr}, ${clr}99)` + `boxShadow: 0 0 10px -3px ${clr}` on glass track (`rgba` track bg)
- [ ] Distribution gaps: coral accent for missing cells (`t.red` tint background `${t.red}0a`)
- [ ] Retailer Scorecard: same neon bar treatment; card containers → glass

### Task 8: Verify, document, commit

**Files:** Modify `CLAUDE.md`.

- [ ] `npm run lint` → clean (or only pre-existing warnings)
- [ ] `npm run build` → succeeds
- [ ] Visual check: dev server, light + dark, desktop + narrow viewport; Grid scroll perf OK
- [ ] CLAUDE.md: update activity color override docs (media=cyan `#22d3ee`, looks=fuchsia `#f061ff`, clearance=coral `#f43f5e`, gold pill removed, bronze chrome), add v2.19.0 row to version history
- [ ] Single commit: `feat: v2.19.0 - porcelain glass redesign (glassmorphism light theme, neon activity palette, ice price pills, Analytics glass overhaul)`
