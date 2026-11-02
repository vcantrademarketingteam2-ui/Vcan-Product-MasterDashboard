// Pure date/period logic for the Promotion Plan (React-free; `today` is always injectable).

export function parseDR(dr = '', today = new Date()) {
  const s0 = (dr || '').trim()
  const yearOf = n => {
    const y = parseInt(n)
    // Thai Buddhist years (Foodland "…/2569") → Gregorian
    return y < 50 ? 2000 + y : y < 100 ? 1900 + y : y > 2400 ? y - 543 : y
  }
  // Foodland same-month day range: "1-31/7/2569"
  const dd = s0.match(/^(\d+)\s*[–-]\s*(\d+)\s*\/\s*(\d+)\s*\/\s*(\d{2,4})$/)
  if (dd) {
    const yr = yearOf(dd[4]), mo = parseInt(dd[3]) - 1
    return { s: new Date(yr, mo, parseInt(dd[1])), e: new Date(yr, mo, parseInt(dd[2]), 23, 59, 59, 999) }
  }
  // Explicit start and end years: "22/10/26 - 18/11/26" (Watsons).
  const full = s0.match(/^(\d+)\/(\d+)\/(\d{2,4})\s*[–-]\s*(\d+)\/(\d+)\/(\d{2,4})$/)
  if (full) {
    const s = new Date(yearOf(full[3]), parseInt(full[2]) - 1, parseInt(full[1]))
    const e = new Date(yearOf(full[6]), parseInt(full[5]) - 1, parseInt(full[4]), 23, 59, 59, 999)
    return { s, e }
  }
  // Villa format: "25.06.26 - 22.07.26" (dots, both sides carry year, spaces around dash).
  // Without this branch every Villa period fails to parse and falls back to inferPeriodDate,
  // which maps "Monthly7"→July and wrongly marks it NOW when today sits in Monthly6's range.
  const md = s0.match(/^(\d+)\.(\d+)\.(\d+)\s*[–-]\s*(\d+)\.(\d+)\.(\d+)$/)
  if (md) {
    const s = new Date(yearOf(md[3]), parseInt(md[2]) - 1, parseInt(md[1]))
    const e = new Date(yearOf(md[6]), parseInt(md[5]) - 1, parseInt(md[4]), 23, 59, 59, 999)
    return { s, e }
  }
  // "27/05-9/06/26"  or  "7/01-20/01/26"
  const m = s0.match(/^(\d+)\/(\d+)\s*[–-]\s*(\d+)\/(\d+)(?:\/(\d+))?$/)
  if (!m) return null
  const yr = m[5] ? yearOf(m[5]) : today.getFullYear()
  const s = new Date(yr, parseInt(m[2]) - 1, parseInt(m[1]))
  const e = new Date(yr, parseInt(m[4]) - 1, parseInt(m[3]), 23, 59, 59, 999)
  // Crossing new year: a written year belongs to the END date, else the end rolls forward.
  if (e < s) { if (m[5]) s.setFullYear(s.getFullYear() - 1); else e.setFullYear(e.getFullYear() + 1) }
  return { s, e }
}

export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Infer a date range from the period name when dateRange is empty.
// Handles: Foodland Thai Buddhist names "1-31/1/2569", Villa "Monthly1-Monthly12", Homepro "Jan"-"Dec"
export function inferPeriodDate(p, today = new Date()) {
  const name = (p?.name || '').trim()
  // Foodland Thai Buddhist: "1-31/1/2569" or "1-30 /4/2569"
  const th = name.match(/^(\d+)[–-]\s*(\d+)\s*\/(\d+)\/(\d{4})$/)
  if (th) {
    const rawYr = parseInt(th[4])
    const yr = rawYr > 2500 ? rawYr - 543 : rawYr
    const mo = parseInt(th[3]) - 1
    const day1 = parseInt(th[1]), day2 = parseInt(th[2])
    if (mo >= 0 && mo < 12 && day1 >= 1 && day2 >= day1)
      return { s: new Date(yr, mo, day1), e: new Date(yr, mo, day2, 23, 59, 59, 999) }
  }
  // Monthly numbered: "Monthly1" ... "Monthly12" (Villa)
  const mn = name.match(/^[Mm]onthly(\d+)$/i)
  if (mn) {
    const mo = parseInt(mn[1]) - 1
    if (mo >= 0 && mo < 12)
      return { s: new Date(today.getFullYear(), mo, 1), e: new Date(today.getFullYear(), mo + 1, 0, 23, 59, 59, 999) }
  }
  // Short month name exact match: "Jan", "Feb" ... (Homepro)
  const mi = MONTH_NAMES.findIndex(m => m.toLowerCase() === name.toLowerCase())
  if (mi >= 0)
    return { s: new Date(today.getFullYear(), mi, 1), e: new Date(today.getFullYear(), mi + 1, 0, 23, 59, 59, 999) }
  return null
}


// Whole calendar days b - a (DST-safe)
export const dayDiff = (a, b) =>
  Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000)

