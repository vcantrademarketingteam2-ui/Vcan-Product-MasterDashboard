# v3.0.0 — Promo Alerts (LINE)

**Date:** 2026-06-22 (brainstormed) / approved 2026-06-23
**Status:** Design approved. Next: implementation plan (`writing-plans`).

## Goal

When an **activity** promo (field / media / looks) is about to start, notify the
team ahead of time so they can prepare. Two delivery channels:

1. A **LINE message** to everyone's phone (real, push-style alert).
2. An **in-app bell** in the dashboard topbar.

Price-only promo changes are **silent** — only activity promos trigger alerts.

## Trigger rules

- Fire **5 days before** and **2 days before** each promo's start date — two
  messages per promo.
- A promo qualifies only if its period has **≥1 activity** (field / media /
  looks). `PROMO_ACTIVITY` currently has no `clearance`, so clearance is moot.
- Plain price changes (no activity) never alert.

## Architecture — 3 pieces, no PWA, no database

### 1. Python — schedule generation

`convert_promo.py` additionally writes `public/notification_schedule.json`:

- One entry per `(retailer, period)` that has **≥1 item with non-empty
  `activities`**.
- Each entry carries a **structured ISO `startDate`**, parsed from the period's
  date range, plus `retailer`, `period`, `activities[]`, `brands[]`, `title`.
- Periods whose labels are month-only / un-parseable (`Jan`, `SP6`, …) are
  **skipped** — no reliable start date.
- Regenerated together with `promo_data.js` (working rule 4: regenerate data
  after parser/source changes).

**Why Python, not the client/Worker:** item period keys (e.g. `"WK 09-12"`) do
**not** match `PROMO_META` names (e.g. `"2603/04"`). Only the Python parser sees
the raw datetime cells, so date resolution must happen there.

**Date parsing:** `fmt_date_cell` (~line 150) collapses the raw datetime cell to
a `dd/mm/yy` string at parse time — the real date is available there. Parse the
**first** date of the range + the trailing year:
`"7/01-20/01/26"` → `2026-01-07`.

### 2. Cron Worker — LINE broadcast

Extend `wrangler.jsonc` (currently **static-assets only**: `assets.directory
./dist`, SPA):

- Add a `main` worker script.
- Add `triggers.crons = ["0 2 * * *"]` — 02:00 UTC = **09:00 Asia/Bangkok**.
- Keep the existing `assets` block (SPA serving must still work).

`scheduled` handler:

1. Fetch the Worker's own `/notification_schedule.json`.
2. Compute **today in Asia/Bangkok** (not UTC — avoids an off-by-one at the date
   boundary).
3. For each entry, alert if `today == startDate − 5` **or** `today == startDate − 2`.
4. POST matching alerts to LINE `/v2/bot/message/broadcast` with bearer secret
   **`LINE_TOKEN`** (set via `wrangler secret put LINE_TOKEN`).

No KV, no "already-sent" store — the exact-date match plus once-per-day cadence
makes each message fire exactly once.

**Message format (v3):** plain text. e.g.
`📢 LOOKS Magazine for Sundae @ The Mall starts in 2 days (7 Jan).`

### 3. In-app bell — `App.jsx`

- Topbar **bell icon + badge** = count of activity-promos starting within 5 days.
- Dropdown lists those upcoming promos (retailer, brand, activity, start date).
- Reads the same `notification_schedule.json` client-side — mechanism-independent
  of LINE, ~free, works desktop + mobile.

## Data shapes (verified 2026-06-22)

- `PROMO_META[retailer].periods` = `[{ name: "2603/04", dateRange: "7/01-20/01/26" }]`.
- promo items: `periods` map `periodKey → { salePrice, saleLabel, activities: [], compensate }`.
- Period-key mismatch (item keys ≠ META names) → schedule generation lives in
  Python (see above).

## LINE setup (DONE 2026-06-23)

OA created (`Vcan Promo Alerts`, `@562oaovr`, provider `Meth`). Messaging API
enabled. Long-lived **Channel access token** issued and saved privately by the
user (→ `wrangler secret put LINE_TOKEN` at deploy). Auto-replies/greeting off,
webhook empty (broadcast-only). Team adds the OA as a friend; broadcast reaches
all friends → no subscription store needed. Free quota ~500 msgs/mo.

## Known shortcut (ponytail ceiling)

- **Missed cron day = missed alert, no retry/catch-up.** Acceptable for now. If
  it bites, add a catch-up window (e.g. also match `startDate − 1`) or a
  last-run KV marker later.

## Out of scope for v3

- Per-user subscriptions / targeting (broadcast-to-all-friends only).
- Rich LINE flex/card messages (plain text only).
- Clearance-activity alerts (no clearance activity exists in the data).
- Retailer-logo and app-logo redesigns (parked separately).

## Working-rule reminders for implementation

- Bump version in `src/App.jsx` header + `package.json` to **v3.0.0**.
- Back up changed files into `backups/<ts>/` before editing.
- Regenerate `promo_data.js` + the new `notification_schedule.json` after the
  `convert_promo.py` change; commit generated files with the code.
