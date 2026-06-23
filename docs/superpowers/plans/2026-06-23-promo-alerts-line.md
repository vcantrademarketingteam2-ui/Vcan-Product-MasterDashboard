# Promo Alerts (LINE) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alert the team 5 and 2 days before any activity (field/media/looks) promo starts — via a LINE broadcast and an in-app topbar bell.

**Architecture:** `convert_promo.py` emits `public/notification_schedule.json`. A new Cron Worker (added to the existing static-assets `wrangler.jsonc`) reads that JSON daily and broadcasts due alerts to LINE. A small shared pure-JS module (`src/promoAlerts.js`) holds all date math, used by both the Worker and the App.jsx bell so the logic is written and tested once.

**Tech Stack:** Python 3 + openpyxl (existing), Cloudflare Workers (cron trigger + ASSETS binding), React 19 (existing), `node:test` for the JS unit test, plain `python` for the Python self-check.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-06-22-promo-alerts-line-design.md` — every task's requirements include it.
- **Version:** bump `package.json` `version` and the App.jsx header badge to **`3.0.0`** (badge currently reads `v2.26.6`). Keep both in sync (CLAUDE.md rule 1).
- **Backups:** before editing any existing file, copy it into `backups/<YYYYMMDD_HHmmss>/` (CLAUDE.md rule 2).
- **Regenerate data:** after the `convert_promo.py` change, re-run it so `src/promo_data.js` **and** the new `public/notification_schedule.json` are regenerated; commit generated files with the code (CLAUDE.md rule 4). Requires the Y: drive xlsx files + a prior `convert_to_data.py` run (for `src/data.js`).
- **Timing rule:** broadcast when `today == startDate − 5` OR `today == startDate − 2`, "today" computed in **Asia/Bangkok**. Bell badge counts promos starting within **0–5 days inclusive**.
- **Qualifying promos:** only periods with ≥1 item carrying a non-empty `activities` array. Un-parseable period date ranges (`Jan`, `SP6`) are skipped.
- **Messages:** plain text only (no LINE flex/cards) for v3.
- **No new runtime dependencies.** `node:test` and `python` stdlib only for checks.

### PRECONDITION — resolve the working-tree WIP first (blocks Task 4, and the regen in Task 1)

The working tree has **uncommitted** neon-retailer-logo WIP: `M src/App.jsx`, `M src/PromoSection.jsx`, `M package.json` (badge already at `v2.26.6`), plus untracked `public/retailers/neon/`. Task 4 edits `App.jsx` + `package.json`; the version bump and bell edits will tangle with that WIP. **Before starting Task 4, the operator must pick one:**
- (a) commit or stash the neon WIP so v3 starts from a clean `App.jsx`/`package.json`, or
- (b) consciously build v3 on top of the WIP and commit them together.
Default recommendation: **stash the neon WIP** (`git stash push -m "neon-logo-wip" src/App.jsx src/PromoSection.jsx package.json`) so v3 commits stay isolated, then unstash later. Confirm with the user. Tasks 1–3 do not touch those files and can proceed regardless.

---

### Task 1: Python — emit `notification_schedule.json`

**Files:**
- Modify: `convert_promo.py` (add `import re` near top ~line 8; add helpers after `load_non_vat_barcodes` ~line 66; call writer in `main()` ~line 504, before/after the `promo_data.js` write)
- Create: `public/notification_schedule.json` (generated output — committed)
- Test: `test_convert_promo.py` (repo root)

**Interfaces:**
- Produces: `parse_start_date(date_range: str) -> str | None` (ISO `YYYY-MM-DD`); `load_barcode_brands() -> dict[str,str]`; `build_notification_schedule(promo_meta: dict, all_products: list, barcode_brand: dict) -> list[dict]` where each entry = `{retailer, period, startDate, activities:[str], brands:[str], title}`.
- Consumes: existing `promo_meta` (`{retailer: {periods:[{name, dateRange}]}}`) and `all_products` (each `{retailer, barcode, brand, periods:{name:{activities:[...]}}}`) built in `main()`.

- [ ] **Step 1: Write the failing test**

Create `test_convert_promo.py`:
```python
from convert_promo import parse_start_date, build_notification_schedule

def test_parse_start_date():
    assert parse_start_date('7/01-20/01/26') == '2026-01-07'
    assert parse_start_date('1/12-15/12/2026') == '2026-12-01'
    assert parse_start_date('Jan') is None
    assert parse_start_date('SP6') is None
    assert parse_start_date('') is None
    assert parse_start_date(None) is None

