/**
 * PromoSection.jsx — Drop-in redesigned Promotion Plan for the Vcan dashboard.
 *
 * Fixes applied vs. original drop-in:
 *   - ACT.field color overridden to #f97316 (orange) to stay distinct from clearance cyan.
 *   - Customer selector uses the RetailerLogo component (passed as prop) instead of plain text.
 *   - v2.15.0: Timeline redesign — Schedule (proportional Gantt) + Spotlight (live feed) views.
 */

import { useState, useMemo } from 'react'
import promoData, { PROMO_META, PROMO_ACTIVITY, PROMO_RETAILERS } from './promo_data.js'
import { DEPT_PINS, canSeeRetailer, logPricingAccess } from './deptPins.js'
import './PromoSection.css'

// v2.19.0 neon palette: media = neon cyan, looks = neon fuchsia, field = orange.
// Clearance moved off cyan (→ neon coral) so media can own it.
const ACT = {
  ...PROMO_ACTIVITY,
  field: { ...PROMO_ACTIVITY.field, color: '#f97316' },
  media: { ...PROMO_ACTIVITY.media, color: '#22d3ee' },
  looks: { ...PROMO_ACTIVITY.looks, color: '#f061ff' },
}
const CLEAR_COLOR = '#f43f5e'
// Bronze chrome accent (selection states, NOW markers, Calc button) — never price pills
const GOLD_A = '#d4a86a'
const GOLD_B = '#9c6b35'

// Light mode renders neon hues too pale on the cream background — map each to a
// deeper variant for text/borders/fills there. Dark mode keeps the bright neon.
const NEON_DEEP = {
  '#22d3ee': '#0891b2', // media cyan
  '#f061ff': '#c026d3', // looks fuchsia
  '#f97316': '#ea580c', // field orange
  '#f43f5e': '#e11d48', // clearance coral
}