// Period date range, or null when undated / implausibly long (> 62 days = mis-keyed range)
export function periodRange(p, today = new Date()) {
  const r = parseDR(p.dateRange, today) || inferPeriodDate(p, today)
  return r && dayDiff(r.s, r.e) <= 62 ? r : null
}

export function periodStatus(r, today = new Date()) {
  if (!r) return 'unknown'
  return today < r.s ? 'future' : today > r.e ? 'past' : 'now'
}

// Per-store plan columns: Col = { name, idx (source index), r ({s,e}|null), status }
export function buildPlan(periods, today = new Date()) {
  const cols = periods.map((p, idx) => {
    const r = periodRange(p, today)
    return { name: p.name, idx, r, status: periodStatus(r, today) }
  })
  // Sort by start only when every period is dated; otherwise the source order is the only safe one.
  if (cols.every(c => c.r)) cols.sort((a, b) => a.r.s - b.r.s || a.idx - b.idx)
  const has = st => cols.some(c => c.status === st)
  return { cols, hasNow: has('now'), hasFuture: has('future'), hasUnknown: has('unknown') }
}

// ── period selector ───────────────────────────────────────────────────────────
// Pick = { lvl: 'q'|'m'|'p'|'u', y?, q? (0-3), m? (0-11), name? }
const endOfDay = (y, m, d) => new Date(y, m, d, 23, 59, 59, 999)
export const quarterSpan = (y, q) => [new Date(y, q * 3, 1), endOfDay(y, q * 3 + 3, 0)]
export const monthSpan = (y, m) => [new Date(y, m, 1), endOfDay(y, m + 1, 0)]
export const colsInSpan = (cols, [a, b]) => cols.filter(c => c.r && c.r.s <= b && c.r.e >= a)

const monthPick = d => ({ lvl: 'm', y: d.getFullYear(), q: Math.floor(d.getMonth() / 3), m: d.getMonth() })

export function defaultPick(cols, today = new Date()) {
  if (cols.some(c => c.status === 'now')) return monthPick(today)
  const fut = cols.find(c => c.status === 'future')
  if (fut) return monthPick(fut.r.s)
  const dated = cols.filter(c => c.r)
  if (dated.length) return monthPick(dated[dated.length - 1].r.s)
  return cols.length ? { lvl: 'u' } : null
}

export function colsForPick(cols, pick) {
  if (!pick) return []
  if (pick.lvl === 'q') return colsInSpan(cols, quarterSpan(pick.y, pick.q))
  if (pick.lvl === 'm') return colsInSpan(cols, monthSpan(pick.y, pick.m))
  if (pick.lvl === 'p') return cols.filter(c => c.name === pick.name)
  return cols.filter(c => !c.r)
}

export function pickLabel(pick) {
  if (!pick) return 'No periods'
  if (pick.lvl === 'q') return `Q${pick.q + 1} ${pick.y}`
  if (pick.lvl === 'm') return `${MONTH_NAMES[pick.m]} ${pick.y}`
  if (pick.lvl === 'p') return pick.y != null && pick.m != null ? `${pick.name} (${MONTH_NAMES[pick.m]} ${pick.y})` : pick.name
  return 'Undated periods'
}

export const pickYears = cols =>
  [...new Set(cols.flatMap(c => c.r ? [c.r.s.getFullYear(), c.r.e.getFullYear()] : []))].sort((a, b) => a - b)

// ── product across stores ─────────────────────────────────────────────────────
// Row = { retailer, item, now:{col,pd}|null, nowCol, moreLive, next:{col,pd}|null, nextCol, upcoming:{col,pd}|null }
export function productRows(barcode, itemsByRetailer, plans, retailers) {
  const rows = [], notIn = []
  for (const retailer of retailers) {
    const item = (itemsByRetailer[retailer] || []).find(i => i.barcode === barcode)
    if (!item) { notIn.push(retailer); continue }
    const cols = plans[retailer]?.cols || []
    const withPd = cols.map(col => ({ col, pd: item.periods?.[col.name] })).filter(x => x.pd)
    const live = withPd.filter(x => x.col.status === 'now').sort((a, b) => a.col.r.e - b.col.r.e)
    const nowCol = live[0]?.col || cols.find(c => c.status === 'now') || null
    const nextIdx = cols.findIndex(c => c.status === 'future')
    const nextCol = cols[nextIdx] || null
    const next = nextCol && item.periods?.[nextCol.name] ? { col: nextCol, pd: item.periods[nextCol.name] } : null
    const upcoming = nextIdx < 0 ? null : withPd.find(x => cols.indexOf(x.col) > nextIdx && x.col.status !== 'past') || null
    rows.push({ retailer, item, now: live[0] || null, nowCol, moreLive: Math.max(live.length - 1, 0), next, nextCol, upcoming })
  }
  return { rows, notIn }
}

// Lowest numeric live sale price across stores; label-only promos (salePrice null) are ignored
export function bestNow(rows) {
  let best = null
  for (const r of rows) {
    const price = r.now?.pd?.salePrice
    if (typeof price === 'number' && (!best || price < best.price)) best = { retailer: r.retailer, price, col: r.now.col }
  }
  return best
}