def test_build_schedule_filters_and_shapes():
    promo_meta = {'Tops': {'periods': [
        {'name': 'P1', 'dateRange': '7/01-20/01/26'},   # has activity -> kept
        {'name': 'P2', 'dateRange': '8/02-20/02/26'},   # no activity -> dropped
        {'name': 'P3', 'dateRange': 'Jan'},             # unparseable -> dropped
    ]}}
    products = [
        {'retailer': 'Tops', 'barcode': '111', 'brand': '',
         'periods': {'P1': {'activities': ['media']}, 'P2': {'activities': []}}},
    ]
    sched = build_notification_schedule(promo_meta, products, {'111': 'Sundae'})
    assert len(sched) == 1
    e = sched[0]
    assert e['retailer'] == 'Tops' and e['period'] == 'P1'
    assert e['startDate'] == '2026-01-07'
    assert e['activities'] == ['media'] and e['brands'] == ['Sundae']

if __name__ == '__main__':
    test_parse_start_date(); test_build_schedule_filters_and_shapes(); print('OK')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python test_convert_promo.py`
Expected: FAIL — `ImportError: cannot import name 'parse_start_date'`.

- [ ] **Step 3: Add `import re`**

At the top of `convert_promo.py`, add to the imports (after `import json`, line ~8):
```python
import re
```

- [ ] **Step 4: Implement the three helpers**

Insert after `load_non_vat_barcodes()` (after line ~66):
```python
def parse_start_date(date_range):
    """First date of a range like '7/01-20/01/26' -> ISO '2026-01-07'.
    Returns None for month labels / un-parseable cells ('Jan', 'SP6', '')."""
    if not date_range:
        return None
    s = str(date_range).strip()
    m = re.match(r'(\d{1,2})\s*/\s*(\d{1,2})', s)
    yr = re.search(r'/(\d{2,4})\s*$', s)
    if not m or not yr:
        return None
    day, month = int(m.group(1)), int(m.group(2))
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    y = int(yr.group(1))
    year = 2000 + y if y < 100 else y
    return f'{year:04d}-{month:02d}-{day:02d}'


def load_barcode_brands():
    """barcode -> master brand, from src/data.js (same source as load_non_vat_barcodes)."""
    try:
        txt = Path('src/data.js').read_text(encoding='utf-8')
        start = txt.index('[', txt.index('PRODUCT_DATA'))
        end = txt.rindex(']') + 1
        items = json.loads(txt[start:end])
    except Exception as e:
        print(f'  (!)  Could not load data.js for brands: {e}')
        return {}
    return {str(it.get('barcode', '')): str(it.get('brand', '')) for it in items}