// Inline SVG icons — neon/glass friendly, replace the old emoji glyphs
// ponytail: restrained neon glow keyed to the icon's own (current) colour
const ICO_GLOW = { filter: 'drop-shadow(0 0 2px currentColor)' }
const IcoTimeline = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={ICO_GLOW}>
    <path d="M1.5 3.5h6" /><path d="M4.5 7h8" /><path d="M2.5 10.5h5.5" />
  </svg>
)
const IcoGrid = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" style={ICO_GLOW}>
    <rect x="1" y="1" width="5" height="5" rx="1.2" /><rect x="8" y="1" width="5" height="5" rx="1.2" />
    <rect x="1" y="8" width="5" height="5" rx="1.2" /><rect x="8" y="8" width="5" height="5" rx="1.2" />
  </svg>
)
const IcoCalc = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={ICO_GLOW}>
    <rect x="2.5" y="1" width="9" height="12" rx="2" />
    <path d="M5 4h4" />
    <path d="M5 7.5h.01M7 7.5h.01M9 7.5h.01M5 10h.01M7 10h.01M9 10h.01" />
  </svg>
)
const GOLD_GRAD = `linear-gradient(135deg,${GOLD_A},${GOLD_B})`
// Appended only when absent, so this collapses to the untouched array once promo data carries Watsons.
const CUSTOMERS = PROMO_RETAILERS.includes('Watsons') ? PROMO_RETAILERS : [...PROMO_RETAILERS, 'Watsons']
const TODAY = new Date()
const TODAY_ISO = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}-${String(TODAY.getDate()).padStart(2, '0')}`

// ── date helpers ──────────────────────────────────────────────────────────────
function parseDR(dr = '') {
  const s0 = (dr || '').trim()
  // Villa format: "25.06.26 - 22.07.26" (dots, both sides carry year, spaces around dash).
  // Without this branch every Villa period fails to parse and falls back to inferPeriodDate,
  // which maps "Monthly7"→July and wrongly marks it NOW when today sits in Monthly6's range.
  const md = s0.match(/^(\d+)\.(\d+)\.(\d+)\s*[–-]\s*(\d+)\.(\d+)\.(\d+)$/)
  if (md) {
    const yr = n => (parseInt(n) < 50 ? 2000 : 1900) + parseInt(n)
    const s = new Date(yr(md[3]), parseInt(md[2]) - 1, parseInt(md[1]))
    const e = new Date(yr(md[6]), parseInt(md[5]) - 1, parseInt(md[4]), 23, 59, 59, 999)
    return { s, e }
  }
  // "27/05-9/06/26"  or  "7/01-20/01/26"
  const m = s0.match(/^(\d+)\/(\d+)[–-](\d+)\/(\d+)(?:\/(\d+))?$/)
  if (!m) return null
  const yr = m[5] ? (parseInt(m[5]) < 50 ? 2000 + parseInt(m[5]) : 1900 + parseInt(m[5])) : TODAY.getFullYear()
  const s = new Date(yr, parseInt(m[2]) - 1, parseInt(m[1]))
  let e = new Date(yr, parseInt(m[4]) - 1, parseInt(m[3]), 23, 59, 59, 999)
  if (e < s) e.setFullYear(e.getFullYear() + 1)
  return { s, e }
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Infer a date range from the period name when dateRange is empty.
// Handles: Foodland Thai Buddhist names "1-31/1/2569", Villa "Monthly1-Monthly12", Homepro "Jan"-"Dec"
function inferPeriodDate(p) {
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
      return { s: new Date(TODAY.getFullYear(), mo, 1), e: new Date(TODAY.getFullYear(), mo + 1, 0, 23, 59, 59, 999) }
  }
  // Short month name exact match: "Jan", "Feb" ... (Homepro)
  const mi = MONTH_NAMES.findIndex(m => m.toLowerCase() === name.toLowerCase())
  if (mi >= 0)
    return { s: new Date(TODAY.getFullYear(), mi, 1), e: new Date(TODAY.getFullYear(), mi + 1, 0, 23, 59, 59, 999) }
  return null
}

function periodIsCurrent(p) {
  const r = parseDR(p.dateRange) || inferPeriodDate(p)
  if (r) return TODAY >= r.s && TODAY <= r.e
  return false
}

// Derive a short display label for a period name
function periodLabel(name) {
  const th = name.match(/\/(\d{1,2})\/\d{4}$/)
  if (th) return MONTH_NAMES[parseInt(th[1]) - 1] || name
  return name
}

// Discount % off RSP — null when sale price or RSP is missing/invalid
function offPctOf(item, pd) {
  if (pd?.salePrice == null || !(item.rspIncVat > 0)) return null
  return Math.round((1 - pd.salePrice / item.rspIncVat) * 100)
}

// Enrich promo items with brand/company from the product master
function enrich(items, rawData) {
  return items.map(p => {
    const m = rawData?.find(r => r.barcode === p.barcode)
    const brand = m?.brand || p.brand || (() => {
      const nm = (p.product || '').trim()
      const di = nm.indexOf('-')
      return (di > 0 && di < 26) ? nm.slice(0, di).trim() : nm.split(/\s+/)[0] || '—'
    })()
    // Vernel promo rows arrive with no master match and empty company, which made
    // them render with the Moola/red fallback treatment — Vernel is a Vcan brand.
    const company = m?.company || p.company || (brand.trim().toLowerCase() === 'vernel' ? 'Vcan' : '')
    return { ...p, brand, company }
  })
}

// ── component ─────────────────────────────────────────────────────────────────
export default function PromoSection({ rawData, t, dark, isMobile, onSelect, RetailerLogo, MonogramTile, BrandCategoryFilter }) {
  const [retailer, setRetailer] = useState(CUSTOMERS[0] || '')
  const [brandFilter, setBrandFilter] = useState([])
  const [layout, setLayout] = useState('timeline')
  const [tlView, setTlView] = useState('pulse')
  const [spotTab, setSpotTab] = useState('live')
  const [barTip, setBarTip] = useState(null)
  const [unlocked, setUnlocked] = useState(null)
  const [pin, setPin] = useState('')
  const [pinErr, setPinErr] = useState(false)
  const [openKey, setOpenKey] = useState(null)
  const [calcOpen, setCalcOpen] = useState(false)
  const canSeeGP = unlocked && canSeeRetailer(unlocked, retailer)
  // Watsons has no generated promo data yet — show the placeholder until it does
  const comingSoon = retailer === 'Watsons' && !PROMO_RETAILERS.includes('Watsons')

  // ── derived data ────────────────────────────────────────────────────────────
  const periods = useMemo(() => {
    return (PROMO_META[retailer]?.periods || []).map((p, i) => ({ ...p, idx: i, isCurrent: periodIsCurrent(p) }))
  }, [retailer])

  const currentIdx = useMemo(() => periods.findIndex(p => p.isCurrent), [periods])

  const allItems = useMemo(() => {
    const raw = promoData.filter(p => p.retailer === retailer)
    return enrich(raw, rawData)
  }, [retailer, rawData])

  const brandList = useMemo(() => [...new Set(allItems.map(i => i.brand))].filter(Boolean).sort(), [allItems])

  // brand → company / promo-item count for the shared BrandCategoryFilter pills
  const brandCompany = useMemo(() => {
    const m = {}
    allItems.forEach(i => { if (!m[i.brand]) m[i.brand] = i.company })
    return m
  }, [allItems])
  const brandCounts = useMemo(() => {
    const m = {}
    allItems.forEach(i => { m[i.brand] = (m[i.brand] || 0) + 1 })
    return m
  }, [allItems])

  const items = useMemo(() => {
    if (!brandFilter.length) return allItems
    return allItems.filter(i => brandFilter.includes(i.brand))
  }, [allItems, brandFilter])

  const grouped = useMemo(() => {
    const g = {}
    items.forEach(i => { (g[i.brand] = g[i.brand] || []).push(i) })
    return Object.entries(g)
  }, [items])

  // ── Calendar Pulse / Spotlight memos ─────────────────────────────────────────
  // Plan-window month axis: one shared percentage coordinate system (start/end
  // dates → 0–100%) reused for axis month columns, the NOW line and every bar's
  // left/width. "Full year" spans the full available period range; "3 months"
  // and "6 months" are a fixed window from the start of the current month.
  const [planWindow, setPlanWindow] = useState('6m')

  const fullRange = useMemo(() => {
    const drs = periods.map(p => parseDR(p.dateRange) || inferPeriodDate(p)).filter(Boolean)
    if (!drs.length) {
      return { start: new Date(TODAY.getFullYear(), TODAY.getMonth(), 1), end: new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 0, 23, 59, 59, 999) }
    }
    const minS = new Date(Math.min(...drs.map(d => d.s.getTime())))
    const maxE = new Date(Math.max(...drs.map(d => d.e.getTime())))
    return { start: new Date(minS.getFullYear(), minS.getMonth(), 1), end: maxE }
  }, [periods])

  const pulseRange = useMemo(() => {
    if (planWindow === 'full') return { ...fullRange, totalMs: fullRange.end.getTime() - fullRange.start.getTime() }
    const months = planWindow === '3m' ? 3 : 6
    const start = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1)
    const end = new Date(start.getFullYear(), start.getMonth() + months, 0, 23, 59, 59, 999)
    return { start, end, totalMs: end.getTime() - start.getTime() }
  }, [planWindow, fullRange])

  // Month columns spanning the active window — each cell is `left/width: X%` of
  // the same coordinate system pulseBarPos() below uses for the bars.
  const pulseWeeks = useMemo(() => {
    const { start, end, totalMs } = pulseRange
    const cols = []
    let cur = new Date(start.getFullYear(), start.getMonth(), 1)
    let i = 0
    while (cur <= end) {
      const mStart = new Date(Math.max(cur.getTime(), start.getTime()))
      const mEndRaw = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59, 999)
      const mEnd = new Date(Math.min(mEndRaw.getTime(), end.getTime()))
      const left = (mStart.getTime() - start.getTime()) / totalMs * 100
      const width = Math.max(0, (mEnd.getTime() - mStart.getTime()) / totalMs * 100)
      const isNow = cur.getFullYear() === TODAY.getFullYear() && cur.getMonth() === TODAY.getMonth()
      cols.push({
        idx: i, start: mStart, end: mEnd, left, width, isNow,
        label: MONTH_NAMES[cur.getMonth()],
        dateLabel: String(cur.getFullYear()),
      })
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
      i++
    }
    return cols
  }, [pulseRange])

  // NOW position as 0–100% across the active window
  const nowPct = useMemo(() => {
    const pct = (TODAY.getTime() - pulseRange.start.getTime()) / pulseRange.totalMs * 100
    return Math.max(0, Math.min(100, pct))
  }, [pulseRange])

  // Spotlight: products in current / next / past periods
  const spotLive = useMemo(() => {
    if (currentIdx < 0) return []
    const pName = periods[currentIdx]?.name
    if (!pName) return []
    return items
      .filter(it => it.periods?.[pName])
      .map(it => ({ ...it, pd: it.periods[pName], offPct: offPctOf(it, it.periods[pName]) }))
      .sort((a, b) => (b.offPct || 0) - (a.offPct || 0))
  }, [items, periods, currentIdx])

  // Next period: the one after current, or — when no period is current — the first
  // period whose start date is still in the future (not blindly periods[0])
  const nextIdx = useMemo(() => {
    if (currentIdx >= 0) return currentIdx + 1 < periods.length ? currentIdx + 1 : -1
    return periods.findIndex(p => {
      const r = parseDR(p.dateRange) || inferPeriodDate(p)
      return r && r.s > TODAY
    })
  }, [periods, currentIdx])

  const spotNext = useMemo(() => {
    const pName = nextIdx >= 0 ? periods[nextIdx]?.name : null
    if (!pName) return []
    return items
      .filter(it => it.periods?.[pName])
      .map(it => ({ ...it, pd: it.periods[pName], offPct: offPctOf(it, it.periods[pName]) }))
      .sort((a, b) => (b.offPct || 0) - (a.offPct || 0))
  }, [items, periods, nextIdx])

  const spotEnded = useMemo(() => {
    const cutoff = currentIdx >= 0 ? currentIdx : periods.length
    const pastNames = periods.slice(0, cutoff).map(p => p.name)
    if (!pastNames.length) return []
    const seen = new Set()
    return items
      .flatMap(it =>
        pastNames
          .filter(n => it.periods?.[n])
          .slice(-2) // at most 2 most recent ended periods per product
          .map(n => ({ ...it, pd: it.periods[n], offPct: offPctOf(it, it.periods[n]), periodName: n }))
      )
      .filter(it => { const k = it.barcode + it.periodName; if (seen.has(k)) return false; seen.add(k); return true })
      .sort((a, b) => (b.offPct || 0) - (a.offPct || 0))
      .slice(0, 30)
  }, [items, periods, currentIdx])

  // Spotlight Ended: grouped by period name for tree view
  const endedGrouped = useMemo(() => {
    const groups = {}
    spotEnded.forEach(it => {
      if (!groups[it.periodName]) groups[it.periodName] = []
      groups[it.periodName].push(it)
    })
    return Object.entries(groups)
      .sort(([a], [b]) => {
        const ia = periods.findIndex(p => p.name === a)
        const ib = periods.findIndex(p => p.name === b)
        return ib - ia
      })
      .map(([periodName, pItems]) => {
        const period = periods.find(p => p.name === periodName)
        const dr = parseDR(period?.dateRange || '') || inferPeriodDate(period || {})
        const dateDisplay = period?.dateRange || (dr ? `${MONTH_NAMES[dr.s.getMonth()]} ${dr.s.getFullYear()}` : period?.name || '')
        return { periodName, dateDisplay, items: pItems }
      })
  }, [spotEnded, periods])

  // Spotlight Live/Next: grouped by brand for tree view
  const liveGrouped = useMemo(() => {
    const g = {}
    spotLive.forEach(it => { (g[it.brand] = g[it.brand] || []).push(it) })
    return Object.entries(g).sort((a, b) => b[1].length - a[1].length)
  }, [spotLive])

  const nextGrouped = useMemo(() => {
    const g = {}
    spotNext.forEach(it => { (g[it.brand] = g[it.brand] || []).push(it) })
    return Object.entries(g).sort((a, b) => b[1].length - a[1].length)
  }, [spotNext])

  // Progress of the current period (0–100%)
  const periodProgress = useMemo(() => {
    if (currentIdx < 0) return null
    const p = periods[currentIdx]
    if (!p) return null
    const dr = parseDR(p.dateRange) || inferPeriodDate(p)
    if (!dr) return null
    const pct = (TODAY.getTime() - dr.s.getTime()) / (dr.e.getTime() - dr.s.getTime()) * 100
    const dateLabel = p.dateRange || (dr ? `${MONTH_NAMES[dr.s.getMonth()]} ${dr.s.getFullYear()}` : '')
    return { name: p.name, dateRange: dateLabel, pct: Math.max(0, Math.min(100, pct)) }
  }, [periods, currentIdx])

  // per-period activity dots (union across all items in that period)
  const actsByPeriod = useMemo(() => {
    const m = {}
    items.forEach(it => {
      Object.entries(it.periods || {}).forEach(([k, pd]) => {
        if (pd.activities?.length) m[k] = [...new Set([...(m[k] || []), ...pd.activities])]
      })
    })
    return m
  }, [items])

  // ── helpers ─────────────────────────────────────────────────────────────────
  const neon = c => dark ? c : (NEON_DEEP[c] || c)
  const gpColor = gp => gp == null ? t.muted : gp >= 0.30 ? t.green : gp >= 0.20 ? t.yellow : t.red
  const coColor = c => c === 'Vcan' ? t.vcanClr : t.moolaClr
  const priceTxt = pd => pd.salePrice != null ? '฿' + pd.salePrice.toLocaleString('th-TH') : (pd.saleLabel || '')
  const off = offPctOf

  // Bar color: driven by activity type, with clearance override.
  // No-activity promos get an ice-silver frosted-glass pill (txt = theme text),
  // not the old gold gradient.
  // Bar backgrounds are OPAQUE (alpha gradient layered over a solid base) so the
  // NOW glowline can never bleed through the pill text.
  const barBase = dark ? '#0d1117' : '#f4efe9'
  const getBarStyle = (activities, clearance, branch) => {
    if (clearance) { const c = neon(CLEAR_COLOR); return { bg: `linear-gradient(135deg,${c}e8,${c}99), ${barBase}`, clr: c, txt: '#fff' } }
    for (const a of (activities || [])) {
      if (ACT[a]) { const c = neon(ACT[a].color); return { bg: `linear-gradient(135deg,${c}e8,${c}99), ${barBase}`, clr: c, txt: '#fff' } }
    }
    if (branch) { const c = branchClr; return { bg: `linear-gradient(135deg,${c}e0,${c}90), ${barBase}`, clr: c, txt: '#fff', branch: true } }
    return {
      bg: dark ? '#1c2630' : '#fbf9f5',
      clr: dark ? '#a8c5da' : '#8fa9bd',
      txt: t.text, ice: true,
    }
  }

  // Bar position clipped to the active plan window; uses inferPeriodDate for empty dateRange
  const pulseBarPos = p => {
    const dr = parseDR(p.dateRange) || inferPeriodDate(p)
    if (!dr) return null
    const { start, end, totalMs } = pulseRange
    const barStart = Math.max(dr.s.getTime(), start.getTime())
    const barEnd   = Math.min(dr.e.getTime(), end.getTime())
    if (barEnd <= barStart) return null
    const left  = (barStart - start.getTime()) / totalMs * 100
    const width = (barEnd - barStart) / totalMs * 100
    return { left: Math.max(0, left), width: Math.max(0.5, width) }
  }

  // Open the product popup with the full master record (promo items lack the
  // retailers map / status fields the popup needs — passing them raw crashes it)
  const openProduct = it => {
    const m = rawData?.find(r => r.barcode === it.barcode)
    onSelect?.(m || { retailers: {}, status: '', rsp: it.rspIncVat ?? null, packSize: '', ...it })
  }

  const toggleBrand = b => setBrandFilter(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])
  const toggleChip = (key, e) => { e.stopPropagation(); setOpenKey(prev => prev === key ? null : key) }

  const submitPin = e => {
    e.preventDefault()
    const dept = DEPT_PINS[pin]
    if (dept) { setUnlocked(dept); setPin(''); setPinErr(false); logPricingAccess(dept, `Promotion Plan · ${retailer}`) }
    else { setPinErr(true); setPin('') }
  }

  // ── theme shorthands ─────────────────────────────────────────────────────────
  const s = t.surface, s2 = t.surface2, bdr = t.border, dim = t.dim, tx = t.text, mu = t.muted
  const nowBg = dark ? 'rgba(212,168,106,.10)' : 'rgba(156,107,53,.08)'
  const nowLine = t.accent
  // discontinued ("ยกเลิกขาย") band tint + branch-exclusive (K.Village) green
  const disconBg = dark ? 'rgba(248,81,73,.09)' : 'rgba(220,38,38,.06)'
  const disconClr = t.red
  const branchClr = dark ? '#4ade80' : '#16a34a'
  const disconIdxOf = it => it.disconFrom ? periods.findIndex(pp => pp.name === it.disconFrom) : -1

  // ── sub-components ───────────────────────────────────────────────────────────
  function ActDots({ acts, size = 5 }) {
    return acts.map(a => ACT[a] ? (
      <i key={a} className="ps-chip-dot" title={ACT[a].label}
        style={{ background: neon(ACT[a].color), boxShadow: `0 0 4px -1px ${neon(ACT[a].color)}`, width: size, height: size }} />
    ) : null)
  }

  // Shared background layer for every Pulse track (the week axis strip AND each
  // product lane) — week gridlines + alternating tint + the NOW line. Every
  // position here is `left: X%` sourced from pulseWeeks / nowPct, the exact same
  // numbers pulseBarPos() below uses to place the bars — one coordinate system,
  // so the axis, the gridlines and the NOW line can never drift apart.
  function PulseTrackBg() {
    return (
      <>
        {pulseWeeks.map((w, i) => (
          <div key={i} className="ps-sched-gridcol ps-pulse-week-col" style={{
            left: `${w.left}%`, width: `${w.width}%`,
            borderLeft: i === 0 ? 'none' : `1px solid ${dim}`,
            background: w.isNow ? nowBg : (i % 2 === 1 ? (dark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)') : 'transparent'),
          }} />
        ))}
        <div className="ps-sched-nowline" style={{ left: `${nowPct}%`, background: GOLD_A, boxShadow: `0 0 7px 1px ${GOLD_A}cc, 0 0 15px 2px ${GOLD_A}55` }} />
      </>
    )
  }

  // Grid view — unchanged period-column matrix
  function Calendar() {
    return (
      <div className="ps-cal-scroll" style={{ scrollbarColor: `${bdr} transparent` }}>
        <div className="ps-cal-inner" style={{ position: 'relative' }}>
          {/* header */}
          <div className="ps-cal-head" style={{
            background: dark ? 'rgba(33,38,45,.72)' : 'rgba(251,248,243,.7)',
            backdropFilter: 'blur(12px) saturate(1.4)', WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
            borderBottom: `1px solid ${bdr}` }}>
            <div className="ps-cal-rh" style={{ background: s2, borderRight: `1px solid ${bdr}`, color: mu }}>Product</div>
            {periods.map((p, i) => {
              const isNow = i === currentIdx
              const acts = actsByPeriod[p.name] || []
              return (
                <div key={p.name} className={`ps-cal-ph${isNow ? ' ps-now-ph' : ''}`}
                  style={{ background: isNow ? nowBg : 'transparent', borderLeft: `1px solid ${dim}`,
                    boxShadow: isNow ? `inset 2px 0 0 ${nowLine}, inset -2px 0 0 ${nowLine}, inset 0 2px 0 ${nowLine}` : 'none' }}>
                  <div className="ps-cal-ph-code" style={{ color: isNow ? t.accent : tx }}>{periodLabel(p.name)}</div>
                  {p.dateRange && <div className="ps-cal-ph-rng" style={{ color: mu }}>{p.dateRange}</div>}
                  {isNow ? <div className="ps-now-tag" style={{ background: GOLD_GRAD, color: '#fff' }}>NOW</div>
                    : (() => { const r = parseDR(p.dateRange) || inferPeriodDate(p); const d = r && Math.ceil((r.s - TODAY) / 86400000); return d > 0 ? <div style={{ fontSize: 9, color: GOLD_A, fontWeight: 700, marginTop: 2 }}>in {d}d</div> : <div className="ps-cal-ph-caps">{acts.map(a => ACT[a] && <i key={a} style={{ width: 6, height: 6, borderRadius: 99, background: neon(ACT[a].color), boxShadow: `0 0 4px -1px ${neon(ACT[a].color)}` }} />)}</div> })()}
                </div>
              )
            })}
          </div>

          {/* rows */}
          {grouped.map(([brand, list]) => (
            <div key={brand}>
              <div className="ps-cal-band" style={{ background: `color-mix(in srgb, ${coColor(list[0].company) || t.accent} 7%, ${s2})`, borderBottom: `1px solid ${bdr}`, borderTop: `1px solid ${bdr}` }}>
                <MonogramTile brand={brand} company={list[0].company} t={t} size="s" />
                <span className="ps-cal-band-name" style={{ color: coColor(list[0].company) || t.accent }}>{brand}</span>
                <span className="ps-cal-band-count" style={{ color: mu }}>{list.length} SKU{list.length > 1 ? 's' : ''}</span>
              </div>
              {list.map(it => (
                <div key={it.barcode} className="ps-cal-row" style={{ borderColor: dim, background: dark ? 'rgba(255,255,255,.015)' : 'rgba(255,255,255,.28)' }}>
                  <div className="ps-cal-rail" style={{ background: s, borderRight: `1px solid ${bdr}` }} onClick={() => openProduct(it)}>
                    <div className="ps-cal-rail-name" style={{ color: tx }}>{it.product}</div>
                    <div className="ps-cal-rail-sub">
                      <span className="ps-cal-rail-rsp" style={{ color: mu }}>RSP ฿{it.rspIncVat}</span>
                      {canSeeGP && <span className="ps-cal-rail-gp" style={{ color: gpColor(it.gp) }}>GP {Math.round(it.gp * 100)}%</span>}
                      {it.clearance && <span className="ps-cal-rail-tag" style={{ color: neon(CLEAR_COLOR), background: `${neon(CLEAR_COLOR)}22` }}>CLEAR</span>}
                    </div>
                  </div>
                  {periods.map((p, i) => {
                    const pd = it.periods?.[p.name]
                    const isNow = i === currentIdx
                    const prim = (pd?.activities || []).find(a => ACT[a])
                    const mc = prim ? neon(ACT[prim].color) : it.clearance ? neon(CLEAR_COLOR) : t.accent
                    const ckey = it.barcode + '|' + p.name
                    const pctOff = off(it, pd)
                    const nowEdge = isNow ? `inset 2px 0 0 ${nowLine}, inset -2px 0 0 ${nowLine}` : 'none'
                    const di = disconIdxOf(it)
                    const isDiscon = di >= 0 && i >= di
                    if (!pd) return (
                      <div key={p.name} className="ps-cal-cell ps-cal-cell-empty"
                        style={{ borderLeft: `1px solid ${dim}`, background: isDiscon ? disconBg : (isNow ? nowBg : 'transparent'), boxShadow: nowEdge, color: mu }}>
                        {isDiscon && i === di && (
                          <span style={{ fontSize: 9, fontWeight: 800, color: disconClr, background: `${disconClr}1e`, border: `1px solid ${disconClr}44`, borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap' }}>ยกเลิกขาย</span>
                        )}
                      </div>
                    )
                    return (
                      <div key={p.name} className={`ps-cal-cell${isNow ? ' ps-now-cell' : ''}`}
                        style={{ borderLeft: `1px solid ${dim}`, background: isDiscon ? disconBg : (isNow ? nowBg : 'transparent'),
                          boxShadow: nowEdge }}>
                        <span className="ps-chip" onClick={e => toggleChip(ckey, e)}
                          style={{ background: (prim || it.clearance) ? `color-mix(in srgb, ${mc} ${dark ? 16 : 24}%, ${s2})`
                              : pd.branchExclusive ? `color-mix(in srgb, ${branchClr} ${dark ? 14 : 20}%, ${s2})`
                              : dark ? 'rgba(203,225,243,.10)' : 'rgba(255,255,255,.72)',
                            border: `1px solid ${(prim || it.clearance) ? mc + '88' : pd.branchExclusive ? branchClr + '88' : (dark ? 'rgba(168,197,218,.4)' : 'rgba(143,169,189,.45)')}`,
                            boxShadow: (prim || it.clearance) ? `0 0 8px -4px ${mc}` : 'none' }}>
                          {pctOff != null && pctOff > 0 && <span className="ps-tip">−{pctOff}%</span>}
                          <span className="ps-chip-pr" style={{ color: tx }}>{priceTxt(pd)}</span>
                          {pd.branchExclusive && (
                            <span title="เฉพาะสาขาเควิลเลจ (K.Village only)" style={{ fontSize: 8, fontWeight: 800, color: branchClr, background: `${branchClr}22`, border: `1px solid ${branchClr}55`, borderRadius: 4, padding: '1px 4px', letterSpacing: '.02em', lineHeight: 1.3 }}>K.Village</span>
                          )}
                          {openKey === ckey && pctOff != null && pctOff > 0 && <span className="ps-chip-off">−{pctOff}%</span>}
                          {openKey === ckey && canSeeGP && pd.compensate != null && (
                            <span style={{ fontSize: 9, fontFamily: 'monospace', color: t.blue || '#58a6ff', fontWeight: 700 }}>฿{pd.compensate.toFixed(2)}</span>
                          )}
                          {(pd.activities || []).length > 0 && <span className="ps-chip-dots"><ActDots acts={pd.activities} size={5} /></span>}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Calendar Pulse view — proportional bars over a fixed six-week window
  // (this week + the five that follow). The axis strip AND every product
  // lane render their gridlines/tint/NOW-line via the shared PulseTrackBg()
  // using pulseWeeks / nowPct — the identical % numbers pulseBarPos() below
  // uses to place the bars. Everything lives inside the same width:100%
  // `.ps-sched-track` box (an axis variant included), so there is no
  // cross-container DOM measurement anywhere in this view and nothing can
  // drift out of alignment. Empty capacity is left as plain whitespace —
  // no placeholder slots, no second grid.
  function CalendarPulse() {
    return (
      <>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px',
          borderBottom: `1px solid ${bdr}`, flexWrap: 'wrap',
          background: dark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.02)',
        }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: mu, textTransform: 'uppercase', letterSpacing: '.08em' }}>Calendar</span>
          <div style={{ display: 'flex', gap: 4, background: s2, border: `1px solid ${bdr}`, borderRadius: 8, padding: 2 }}>
            {[['3m', '3 months'], ['6m', '6 months'], ['full', 'Full year']].map(([k, l]) => (
              <button key={k} onClick={() => setPlanWindow(k)} className={`ps-glow${planWindow === k ? ' ps-glow-on' : ''}`} style={{
                '--g': GOLD_A,
                fontSize: 10.5, fontWeight: 700, padding: '4px 10px', borderRadius: 6, fontFamily: 'inherit',
                background: planWindow === k ? `${GOLD_A}22` : 'none',
                color: planWindow === k ? (dark ? GOLD_A : GOLD_B) : mu,
                border: planWindow === k ? `1px solid ${GOLD_A}66` : '1px solid transparent',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>{l}</button>
            ))}
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: mu, fontStyle: 'italic' }}>hover bars for details</span>
        </div>
        <div className="ps-sched-scroll" style={{ scrollbarColor: `${bdr} transparent`, overflow: 'auto', maxHeight: '70vh' }}
          onMouseLeave={() => setBarTip(null)}>
          <div className="ps-sched-inner" style={{ minWidth: planWindow === 'full' ? Math.max(900, periods.length * 62 + 252) : planWindow === '6m' ? 1100 : 900 }}>

            {/* Week axis — frosted glass over scrolling rows. Gridlines, week tint
                and the NOW line/tag are all painted by PulseTrackBg — same math as
                every row's track below it, so the axis can never drift from the rows. */}
            <div className="ps-sched-axis" style={{
              background: dark ? 'rgba(33,38,45,.72)' : 'rgba(251,248,243,.7)',
              backdropFilter: 'blur(12px) saturate(1.4)', WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
              borderBottom: `1px solid ${bdr}` }}>
              <div className="ps-sched-axis-lead" style={{ background: s2, borderRight: `1px solid ${bdr}` }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: mu }}>Product</span>
              </div>
              <div className="ps-sched-months ps-pulse-weeks">
                <div className="ps-sched-track ps-sched-track--axis ps-pulse-track">
                  <PulseTrackBg />
                  {pulseWeeks.map((w, i) => (
                    <div key={i} className={`ps-sched-month-lbl ps-pulse-week-lbl${w.isNow ? ' ps-pulse-week-lbl--live' : ''}`} style={{ left: `${w.left}%`, width: `${w.width}%` }}>
                      <b style={{ color: w.isNow ? t.accent : tx }}>{w.label}</b>
                      <small style={{ color: w.isNow ? t.accent + 'bb' : mu }}>{w.dateLabel}</small>
                    </div>
                  ))}
                  <div className="ps-sched-now-tag" style={{ left: `${nowPct}%`, background: GOLD_GRAD }}>TODAY</div>
                </div>
              </div>
            </div>

            {/* Brand + product rows */}
            {grouped.map(([brand, list]) => (
              <div key={brand}>
                {/* Brand header */}
                <div className="ps-sched-brand-hdr" style={{
                  borderLeft: `3px solid ${coColor(list[0].company) || t.accent}`,
                  background: dark ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.02)',
                  borderBottom: `1px solid ${dim}`, borderTop: `1px solid ${bdr}`,
                }}>
                  <MonogramTile brand={brand} company={list[0].company} t={t} size="s" />
                  <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: coColor(list[0].company) || t.accent }}>{brand}</span>
                  <span style={{ fontSize: 10.5, color: mu }}>{list.length} SKU{list.length > 1 ? 's' : ''}</span>
                  <span style={{ fontSize: 10, color: mu, marginLeft: 4 }}>{list[0].company}</span>
                </div>

                {/* Product rows */}
                {list.map(it => {
                  const discontinued = disconIdxOf(it) >= 0
                  return (
                  <div key={it.barcode} className="ps-sched-row" style={{ borderColor: dim, background: dark ? 'rgba(255,255,255,.015)' : 'rgba(255,255,255,.28)' }}>
                    {/* Left sticky panel */}
                    <div className="ps-sched-lead" style={{ background: s, borderRight: `1px solid ${bdr}` }}
                      onClick={() => openProduct(it)}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: tx, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.product}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <span style={{ fontSize: 13, fontFamily: 'ui-monospace,monospace', fontWeight: 800, color: dark ? GOLD_A : GOLD_B, background: `${GOLD_A}18`, borderRadius: 4, padding: '2px 5px' }}>RSP ฿{it.rspIncVat}</span>
                        {canSeeGP && <span style={{ fontSize: 10, fontFamily: 'ui-monospace,monospace', fontWeight: 700, color: gpColor(it.gp) }}>GP {Math.round(it.gp * 100)}%</span>}
                        {it.clearance && <span style={{ fontSize: 8.5, fontWeight: 800, color: neon(CLEAR_COLOR), background: `${neon(CLEAR_COLOR)}22`, borderRadius: 4, padding: '1px 5px', letterSpacing: '.04em' }}>CLEAR</span>}
                        {discontinued && <span className="ps-pulse-attention ps-pulse-lead-tag" style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '.04em' }}>ยกเลิกขาย</span>}
                      </div>
                    </div>

                    {/* Proportional Pulse lane — empty capacity is plain whitespace */}
                    <div className="ps-sched-lane">
                      <div className="ps-sched-track" onMouseLeave={() => setBarTip(null)}>
                        <PulseTrackBg />
                        {periods.map(p => {
                          const pd = it.periods?.[p.name]
                          if (!pd) return null
                          const pos = pulseBarPos(p)
                          if (!pos) return null
                          const bs = getBarStyle(pd.activities, it.clearance, pd.branchExclusive)
                          const offPct = offPctOf(it, pd)
                          const dr = parseDR(p.dateRange) || inferPeriodDate(p)
                          const dateDisplay = p.dateRange || (dr ? `${MONTH_NAMES[dr.s.getMonth()]} ${dr.s.getFullYear()}` : '')
                          const multiAct = (pd.activities || []).length > 1
                          const isLive = !!p.isCurrent
                          const daysLeft = dr ? Math.ceil((dr.e.getTime() - TODAY.getTime()) / 86400000) : null
                          const isAttention = isLive && daysLeft != null && daysLeft <= 3
                          const isUnassigned = !!bs.ice
                          const statusCls = `${isLive ? ' ps-pulse-live' : ''}${isAttention ? ' ps-pulse-attention' : ''}${isUnassigned ? ' ps-pulse-unassigned' : ''}`
                          return (
                            <div key={p.name} className={`ps-sched-bar${statusCls}`}
                              style={{ left: `${pos.left}%`, width: `${pos.width}%`, background: bs.bg,
                                border: `1px solid ${bs.clr}${bs.ice ? '66' : '55'}`,
                                boxShadow: `inset 0 1px 0 rgba(255,255,255,.3), 0 0 7px ${bs.clr}66, 0 0 16px -3px ${bs.clr}` }}
                              onMouseEnter={e => setBarTip({
                                x: e.clientX, y: e.clientY,
                                brand: it.brand, product: it.product,
                                period: p.name, dates: dateDisplay,
                                price: priceTxt(pd), rsp: `฿${it.rspIncVat}`,
                                offPct, color: bs.clr,
                                activities: pd.activities || [],
                                clearance: it.clearance,
                                branch: pd.branchExclusive,
                                unassigned: isUnassigned,
                                live: isLive,
                                attention: isAttention,
                              })}
                              onMouseLeave={e => { e.stopPropagation(); setBarTip(null) }}
                              onMouseMove={e => setBarTip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                            >
                              {/* min-width on .ps-sched-bar guarantees room, so the price
                                  always shows — bars stay identifiable as compact blocks even
                                  on the widest (Full year) window. Unassigned status is conveyed
                                  by the ice-pill styling, legend and hover tooltip, not bar text. */}
                              <span className="ps-sched-bar-txt"
                                style={bs.ice ? { color: bs.txt, textShadow: 'none' } : undefined}>{priceTxt(pd)}</span>
                              {pos.width >= 3 && offPct != null && offPct > 0 && (
                                <span className="ps-sched-bar-off" style={bs.ice ? { color: bs.txt } : undefined}>−{offPct}%</span>
                              )}
                              {multiAct && pos.width >= 4 && (
                                <span className="ps-sched-bar-dots"><ActDots acts={pd.activities} size={4.5} /></span>
                              )}
                              {pd.branchExclusive && pos.width >= 3 && (
                                <span style={{ fontSize: 8.5, fontWeight: 800, color: '#fff', background: 'rgba(0,0,0,.28)', borderRadius: 4, padding: '0 4px', marginLeft: 2, whiteSpace: 'nowrap' }}>K.Village</span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  )
                })}
              </div>
            ))}

          </div>
        </div>
      </>
    )
  }

  // Reusable feed card for Spotlight (compact, brand shown in parent header).
  // `ended` = past promo: use a more opaque card + full-contrast text so the
  // history stays clearly legible instead of fading into the background.
  function FeedCard({ it, ended }) {
    const bs = getBarStyle(it.pd?.activities, it.clearance, it.pd?.branchExclusive)
    const prClr = ended ? tx : (bs.ice ? tx : bs.clr)
    return (
      <div onClick={() => openProduct(it)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
          background: ended ? (dark ? 'rgba(255,255,255,.07)' : 'rgba(255,255,255,.78)')
                            : (dark ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.58)'),
          backdropFilter: 'blur(10px) saturate(1.35)', WebkitBackdropFilter: 'blur(10px) saturate(1.35)',
          border: `1px solid ${ended ? bdr : `${bs.clr}33`}`,
          borderLeft: `3px solid ${bs.clr}`,
          borderRadius: 9, cursor: 'pointer', transition: 'filter .14s, box-shadow .18s',
        }}
        onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(1.06)'; e.currentTarget.style.boxShadow = `0 0 16px -6px ${bs.clr}` }}
        onMouseLeave={e => { e.currentTarget.style.filter = ''; e.currentTarget.style.boxShadow = '' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{it.product}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <span style={{ fontSize: 10.5, color: ended ? tx : mu, fontWeight: 600 }}>RSP ฿{it.rspIncVat}</span>
            {it.clearance && <span style={{ fontSize: 9, fontWeight: 800, color: neon(CLEAR_COLOR) }}>CLEAR</span>}
            {it.pd?.branchExclusive && <span title="เฉพาะสาขาเควิลเลจ" style={{ fontSize: 8.5, fontWeight: 800, color: branchClr, background: `${branchClr}22`, border: `1px solid ${branchClr}55`, borderRadius: 4, padding: '0 4px' }}>K.Village</span>}
            {(it.pd?.activities || []).map(a => ACT[a] ? (
              <i key={a} style={{ width: 6, height: 6, borderRadius: 99, background: neon(ACT[a].color), display: 'inline-block', flexShrink: 0 }} />
            ) : null)}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'ui-monospace,monospace', color: prClr, lineHeight: 1.1 }}>{priceTxt(it.pd)}</div>
          {it.offPct != null && it.offPct > 0 && (
            <div style={{ fontSize: 10.5, fontWeight: 700, color: ended ? (dark ? GOLD_A : GOLD_B) : (bs.ice ? mu : bs.clr) }}>−{it.offPct}%</div>
          )}
        </div>
      </div>
    )
  }

  // Brand group header for Spotlight tree view
  function BrandGroupHdr({ brand, items }) {
    const company = items[0]?.company || ''
    const clr = coColor(company) || GOLD_A
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '6px 12px', marginBottom: 6,
        background: `${clr}0d`,
        border: `1px solid ${clr}22`, borderLeft: `3px solid ${clr}`,
        borderRadius: '0 7px 7px 0',
      }}>
        <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', color: clr }}>{brand}</span>
        {company && <span style={{ fontSize: 10, color: mu }}>{company}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: mu, fontFamily: 'ui-monospace,monospace' }}>
          {items.length} SKU{items.length > 1 ? 's' : ''}
        </span>
      </div>
    )
  }

  // Spotlight view — live feed: Live Now / Next Up / Ended tabs
  function Spotlight() {
    const liveOffs = spotLive.filter(i => i.offPct > 0)
    const avgOff = liveOffs.length ? Math.round(liveOffs.reduce((a, i) => a + i.offPct, 0) / liveOffs.length) : null
    const nextDate = nextIdx >= 0 ? (periods[nextIdx]?.dateRange || periods[nextIdx]?.name || '') : ''
    // Status tiles — structured hierarchy (label / big count / period dates),
    // double as the Live/Next/Ended tabs. Active tile lights up like a neon sign.
    const tiles = [
      { key: 'live', label: 'Live now', count: spotLive.length, c: t.green, pulse: true,
        sub: periodProgress ? `${periodProgress.dateRange}${avgOff != null ? ` · −${avgOff}% avg` : ''}` : 'no active period' },
      { key: 'next', label: 'Next up', count: spotNext.length, c: t.blue || '#58a6ff',
        sub: nextDate || 'no upcoming period' },
      { key: 'ended', label: 'Ended', count: spotEnded.length, c: dark ? GOLD_A : GOLD_B,
        sub: 'recent past periods' },
    ]
    return (
      <div style={{ padding: isMobile ? '12px 14px' : '16px 20px' }}>

        {/* Status tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
          {tiles.map(({ key, label, count, c, sub, pulse }) => {
            const isActive = spotTab === key
            return (
              <button key={key} onClick={() => setSpotTab(key)} className={`ps-glow${isActive ? ' ps-glow-on' : ''}`}
                style={{
                  '--g': c, textAlign: 'left', padding: isMobile ? '9px 10px' : '11px 14px', borderRadius: 12,
                  cursor: 'pointer', fontFamily: 'inherit',
                  border: `1.5px solid ${isActive ? c : bdr}`,
                  background: isActive ? `${c}16` : (dark ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.5)'),
                  backdropFilter: 'blur(10px) saturate(1.35)', WebkitBackdropFilter: 'blur(10px) saturate(1.35)',
                  transition: 'border-color .15s, background .15s',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={pulse && isActive ? 'ps-pulse' : ''} style={{ width: 7, height: 7, borderRadius: 99, flexShrink: 0,
                    background: isActive ? c : mu, boxShadow: isActive ? `0 0 8px ${c}` : 'none' }} />
                  <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: isActive ? c : mu }}>{label}</span>
                </div>
                <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, fontFamily: 'ui-monospace,monospace', lineHeight: 1.25,
                  color: isActive ? c : tx, textShadow: isActive ? `0 0 16px ${c}66` : 'none' }}>{count}</div>
                <div style={{ fontSize: 9.5, color: mu, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
              </button>
            )
          })}
        </div>

        {/* Period progress bar */}
        {periodProgress ? (
          <div style={{ padding: '10px 14px',
            background: dark ? 'rgba(255,255,255,.045)' : 'rgba(255,255,255,.55)',
            backdropFilter: 'blur(12px) saturate(1.4)', WebkitBackdropFilter: 'blur(12px) saturate(1.4)',
            border: `1px solid ${bdr}`, borderRadius: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: mu }}>Period {periodProgress.name} · {periodProgress.dateRange}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: t.accent }}>
                {periodProgress.pct >= 95 ? 'ends today' : `${Math.round(periodProgress.pct)}% through`}
              </span>
            </div>
            <div style={{ height: 5, background: dark ? 'rgba(0,0,0,.45)' : dim, borderRadius: 99, overflow: 'visible' }}>
              <div style={{ height: '100%', width: `${periodProgress.pct}%`, background: `linear-gradient(90deg,${GOLD_A},${GOLD_B})`, borderRadius: 99, transition: 'width .4s',
                boxShadow: `0 0 7px ${GOLD_A}aa, 0 0 16px -2px ${GOLD_A}66` }} />
            </div>
          </div>
        ) : (
          <div style={{ padding: '10px 14px', background: s2, border: `1px solid ${bdr}`, borderRadius: 10, marginBottom: 14, fontSize: 12, color: mu }}>
            ไม่มีช่วงโปรโมชันที่กำลังดำเนินอยู่ในขณะนี้
          </div>
        )}

        {/* Live Now / Next Up — brand tree view, 2-column grid per brand */}
        {spotTab !== 'ended' && (() => {
          const grouped = spotTab === 'live' ? liveGrouped : nextGrouped
          const emptyMsg = spotTab === 'live' ? 'ไม่มีโปรโมชันที่กำลังดำเนินอยู่' : 'ไม่มีโปรโมชันที่กำลังจะมาถึง'
          return grouped.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: mu, fontSize: 13 }}>{emptyMsg}</div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {grouped.map(([brand, items]) => (
                  <div key={brand}>
                    <BrandGroupHdr brand={brand} items={items} />
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 6, paddingLeft: isMobile ? 0 : 12 }}>
                      {items.map((it, idx) => <FeedCard key={it.barcode + idx} it={it} />)}
                    </div>
                  </div>
                ))}
              </div>
              {spotTab === 'live' && spotNext.length > 0 && (
                <div style={{ marginTop: 12, padding: '8px 14px', border: `1px dashed ${dim}`, borderRadius: 9, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: mu }}>
                  <span>↓ NEXT — {(nextIdx >= 0 && periods[nextIdx]?.dateRange) || 'coming soon'}{(() => { const np = nextIdx >= 0 ? periods[nextIdx] : null; const r = np && (parseDR(np.dateRange) || inferPeriodDate(np)); const d = r && Math.ceil((r.s - TODAY) / 86400000); return d > 0 ? <span style={{ color: GOLD_A, fontWeight: 700, marginLeft: 4 }}>· in {d}d</span> : null })()}</span>
                  <span style={{ color: dim }}>{[...new Set(spotNext.map(i => i.brand))].slice(0, 3).join(' · ')}</span>
                </div>
              )}
            </>
          )
        })()}

        {/* Ended — tree view grouped by period */}
        {spotTab === 'ended' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {endedGrouped.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: mu, fontSize: 13 }}>ไม่มีประวัติโปรโมชัน</div>
            )}
            {endedGrouped.map(group => (
              <div key={group.periodName}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 12px', marginBottom: 6,
                  background: dark ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.5)',
                  border: `1px solid ${bdr}`,
                  borderLeft: `3px solid ${GOLD_A}`, borderRadius: 9,
                }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: dark ? GOLD_A : GOLD_B, fontFamily: 'ui-monospace,monospace' }}>{group.periodName}</span>
                  {group.dateDisplay && <span style={{ fontSize: 10.5, color: dark ? mu : tx, fontWeight: 600 }}>{group.dateDisplay}</span>}
                  <span style={{ marginLeft: 'auto', fontSize: 10.5, color: mu }}>
                    {group.items.length} SKU{group.items.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 6, paddingLeft: isMobile ? 0 : 12 }}>
                  {group.items.map((it, idx) => <FeedCard key={it.barcode + idx} it={it} ended />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* customer select */}
      <div className="ps-pills">
        <span className="ps-label" style={{ color: mu }}>Customer</span>
        {CUSTOMERS.map(r => (
          <button key={r} onClick={() => { setRetailer(r); setBrandFilter([]) }} title={r}
            className={`ps-glow${retailer === r ? ' ps-glow-on' : ''}`} style={{
            '--g': GOLD_A,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: isMobile ? 66 : 86, height: isMobile ? 46 : 44,
            padding: '4px 6px', cursor: 'pointer', fontFamily: 'inherit',
            background: retailer === r ? `${GOLD_A}1e` : s2,
            border: `1.5px solid ${retailer === r ? GOLD_A : bdr}`,
            borderRadius: 10, transition: 'border-color .15s, background .15s',
          }}>
            {RetailerLogo
              ? <RetailerLogo name={r} h={isMobile ? 32 : 30} maxW={isMobile ? 52 : 72} dark={dark}
                  fallbackStyle={{ fontSize: 10, fontWeight: 700, color: retailer === r ? GOLD_A : tx, textAlign: 'center', lineHeight: 1.2 }} />
              : <span style={{ fontSize: 11, fontWeight: 700, color: retailer === r ? GOLD_A : tx }}>{r}</span>
            }
          </button>
        ))}
      </div>

      {/* brand filter — shared category navigator (passed from App.jsx) */}
      {!comingSoon && brandList.length > 0 && BrandCategoryFilter && (
        <div style={{ marginBottom: 12 }}>
          <BrandCategoryFilter idPrefix="ps-promo" brandList={brandList}
            selectedBrands={brandFilter} onToggle={toggleBrand} onClear={() => setBrandFilter([])}
            brandCompany={brandCompany} brandCounts={brandCounts} t={t} isMobile={isMobile} />
        </div>
      )}

      {/* toolbar: layout toggle + sub-toggle + activity legend + tools */}
      {!comingSoon && (
      <div className="ps-toolbar">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          {/* main view toggle */}
          <div className="ps-seg" style={{ background: s2, border: `1px solid ${bdr}` }}>
            {[['timeline', 'Timeline', IcoTimeline], ['grid', 'Grid', IcoGrid]].map(([k, l, Ico]) => (
              <button key={k} className={`ps-glow${layout === k ? ' on ps-glow-on' : ''}`} onClick={() => setLayout(k)} style={{
                '--g': GOLD_A,
                background: layout === k ? GOLD_GRAD : 'none',
                color: layout === k ? '#fff' : mu,
              }}><Ico size={13} />{l}</button>
            ))}
          </div>
          {/* sub-toggle — directly under main toggle when Timeline is selected */}
          {layout === 'timeline' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 3 }}>
              <span style={{ fontSize: 10.5, color: dim, fontWeight: 600 }}>view:</span>
              <div className="ps-seg" style={{ background: s2, border: `1px solid ${bdr}`, padding: 2 }}>
                {[['pulse','Calendar'], ['spotlight','Spotlight']].map(([k, l]) => (
                  <button key={k} className={`ps-glow${tlView === k ? ' on ps-glow-on' : ''}`} onClick={() => setTlView(k)} style={{
                    '--g': GOLD_A,
                    fontSize: 11.5, padding: '5px 12px',
                    background: tlView === k ? `${GOLD_A}22` : 'none',
                    color: tlView === k ? (dark ? GOLD_A : GOLD_B) : mu,
                    border: tlView === k ? `1px solid ${GOLD_A}66` : '1px solid transparent',
                    borderRadius: 7,
                  }}>{l}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 13, alignItems: 'center', flexWrap: 'wrap' }}>
          {Object.entries(ACT).filter(([k]) => k !== 'looks' || retailer === 'Tops').map(([k, a]) => (
            <span key={k} className="ps-actleg" style={{ color: mu }}>
              <span className="ps-actleg-dot" style={{ background: neon(a.color), boxShadow: `0 0 5px -1px ${neon(a.color)}` }} />
              {a.label}
            </span>
          ))}
          <span className="ps-actleg" style={{ color: mu }}>
            <span className="ps-actleg-dot" style={{ background: neon(CLEAR_COLOR), boxShadow: `0 0 5px -1px ${neon(CLEAR_COLOR)}` }} />
            เคลียร์สินค้า
          </span>
          <span className="ps-actleg" style={{ color: mu }}>
            <span className="ps-actleg-dot" style={{ background: dark ? '#1c2630' : '#fbf9f5', border: `1px solid ${dark ? '#a8c5da' : '#8fa9bd'}` }} />
            Promotion unassigned
          </span>
          <span className="ps-actleg ps-pulse-legend--live" style={{ color: mu }}>
            <span className="ps-actleg-dot ps-pulse-status-dot ps-pulse-status-dot--live" />
            Live / Active
          </span>
          <span className="ps-actleg ps-pulse-legend--attention" style={{ color: mu }}>
            <span className="ps-actleg-dot ps-pulse-status-dot ps-pulse-status-dot--attention" />
            Attention
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <button onClick={() => setCalcOpen(true)} className="ps-glow" style={{
            '--g': GOLD_A,
            display: 'inline-flex', alignItems: 'center', gap: 6, background: GOLD_GRAD, border: 'none',
            borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 700, padding: '7px 14px',
            cursor: 'pointer', fontFamily: 'inherit',
          }}><IcoCalc size={14} />Compensate Calc</button>
          {unlocked ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, color: t.green, background: `${t.green}22`, padding: '6px 11px', borderRadius: 8 }}>
              🔓 {unlocked}
              <span onClick={() => setUnlocked(null)} style={{ cursor: 'pointer', color: mu, marginLeft: 2 }}>✕</span>
            </span>
          ) : (
            <form onSubmit={submitPin} style={{ display: 'flex', alignItems: 'stretch', border: `1px solid ${pinErr ? t.red : bdr}`, borderRadius: 9, overflow: 'hidden', background: s2 }}>
              <input type="password" inputMode="numeric" maxLength={6} value={pin}
                onChange={e => { setPin(e.target.value); setPinErr(false) }}
                placeholder="PIN — unlock GP"
                style={{ width: isMobile ? 145 : 160, background: 'none', border: 0, outline: 0, color: tx, fontFamily: 'monospace', fontSize: 12, letterSpacing: 2, padding: '8px 11px' }} />
              <button type="submit" className="ps-glow" style={{ '--g': GOLD_A, border: 0, borderLeft: `1px solid ${bdr}`, background: s, color: mu, fontSize: 11, fontWeight: 700, padding: '0 12px', cursor: 'pointer', fontFamily: 'inherit' }}>Unlock</button>
            </form>
          )}
        </div>
      </div>
      )}

      {/* main card */}
      {comingSoon ? (
        <div style={{
          background: dark ? 'rgba(22,27,34,.6)' : 'rgba(251,248,243,.66)',
          backdropFilter: 'blur(16px) saturate(1.45)', WebkitBackdropFilter: 'blur(16px) saturate(1.45)',
          border: `1px solid ${dark ? bdr : 'rgba(255,255,255,.65)'}`,
          borderRadius: 12, overflow: 'hidden',
          boxShadow: dark ? '0 8px 28px rgba(0,0,0,.35)' : '0 8px 28px rgba(82,62,40,.10), inset 0 1px 0 rgba(255,255,255,.7)' }}>
          <div style={{ padding: isMobile ? '56px 0' : '80px 0', textAlign: 'center', color: mu, fontSize: 15, fontWeight: 600 }}>Coming soon</div>
        </div>
      ) : (
      <div style={{
        background: dark ? 'rgba(22,27,34,.6)' : 'rgba(251,248,243,.66)',
        backdropFilter: 'blur(16px) saturate(1.45)', WebkitBackdropFilter: 'blur(16px) saturate(1.45)',
        border: `1px solid ${dark ? bdr : 'rgba(255,255,255,.65)'}`,
        borderRadius: 12, overflow: 'hidden',
        boxShadow: dark ? '0 8px 28px rgba(0,0,0,.35)' : '0 8px 28px rgba(82,62,40,.10), inset 0 1px 0 rgba(255,255,255,.7)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: `1px solid ${bdr}`, background: dark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.02)' }}>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.02em', color: tx }}>{retailer}</span>
          <span style={{ fontSize: 12, color: mu, fontWeight: 600 }}>{items.length} products · {periods.length} periods</span>
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ fontSize: 9.5, fontWeight: 800, color: mu, textTransform: 'uppercase', letterSpacing: '.12em' }}>Planning Date</div>
            <div style={{ fontSize: isMobile ? 14 : 17, fontWeight: 800, fontFamily: 'ui-monospace,monospace', whiteSpace: 'nowrap',
              color: dark ? GOLD_A : GOLD_B,
              textShadow: `0 0 10px ${GOLD_A}aa, 0 0 24px ${GOLD_A}55` }}>
              {TODAY_ISO}
            </div>
          </div>
        </div>
        {/* views are invoked as functions (not JSX components) — they are re-defined on
            every render, and rendering them as <Component /> would remount the whole
            subtree on each state change, resetting scroll position and hover state */}
        {items.length === 0
          ? <div style={{ padding: '56px 0', textAlign: 'center', color: mu }}>ไม่พบข้อมูลที่ตรงกับ filter</div>
          : layout === 'grid' ? Calendar()
          : tlView === 'pulse' ? CalendarPulse()
          : Spotlight()
        }
      </div>
      )}

      {/* Bar hover popup — fixed overlay, follows mouse */}
      {barTip && (
        <div style={{
          position: 'fixed', zIndex: 9999, pointerEvents: 'none',
          left: barTip.x + 18, top: Math.max(8, barTip.y - 30),
          background: dark ? 'rgba(18,22,42,.82)' : 'rgba(255,255,255,.78)',
          backdropFilter: 'blur(16px) saturate(1.5)', WebkitBackdropFilter: 'blur(16px) saturate(1.5)',
          border: `1px solid ${barTip.color}44`,
          borderRadius: 12, padding: '13px 15px', minWidth: 210, maxWidth: 250,
          boxShadow: `0 20px 50px rgba(0,0,0,${dark ? .65 : .15}), 0 0 0 1px ${barTip.color}18`,
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: barTip.color, marginBottom: 2 }}>{barTip.brand}</div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: tx, lineHeight: 1.35, marginBottom: 6 }}>{barTip.product}</div>
          {(barTip.live || barTip.attention) && (
            <div style={{ display: 'flex', gap: 5, marginBottom: 5 }}>
              {barTip.live && <span className="ps-pulse-badge ps-pulse-badge--live">Live</span>}
              {barTip.attention && <span className="ps-pulse-badge ps-pulse-badge--attention">Attention</span>}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: '.04em' }}>{barTip.period}</span>
            <span style={{ fontSize: 10.5, color: mu }}>{barTip.dates}</span>
          </div>
          <div style={{ height: 1, background: bdr, margin: '8px 0' }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'ui-monospace,monospace', color: barTip.color, lineHeight: 1 }}>{barTip.price}</div>
            <div>
              <div style={{ fontSize: 11, color: mu, textDecoration: 'line-through' }}>{barTip.rsp}</div>
              {barTip.offPct != null && barTip.offPct > 0 && (
                <div style={{ fontSize: 12, fontWeight: 800, color: barTip.color }}>−{barTip.offPct}%</div>
              )}
            </div>
          </div>
          {(barTip.activities.length > 0 || barTip.clearance || barTip.branch) && (
            <>
              <div style={{ height: 1, background: bdr, margin: '9px 0 7px' }} />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {barTip.branch && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: `${branchClr}18`, color: branchClr, border: `1px solid ${branchClr}33` }}>
                    <i style={{ width: 5, height: 5, borderRadius: 99, background: branchClr, display: 'inline-block' }} />
                    เฉพาะสาขาเควิลเลจ
                  </span>
                )}
                {barTip.activities.map(a => ACT[a] ? (
                  <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: `${neon(ACT[a].color)}18`, color: neon(ACT[a].color), border: `1px solid ${neon(ACT[a].color)}33` }}>
                    <i style={{ width: 5, height: 5, borderRadius: 99, background: neon(ACT[a].color), display: 'inline-block' }} />
                    {ACT[a].label}
                  </span>
                ) : null)}
                {barTip.clearance && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: `${neon(CLEAR_COLOR)}18`, color: neon(CLEAR_COLOR), border: `1px solid ${neon(CLEAR_COLOR)}33` }}>
                    <i style={{ width: 5, height: 5, borderRadius: 99, background: neon(CLEAR_COLOR), display: 'inline-block' }} />
                    เคลียร์สินค้า
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* calculator modal */}
      {calcOpen && (
        <CalcModal t={t} dark={dark} items={allItems} retailer={retailer} onClose={() => setCalcOpen(false)} />
      )}
    </div>
  )
}

// ── compensate calculator ─────────────────────────────────────────────────────
function CalcModal({ t, dark, items, retailer, onClose }) {
  const [bc, setBc] = useState('')
  const [type, setType] = useState('single')  // 'single' | '2for' | 'b2g1'
  const [mode, setMode] = useState('keepgp')  // 'keepgp' | 'full'
  const [promo, setPromo] = useState('')

  const sel = items.find(i => i.barcode === bc) || null
  const rsp = sel?.rspIncVat ?? null
  const gp  = sel?.gp ?? null

  const costAt = price => (price / 1.07) * (1 - gp)
  const p = parseFloat(promo)

  // ponytail: trivial arithmetic, recompute every render — no useMemo needed,
  // and it sidesteps the stale-closure bug a [bc, type, mode, promo] dep array
  // had (rsp/gp/costAt derive from `items`, which wasn't in that array).
  let result
  if (rsp == null) result = { err: 'ค้นหาและเลือก product ก่อน' }
  else if (type !== 'b2g1' && isNaN(p)) result = { err: 'ใส่ราคาโปรโมชัน' }
  else {
    const eff = type === '2for' ? p / 2 : p
    let comp
    if (type === 'b2g1') comp = mode === 'keepgp' ? costAt(rsp) : rsp
    else if (mode === 'keepgp') comp = costAt(rsp) - costAt(eff)
    else comp = rsp - eff
    result = { comp }
  }

  const s = t.surface, s2 = t.surface2, bdr = t.border, tx = t.text, mu = t.muted

  return (
    <div className="ps-modal-backdrop" onClick={onClose} style={{ background: 'rgba(4,6,12,.55)' }}>
      <div className="ps-modal" onClick={e => e.stopPropagation()} style={{
        background: dark ? 'rgba(22,27,34,.85)' : 'rgba(251,248,243,.85)',
        backdropFilter: 'blur(18px) saturate(1.5)', WebkitBackdropFilter: 'blur(18px) saturate(1.5)',
        borderColor: bdr, boxShadow: '0 16px 48px rgba(0,0,0,.4)' }}>
        <div className="ps-modal-head" style={{ borderColor: bdr }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: tx }}>🧮 Compensate Calculator</div>
            <div style={{ fontSize: 11, color: mu, marginTop: 2 }}>{retailer} — เลือก product แล้วใส่ราคาโปร</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', background: s2, border: `1px solid ${bdr}`, cursor: 'pointer', color: mu, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>✕</button>
        </div>
        <div className="ps-modal-body">
          <select className="ps-fld" value={bc} onChange={e => setBc(e.target.value)}
            style={{ marginBottom: 10, background: s2, borderColor: bdr, color: bc ? tx : mu }}>
            <option value="">เลือก product…</option>
            {items.map(i => <option key={i.barcode} value={i.barcode}>{i.product} — ฿{i.rspIncVat}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, background: s2, border: `1px solid ${bdr}`, borderRadius: 10, padding: 3 }}>
            {[['single','Single'],['2for','2 for X'],['b2g1','B2G1']].map(([k,l]) => (
              <button key={k} onClick={() => setType(k)} style={{ flex: 1, border: 0, borderRadius: 7, padding: '6px 0', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
                background: type === k ? `linear-gradient(160deg,${t.accent},${t.orange||t.accent})` : 'none',
                color: type === k ? '#fff' : mu }}>{l}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: s2, border: `1px solid ${bdr}`, borderRadius: 10, padding: 3 }}>
            {[['keepgp','Keep GP'],['full','Full Compensate']].map(([k,l]) => (
              <button key={k} onClick={() => setMode(k)} style={{ flex: 1, border: 0, borderRadius: 7, padding: '6px 0', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
                background: mode === k ? s : 'none', color: mode === k ? tx : mu,
                boxShadow: mode === k ? '0 1px 4px rgba(0,0,0,.15)' : 'none' }}>{l}</button>
            ))}
          </div>
          {type !== 'b2g1' && (
            <input className="ps-fld" inputMode="decimal" value={promo} onChange={e => setPromo(e.target.value)}
              placeholder={type === '2for' ? 'ราคารวม 2 ชิ้น เช่น 320' : 'ราคาโปรโมชัน / ชิ้น'}
              style={{ background: s2, borderColor: bdr, color: tx }} />
          )}
          <div className="ps-calc-out" style={{ background: s2, borderColor: bdr }}>
            {result.err
              ? <div style={{ color: mu, fontSize: 13, padding: '6px 0' }}>{result.err}</div>
              : <>
                  <div style={{ fontSize: 11, color: mu, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>Compensate / unit</div>
                  <div className="ps-calc-big" style={{ color: t.accent }}>฿{result.comp.toFixed(2)}</div>
                </>}
          </div>
        </div>
      </div>
    </div>
  )
}