def build_notification_schedule(promo_meta, all_products, barcode_brand):
    """One entry per (retailer, period) that has >=1 item with a non-empty activities list
    and a parseable start date."""
    sched = []
    for retailer, meta in promo_meta.items():
        for p in meta['periods']:
            start = parse_start_date(p.get('dateRange', ''))
            if not start:
                continue
            acts, brands = set(), set()
            for prod in all_products:
                if prod['retailer'] != retailer:
                    continue
                pd = prod['periods'].get(p['name'])
                if not pd or not pd.get('activities'):
                    continue
                acts.update(pd['activities'])
                b = barcode_brand.get(prod['barcode']) or prod.get('brand') or ''
                if b:
                    brands.add(b)
            if not acts:
                continue
            sched.append({
                'retailer': retailer,
                'period': p['name'],
                'startDate': start,
                'activities': sorted(acts),
                'brands': sorted(brands),
                'title': f"{retailer} {p['name']}",
            })
    return sched
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python test_convert_promo.py`
Expected: `OK`.

- [ ] **Step 6: Wire the writer into `main()`**

In `main()`, immediately after `OUT.write_text(...)` (line ~527), add:
```python
    # Notification schedule for the promo-alerts Cron Worker + in-app bell
    barcode_brand = load_barcode_brands()
    schedule = build_notification_schedule(promo_meta, all_products, barcode_brand)
    sched_path = Path('public/notification_schedule.json')
    sched_path.write_text(json.dumps(schedule, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'   Notification schedule -> {sched_path} ({len(schedule)} entries)')
```

- [ ] **Step 7: Regenerate data (requires Y: drive + prior `convert_to_data.py`)**

Run: `python convert_promo.py`
Expected: console shows `Notification schedule -> public\notification_schedule.json (N entries)` and `src/promo_data.js` is rewritten. Open `public/notification_schedule.json` and eyeball a couple of entries (sane `startDate`, real `activities`).

- [ ] **Step 8: Commit**

```bash
git add convert_promo.py test_convert_promo.py public/notification_schedule.json src/promo_data.js
git commit -m "feat: emit notification_schedule.json from convert_promo.py"
```

---

### Task 2: Shared date helpers — `src/promoAlerts.js`

**Files:**
- Create: `src/promoAlerts.js`
- Test: `test/promoAlerts.test.mjs`

**Interfaces:**
- Produces:
  - `daysUntil(dateISO, todayISO) -> number` (whole days, may be negative)
  - `dueToday(schedule, todayISO) -> Array` (entries exactly 5 or 2 days out — Worker uses this)
  - `upcomingWithin(schedule, todayISO, days=5) -> Array` (entries 0..days out inclusive — bell uses this)
  - `bangkokToday(now=new Date()) -> string` (ISO date in Asia/Bangkok)
- Consumes: schedule entries from Task 1 (each has a `startDate` ISO string).

- [ ] **Step 1: Write the failing test**

Create `test/promoAlerts.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { daysUntil, dueToday, upcomingWithin, bangkokToday } from '../src/promoAlerts.js';

test('daysUntil counts whole days', () => {
  assert.equal(daysUntil('2026-01-07', '2026-01-02'), 5);
  assert.equal(daysUntil('2026-01-07', '2026-01-05'), 2);
  assert.equal(daysUntil('2026-01-07', '2026-01-07'), 0);
});

test('dueToday matches only 5 and 2 days out', () => {
  const s = [{ startDate: '2026-01-07' }, { startDate: '2026-01-10' }];
  assert.deepEqual(dueToday(s, '2026-01-02').map(e => e.startDate), ['2026-01-07']); // 5 out
  assert.deepEqual(dueToday(s, '2026-01-05').map(e => e.startDate), ['2026-01-07']); // 2 out
  assert.equal(dueToday(s, '2026-01-06').length, 0);                                  // 1 out
});

test('upcomingWithin is inclusive 0..days', () => {
  const s = [{ startDate: '2026-01-07' }];
  assert.equal(upcomingWithin(s, '2026-01-02', 5).length, 1); // 5 out
  assert.equal(upcomingWithin(s, '2026-01-01', 5).length, 0); // 6 out
  assert.equal(upcomingWithin(s, '2026-01-08', 5).length, 0); // past
});

test('bangkokToday rolls over with +7h offset', () => {
  assert.equal(bangkokToday(new Date('2026-01-06T18:00:00Z')), '2026-01-07'); // 01:00 BKK next day
  assert.equal(bangkokToday(new Date('2026-01-06T10:00:00Z')), '2026-01-06'); // 17:00 BKK same day
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/promoAlerts.test.mjs`
Expected: FAIL — cannot resolve `../src/promoAlerts.js`.

- [ ] **Step 3: Implement the module**

Create `src/promoAlerts.js`:
```js
// Pure date helpers for promo alerts. No DOM, no deps — runnable under node and bundlable
// into the Cron Worker. Shared by the Worker (dueToday) and the App.jsx bell (upcomingWithin).
const DAY = 86400000;

export function daysUntil(dateISO, todayISO) {
  const a = Date.parse(todayISO + 'T00:00:00Z');
  const b = Date.parse(dateISO + 'T00:00:00Z');
  return Math.round((b - a) / DAY);
}

export function dueToday(schedule, todayISO) {
  return schedule.filter((e) => {
    const d = daysUntil(e.startDate, todayISO);
    return d === 5 || d === 2;
  });
}

export function upcomingWithin(schedule, todayISO, days = 5) {
  return schedule.filter((e) => {
    const d = daysUntil(e.startDate, todayISO);
    return d >= 0 && d <= days;
  });
}

export function bangkokToday(now = new Date()) {
  // ponytail: fixed +7h offset — Thailand has no DST, so no tz library needed
  return new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/promoAlerts.test.mjs`
Expected: all 4 tests pass (`# pass 4`).

- [ ] **Step 5: Commit**

```bash
git add src/promoAlerts.js test/promoAlerts.test.mjs
git commit -m "feat: shared promo-alert date helpers + tests"
```

---

### Task 3: Cron Worker — daily LINE broadcast

**Files:**
- Create: `worker/index.js`
- Modify: `wrangler.jsonc` (add `main`, `assets.binding`, `triggers.crons`)

**Interfaces:**
- Consumes: `dueToday`, `daysUntil`, `bangkokToday` from `src/promoAlerts.js` (Task 2); `public/notification_schedule.json` served via the `ASSETS` binding (Task 1); secret `LINE_TOKEN`.
- Produces: a `scheduled` handler (cron) and a pass-through `fetch` handler (keeps the SPA served).

- [ ] **Step 1: Back up `wrangler.jsonc`**

```bash
mkdir -p "backups/$(date +%Y%m%d_%H%M%S)" && cp wrangler.jsonc "backups/$(date +%Y%m%d_%H%M%S)/"
```

- [ ] **Step 2: Update `wrangler.jsonc`**

Replace the file contents with:
```jsonc
{
  "name": "vcanproductmasterdashboard",
  "compatibility_date": "2024-12-01",
  "main": "worker/index.js",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application",
    "binding": "ASSETS"
  },
  "triggers": {
    "crons": ["0 2 * * *"]
  }
}
```

- [ ] **Step 3: Implement the Worker**

Create `worker/index.js`:
```js
import { dueToday, daysUntil, bangkokToday } from '../src/promoAlerts.js';

function alertText(e, daysOut) {
  const acts = e.activities.join(', ');
  const brands = e.brands.length ? ` (${e.brands.join(', ')})` : '';
  return `📢 ${e.retailer}${brands}: ${acts} promo starts in ${daysOut} days — ${e.startDate}`;
}

async function broadcast(token, text) {
  const r = await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ type: 'text', text }] }),
  });
  if (!r.ok) throw new Error(`LINE ${r.status}: ${await r.text()}`);
}

export default {
  async scheduled(event, env, ctx) {
    if (!env.LINE_TOKEN) { console.error('LINE_TOKEN not set'); return; }
    const today = bangkokToday();
    const res = await env.ASSETS.fetch('https://assets.local/notification_schedule.json');
    if (!res.ok) { console.error('schedule fetch failed', res.status); return; }
    const schedule = await res.json();
    const due = dueToday(schedule, today);
    console.log(`promo-alerts ${today}: ${due.length} due`);
    for (const e of due) {
      await broadcast(env.LINE_TOKEN, alertText(e, daysUntil(e.startDate, today)));
    }
  },
  fetch(request, env) {
    // ponytail: assets-first serving; this only runs for non-asset routes (SPA fallback)
    return env.ASSETS.fetch(request);
  },
};
```

- [ ] **Step 4: Verify the build still produces a deployable Worker**

Run: `npm run build && npx wrangler deploy --dry-run`
Expected: dry-run succeeds, output lists `main = worker/index.js` and a cron trigger `0 2 * * *`. No syntax/bundle errors resolving `../src/promoAlerts.js`.

- [ ] **Step 5: Set the secret (operator, once — not in CI)**

Run (paste the token at the prompt, never into a file):
```bash
npx wrangler secret put LINE_TOKEN
```
Expected: "Success! Uploaded secret LINE_TOKEN". (Skip if deploying purely locally; required before the cron does anything in production.)

- [ ] **Step 6: Live trigger test (after deploy)**

Run: `npx wrangler deploy` then trigger the scheduled handler once:
```bash
npx wrangler tail &   # watch logs
# In the Cloudflare dashboard: Workers > the worker > Triggers > "Run" the cron, OR use a temporary test date.
```
Expected: log line `promo-alerts <date>: N due`; if N>0 the LINE OA friends receive the message. (For a deterministic test, temporarily hardcode `const today = '<startDate-2 of a real entry>'`, deploy, trigger, then revert.)

- [ ] **Step 7: Commit**

```bash
git add wrangler.jsonc worker/index.js
git commit -m "feat: cron worker broadcasts due promo alerts to LINE"
```

---

### Task 4: In-app bell — `src/App.jsx`

> **Do the PRECONDITION (resolve neon WIP) before this task.**

**Files:**
- Modify: `src/App.jsx` (add fetch+state near other top-level state ~line 600-611; add bell button to the header action group ~line 1233, before the dark-mode button; bump version badge line 1220)
- Modify: `package.json` (`version` -> `3.0.0`)

**Interfaces:**
- Consumes: `upcomingWithin`, `bangkokToday` from `src/promoAlerts.js` (Task 2); `/notification_schedule.json` (served from `public/` in dev and `dist/` in prod).
- Produces: a topbar bell + badge + dropdown. Self-contained; nothing else depends on it.

- [ ] **Step 1: Back up `App.jsx` and `package.json`**

```bash
TS="backups/$(date +%Y%m%d_%H%M%S)"; mkdir -p "$TS" && cp src/App.jsx package.json "$TS/"
```

- [ ] **Step 2: Bump version**

In `package.json` set `"version": "3.0.0"`. In `src/App.jsx` line ~1220 change the badge text `v2.26.6` to `v3.0.0`.

- [ ] **Step 3: Add import + state + fetch**

At the top of `App.jsx`, add to the imports:
```js
import { upcomingWithin, bangkokToday } from './promoAlerts.js'
```
Inside the main component, next to the other `useState` declarations (~line 600-611), add:
```js
  const [alerts, setAlerts] = useState([])
  const [alertsOpen, setAlertsOpen] = useState(false)
  useEffect(() => {
    fetch('/notification_schedule.json')
      .then(r => (r.ok ? r.json() : []))
      .then(sched => setAlerts(upcomingWithin(sched, bangkokToday(), 5)))
      .catch(() => {})
  }, [])
```

- [ ] **Step 4: Add the bell button + dropdown to the header**

In the header action group (the `<div>` opened at line ~1233, just before the dark-mode `<button>`), insert:
```jsx
            {/* Promo alerts bell */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setAlertsOpen(o => !o)} className="sb-btn neon-ico" aria-label="Upcoming promo alerts" style={{
                background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.muted,
                padding: isMobile ? '5px 8px' : '5px 10px', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {alerts.length > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: t.accent, color: '#000', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{alerts.length}</span>
                )}
              </button>
              {alertsOpen && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 280, maxHeight: 360, overflowY: 'auto', background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.3)', zIndex: 60, padding: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: t.muted, padding: '4px 8px 8px' }}>Upcoming promos (≤5 days)</div>
                  {alerts.length === 0 && <div style={{ fontSize: 12, color: t.muted, padding: '4px 8px 8px' }}>Nothing in the next 5 days.</div>}
                  {alerts.map((e, i) => (
                    <div key={i} style={{ padding: '8px', borderTop: i ? `1px solid ${t.border}` : 'none' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{e.retailer}{e.brands.length ? ` · ${e.brands.join(', ')}` : ''}</div>
                      <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{e.activities.join(', ')} — starts {e.startDate}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
```

- [ ] **Step 5: Verify in the running app**

Run: `npm run dev`
Expected: app loads, header shows `v3.0.0` and a bell icon. With a regenerated `public/notification_schedule.json` containing an entry ≤5 days out, the bell shows a badge count and the dropdown lists it. (To force a visible entry for the check, temporarily edit `public/notification_schedule.json` to add an entry with `startDate` = today+3, then revert.) Confirm no console errors and the layout is intact on a narrow (mobile) width.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: no new errors from the added code.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx package.json
git commit -m "feat: v3.0.0 in-app promo-alert bell + badge"
```

---

## Final steps (after all tasks)

- [ ] Update CLAUDE.md version-history table with a `v3.0.0` row (Promo Alerts: LINE broadcast + in-app bell).
- [ ] Deploy: push to `main` (Cloudflare auto-builds). Confirm the cron trigger appears in the Cloudflare dashboard and `LINE_TOKEN` secret is set.
- [ ] If the neon WIP was stashed in the PRECONDITION, `git stash pop` it back into the working tree.

## Self-Review notes

- **Spec coverage:** schedule JSON (Task 1) ✓; cron worker + Bangkok tz + 5/2-day match + LINE broadcast + LINE_TOKEN secret (Task 3) ✓; in-app bell within 5 days (Task 4) ✓; activity-only filter + skip un-parseable dates (Task 1) ✓; no KV/PWA/DB ✓; ponytail ceiling (missed-day, no retry) inherent — not implemented by design ✓.
- **Type consistency:** `dueToday`/`upcomingWithin`/`daysUntil`/`bangkokToday` signatures match across Tasks 2→3→4; schedule entry shape (`retailer, period, startDate, activities, brands, title`) consistent between Task 1 producer and Tasks 3/4 consumers.
- **Note vs spec:** spec warned of a period-key mismatch requiring Python-side generation. Verified in code that `convert_promo.py` keys product periods by the same `p['name']` as `PROMO_META`, so no mapping is needed — generation stays in Python anyway (it owns the raw dates), so the spec's conclusion holds; only its stated reason was conservative.
