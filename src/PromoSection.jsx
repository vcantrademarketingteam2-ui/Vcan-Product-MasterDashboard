/**
 * PromoSection.jsx — Promotion Plan tab.
 *
 *   - Plan:      one store's table, Year/Quarter/Month/Period selector, detail panel
 *   - Product:   one product (barcode) across every store, reached from search or a Plan row
 *   - Customer selector uses the RetailerLogo component (passed as prop) instead of plain text.
 *   - ACT.field color overridden to #f97316 (orange) to stay distinct from clearance.
 */

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import promoData, { PROMO_META, PROMO_ACTIVITY, PROMO_RETAILERS } from './promo_data.js'
import { MONTH_NAMES, buildPlan, defaultPick, colsForPick, quarterSpan, monthSpan, colsInSpan, pickLabel, pickYears, quarterBands, quarterLabel, dayDiff, productRows, bestNow } from './promoPlan.js'
import { DEPT_PINS, canSeeRetailer, logPricingAccess } from './deptPins.js'
import './PromoSection.css'
import { brandKey } from './brandCategory.js'

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
const PV_COLS = '180px 1.2fr 1fr 1fr'
const TODAY = new Date()
const TODAY_ISO = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}-${String(TODAY.getDate()).padStart(2, '0')}`

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
const fmtDM = d => `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
const TAG_LABEL = { looks: 'LOOKS' }
// Short date range for a plan column ("1 – 14 Oct", "23 Dec – 5 Jan 2027"); raw text when undated
function shortRange(r, raw) {
  if (!r) return raw || 'no dates'
  const sameMonth = r.s.getMonth() === r.e.getMonth() && r.s.getFullYear() === r.e.getFullYear()
  const yr = r.e.getFullYear() !== TODAY.getFullYear() ? ` ${r.e.getFullYear()}` : ''
  return `${sameMonth ? r.s.getDate() : fmtDM(r.s)} – ${fmtDM(r.e)}${yr}`
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
  const [unlocked, setUnlocked] = useState(null)
  const [pin, setPin] = useState('')
  const [pinErr, setPinErr] = useState(false)
  const [calcOpen, setCalcOpen] = useState(false)
  // Plan/Product redesign state
  const [view, setView] = useState('store')      // 'store' | 'product'
  const [pb, setPb] = useState(null)             // product-view barcode
  const [q, setQ] = useState('')
  const [sugOpen, setSugOpen] = useState(false)
  const [pick, setPick] = useState(null)
  const [sel, setSel] = useState(null)           // {retailer, barcode, name}
  const [collapsed, setCollapsed] = useState({})
  // TODAY is frozen at import: reload when an open tab wakes on a different day
  useEffect(() => {
    const f = () => { const d = new Date(), iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; if (document.visibilityState === 'visible' && iso !== TODAY_ISO) location.reload() }
    document.addEventListener('visibilitychange', f)
    return () => document.removeEventListener('visibilitychange', f)
  }, [])
  const canSee = r => !!unlocked && canSeeRetailer(unlocked, r)
  // Placeholder for a customer with no generated promo data (normally false; Watsons has data now)
  const comingSoon = retailer === 'Watsons' && !PROMO_RETAILERS.includes('Watsons')

  // ── derived data ────────────────────────────────────────────────────────────
  const periods = useMemo(() => {
    return (PROMO_META[retailer]?.periods || []).map((p, i) => ({ ...p, idx: i }))
  }, [retailer])

  // Enriched once for every retailer (Product view spans all stores); per-store lists derive from it
  const allEnriched = useMemo(() => enrich(promoData, rawData), [rawData])
  const itemsByRetailer = useMemo(() => {
    const m = {}
    allEnriched.forEach(it => { (m[it.retailer] = m[it.retailer] || []).push(it) })
    return m
  }, [allEnriched])
  const allItems = useMemo(() => itemsByRetailer[retailer] || [], [itemsByRetailer, retailer])
  const plans = useMemo(() => Object.fromEntries(CUSTOMERS.map(r => [r, buildPlan(PROMO_META[r]?.periods || [], TODAY)])), [])
  // Product identity = barcode. name = master name, falling back to the first promo name.
  const productIndex = useMemo(() => {
    const master = new Map((rawData || []).map(r => [r.barcode, r]))
    const m = new Map()
    allEnriched.forEach(it => {
      let e = m.get(it.barcode)
      if (!e) { e = { name: master.get(it.barcode)?.product || it.product, brand: it.brand, names: [], stores: [] }; m.set(it.barcode, e) }
      e.names.push(it.product)
      if (!e.stores.includes(it.retailer)) e.stores.push(it.retailer)
    })
    m.forEach((e, bc) => { e.hay = [e.name, ...e.names, e.brand, bc].join(' ').toLowerCase(); delete e.names })
    return m
  }, [allEnriched, rawData])
  const qn = q.trim().toLowerCase()
  const sugs = useMemo(() => {
    if (qn.length < 2) return []
    const out = []
    for (const [bc, e] of productIndex) { if (e.hay.includes(qn)) { out.push({ bc, ...e }); if (out.length >= 8) break } }
    return out
  }, [qn, productIndex])

  const brandList = useMemo(() => [...new Set(allItems.map(i => brandKey(i.brand, i.product)))].filter(Boolean).sort(), [allItems])

  // brand → company / promo-item count for the shared BrandCategoryFilter pills
  const brandCompany = useMemo(() => {
    const m = {}
    allItems.forEach(i => { const b = brandKey(i.brand, i.product); if (!m[b]) m[b] = i.company })
    return m
  }, [allItems])
  const brandCounts = useMemo(() => {
    const m = {}
    allItems.forEach(i => { const b = brandKey(i.brand, i.product); m[b] = (m[b] || 0) + 1 })
    return m
  }, [allItems])

  const items = useMemo(() => {
    if (!brandFilter.length) return allItems
    return allItems.filter(i => brandFilter.includes(brandKey(i.brand, i.product)))
  }, [allItems, brandFilter])

  // ── helpers ─────────────────────────────────────────────────────────────────
  const neon = c => dark ? c : (NEON_DEEP[c] || c)
  const gpColor = gp => gp == null ? t.muted : gp >= 0.30 ? t.green : gp >= 0.20 ? t.yellow : t.red
  const coColor = c => c === 'Vcan' ? t.vcanClr : t.moolaClr
  const priceTxt = pd => pd.salePrice != null ? '฿' + pd.salePrice.toLocaleString('th-TH') : (pd.saleLabel || '')

  // Open the product popup with the full master record (promo items lack the
  // retailers map / status fields the popup needs — passing them raw crashes it)
  const openProduct = it => {
    const m = rawData?.find(r => r.barcode === it.barcode)
    onSelect?.(m || { retailers: {}, status: '', rsp: it.rspIncVat ?? null, packSize: '', ...it })
  }

  const pickStore = r => { setRetailer(r); setPick(null); setSel(null); setBrandFilter([]); setView('store') }
  const openProductView = bc => { setPb(bc); setView('product'); setSel(null) }
  const chooseSug = bc => { setQ(''); setSugOpen(false); openProductView(bc) }
  const openStorePlan = (r, barcode, liveCol) => {
    setRetailer(r); setBrandFilter([]); setPick(null); setQ(''); setView('store')
    setSel(liveCol ? { retailer: r, barcode, name: liveCol.name } : null)
  }

  const toggleBrand = b => setBrandFilter(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])

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

  // ── Plan view (store table + period selector + detail panel) ─────────────────
  const accentTx = dark ? GOLD_A : GOLD_B
  const plan = plans[retailer] || { cols: [], hasNow: false, hasFuture: false, hasUnknown: false }
  const datesOf = c => shortRange(c.r, PROMO_META[retailer]?.periods?.[c.idx]?.dateRange)
  const tagsOf = pd => {
    const out = (pd?.activities || []).filter(a => ACT[a]).map(a => ({ k: a, t: TAG_LABEL[a] || ACT[a].label, c: neon(ACT[a].color) }))
    if (pd?.branchExclusive) out.push({ k: 'kv', t: 'K.Village', c: branchClr })
    return out
  }
  const tagRow = tags => tags.length > 0 && (
    <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {tags.map(tg => (
        <span key={tg.k} style={{ fontSize: 10.5, fontWeight: 700, padding: '1px 6px', borderRadius: 5, color: tg.c, background: `${tg.c}22`, border: `1px solid ${tg.c}44` }}>{tg.t}</span>
      ))}
    </span>
  )
  const statusLine = c => {
    if (c.status === 'now') { const n = dayDiff(TODAY, c.r.e); return n <= 0 ? 'Live · ends today' : `Live · ends in ${plural(n, 'day')}` }
    if (c.status === 'future') return `Starts in ${plural(dayDiff(TODAY, c.r.s), 'day')}`
    return c.status === 'past' ? 'Ended' : 'No dates'
  }
  const nowTag = <span style={{ fontSize: 9.5, fontWeight: 800, color: '#fff', background: GOLD_GRAD, borderRadius: 4, padding: '1px 5px', letterSpacing: '.04em' }}>NOW</span>
  const ghostBtn = {
    minHeight: 40, padding: '0 14px', borderRadius: 10, border: `1px solid ${bdr}`, background: s2, color: tx,
    fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  }

  // ── Product view (one product across every store) ────────────────────────────
  function ProductView() {
    const info = productIndex.get(pb)
    const { rows, notIn } = productRows(pb, itemsByRetailer, plans, CUSTOMERS)
    const first = rows[0]?.item
    const best = bestNow(rows)
    const bestRow = best && rows.find(x => x.retailer === best.retailer)
    const bestPct = bestRow ? offPctOf(bestRow.item, best.pd) : null
    const anyLocked = rows.some(x => !canSee(x.retailer))
    const blue = t.blue || '#58a6ff'
    const card = { background: s, border: `1px solid ${bdr}`, borderRadius: 14 }
    const colSub = (r, c) => c && `${c.name} · ${shortRange(c.r, PROMO_META[r]?.periods?.[c.idx]?.dateRange)}`

    // b = {col, pd}|null; noCol = text when the store has no such period at all
    const boxView = (x, b, col, noCol) => {
      if (!col) return <div style={{ fontSize: 13, fontWeight: 600, color: mu }}>{noCol}</div>
      if (!b) return (
        <div><div style={{ fontSize: 13, fontWeight: 600, color: mu }}>No promo</div>
          <div style={{ fontSize: 11.5, color: mu }}>{colSub(x.retailer, col)}</div></div>
      )
      const pct = offPctOf(x.item, b.pd)
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: tx }}>{priceTxt(b.pd) || '•'}</span>
            {pct != null && pct > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: t.green }}>−{pct}%</span>}
            {tagRow(tagsOf(b.pd))}
          </div>
          <div style={{ fontSize: 11.5, color: mu }}>{colSub(x.retailer, b.col)}</div>
          {canSee(x.retailer) && b.pd.compensate != null && (
            <div style={{ fontSize: 11.5, fontWeight: 700, color: blue, fontFamily: 'ui-monospace,monospace' }}>Comp ฿{b.pd.compensate.toFixed(2)}</div>
          )}
        </div>
      )
    }
    const nowBox = x => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {boxView(x, x.now, x.nowCol, 'No current period')}
        {x.moreLive > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: accentTx }}>+{x.moreLive} more live</span>}
      </div>
    )
    const boxes = x => [
      ['NOW', accentTx, nowBox(x)],
      ['NEXT PERIOD', blue, boxView(x, x.next, x.nextCol, 'No next period')],
      ['UPCOMING', mu, boxView(x, x.upcoming, x.upcoming?.col, 'Nothing planned')],
    ]
    const storeCell = x => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
        {RetailerLogo
          ? <RetailerLogo name={x.retailer} h={28} maxW={74} dark={dark} fallbackStyle={{ fontSize: 13, fontWeight: 800, color: tx }} />
          : <b style={{ color: tx }}>{x.retailer}</b>}
        <span style={{ fontSize: 12, color: mu }}>RSP {x.item.rspIncVat != null ? `฿${x.item.rspIncVat}` : '—'}</span>
        {x.item.disconFrom && <span style={{ fontSize: 9.5, fontWeight: 800, color: disconClr }}>ยกเลิกขาย from {x.item.disconFrom}</span>}
        {canSee(x.retailer) && x.item.gp != null && <span style={{ fontSize: 11.5, fontWeight: 700, color: gpColor(x.item.gp) }}>GP {Math.round(x.item.gp * 100)}%</span>}
      </div>
    )
    const go = x => openStorePlan(x.retailer, pb, x.now?.col)
    const rowProps = x => ({ role: 'button', tabIndex: 0, onClick: () => go(x), onKeyDown: ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(x) } }, 'aria-label': `Open ${x.retailer} plan` })
    const colHead = (label, c) => <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.08em', color: c, padding: '12px 14px', borderBottom: `1px solid ${bdr}` }}>{label}</div>

    return (
      <div style={{ padding: isMobile ? '12px 12px 16px' : '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button onClick={() => setView('store')} style={{ ...ghostBtn, alignSelf: 'flex-start', color: accentTx }}>← Back to {retailer}</button>
        <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', padding: isMobile ? 14 : '18px 20px' }}>
          <div style={{ flex: '1 1 300px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? 17 : 20, fontWeight: 800, color: tx, lineHeight: 1.3 }}>{info?.name || first?.product || pb}</h2>
            <span style={{ fontSize: 12.5, color: mu }}>{[first?.company, info?.brand || first?.brand, `barcode ${pb}`].filter(Boolean).join(' · ')}</span>
            {first && <button onClick={() => openProduct(first)} style={{ ...ghostBtn, alignSelf: 'flex-start', marginTop: 6 }}>Product info</button>}
          </div>
          <div style={{ flex: '0 1 300px', borderRadius: 12, padding: '12px 16px', background: best ? `${t.green}1a` : s2, border: `1px solid ${best ? `${t.green}55` : bdr}`, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {best ? (
              <>
                <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.08em', color: t.green }}>BEST PRICE RIGHT NOW</span>
                <span style={{ fontSize: 19, fontWeight: 800, color: tx }}>฿{best.price.toLocaleString('th-TH')} at {best.retailer} {bestPct != null && bestPct > 0 && <span style={{ fontSize: 14, color: t.green }}>−{bestPct}%</span>}</span>
                <span style={{ fontSize: 12, color: mu }}>until {best.col.r ? fmtDM(best.col.r.e) : 'end of period'}</span>
              </>
            ) : <span style={{ fontSize: 13.5, color: mu }}>No price promo running right now at any store.</span>}
          </div>
        </div>

        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map(x => (
              <div key={x.retailer} {...rowProps(x)} style={{ ...card, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, cursor: 'pointer', minHeight: 44 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>{storeCell(x)}<span style={{ color: accentTx, fontSize: 18 }}>→</span></div>
                {boxes(x).map(([l, c, node]) => (
                  <div key={l}><div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', color: c, marginBottom: 3 }}>{l}</div>{node}</div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ ...card, overflowX: 'auto' }}>
            <div style={{ minWidth: 800 }}>
              <div style={{ display: 'grid', gridTemplateColumns: PV_COLS }}>
              {colHead('STORE', mu)}{colHead('NOW', accentTx)}{colHead('NEXT PERIOD', blue)}{colHead('UPCOMING', mu)}
              </div>
              {rows.map(x => (
                <div key={x.retailer} {...rowProps(x)} className="ps-prow" style={{ display: 'grid', gridTemplateColumns: PV_COLS, cursor: 'pointer' }}>
                  {[storeCell(x), ...boxes(x).map(b => b[2])].map((node, k) => (
                    <div key={k} style={{ padding: '12px 14px', borderBottom: `1px solid ${dim}`, cursor: 'pointer' }}>{node}</div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 13, color: mu }}>
          {notIn.length > 0 && (
            <>
              <span>Not in:</span>
              {notIn.map(n => <span key={n} style={{ padding: '4px 10px', borderRadius: 99, border: `1px dashed ${bdr}` }}>{n}</span>)}
            </>
          )}
          {anyLocked && <span style={{ marginLeft: 'auto', fontSize: 12 }}>GP / compensate hidden — unlock with a PIN that covers the store</span>}
        </div>
      </div>
    )
  }

  // Table ref callback: on mount of the keyed scroller (once per pick/store change), bring the NOW column
  // into view if it starts off-screen, just right of the sticky product column.
  function tableRef(el) {
    if (!el || el.__done) return
    el.__done = true
    requestAnimationFrame(() => {
      const n = el.querySelector('[data-now]'); if (!n) return
      const nr = n.getBoundingClientRect(), er = el.getBoundingClientRect()
      if (nr.right > er.right) el.scrollLeft += nr.left - er.left - (isMobile ? 112 : 250)
    })
  }

  function PlanCell(it, c, di) {
    const pd = it.periods?.[c.name]
    const isDiscon = di != null && c.idx >= di
    const cellBox = { background: isDiscon ? disconBg : c.status === 'now' ? nowBg : 'transparent', borderLeft: `1px solid ${dim}`, borderBottom: `1px solid ${dim}`, padding: 5, display: 'flex', alignItems: 'stretch', minWidth: 0 }
    if (!pd) return (
      <div key={c.name} style={{ ...cellBox, alignItems: 'center', color: mu, justifyContent: 'center' }}>
        {isDiscon && c.idx === di
          ? <span style={{ fontSize: 9, fontWeight: 800, color: disconClr, background: `${disconClr}1e`, border: `1px solid ${disconClr}44`, borderRadius: 5, padding: '2px 6px', whiteSpace: 'nowrap' }}>ยกเลิกขาย</span>
          : null}
      </div>
    )
    const selected = !!sel && sel.retailer === retailer && sel.barcode === it.barcode && sel.name === c.name
    const pct = offPctOf(it, pd)
    return (
      <div key={c.name} style={cellBox}>
        <button onClick={() => setSel({ retailer, barcode: it.barcode, name: c.name })} aria-pressed={selected}
          style={{ width: '100%', minHeight: 44, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 3,
            padding: '5px 8px', borderRadius: 9, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: tx,
            border: selected ? `2px solid ${GOLD_A}` : `1px solid ${bdr}`,
            background: selected ? `${GOLD_A}26` : (dark ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.72)'),
            boxShadow: selected ? `0 0 10px -3px ${GOLD_A}` : 'none' }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 800, fontFamily: pd.salePrice != null ? 'ui-monospace,monospace' : 'inherit' }}>{priceTxt(pd) || '•'}</span>
            {pct != null && pct > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: t.green }}>−{pct}%</span>}
          </span>
          {tagRow(tagsOf(pd))}
        </button>
      </div>
    )
  }

  function DetailPanel() {
    const it = allItems.find(i => i.barcode === sel.barcode)
    const c = plan.cols.find(x => x.name === sel.name)
    const pd = it?.periods?.[sel.name]
    if (!it || !c || !pd) return null
    const pct = offPctOf(it, pd)
    const tags = tagsOf(pd)
    const see = canSee(retailer)
    const later = plan.cols.slice(plan.cols.indexOf(c) + 1).filter(x => it.periods?.[x.name]).slice(0, 3)
    const row = { display: 'grid', gridTemplateColumns: '92px 1fr', gap: 8, fontSize: 13, alignItems: 'baseline' }
    const dim2 = { color: mu, fontWeight: 600 }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: coColor(it.company) || accentTx }}>{it.brand} · {retailer}</div>
            <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.35, color: tx, marginTop: 2 }}>{productIndex.get(it.barcode)?.name || it.product}</div>
          </div>
          <button onClick={() => setSel(null)} aria-label="Close details"
            style={{ ...ghostBtn, width: 44, height: 44, padding: 0, flexShrink: 0, color: mu }}>✕</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: tx, fontFamily: pd.salePrice != null ? 'ui-monospace,monospace' : 'inherit' }}>{priceTxt(pd) || '•'}</span>
          <span style={{ display: 'flex', flexDirection: 'column' }}>
            {it.rspIncVat > 0 && <span style={{ fontSize: 12.5, color: mu }}>RSP ฿{it.rspIncVat}</span>}
            {pct != null && pct > 0 && <span style={{ fontSize: 15, fontWeight: 800, color: t.green }}>−{pct}%</span>}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={row}><span style={{ color: mu }}>Period</span><b>{c.name} · {datesOf(c)}</b></div>
          <div style={row}><span style={{ color: mu }}>Status</span><b style={{ color: c.status === 'now' ? nowLine : tx }}>{statusLine(c)}</b></div>
          <div style={row}><span style={{ color: mu }}>Activity</span>
            <span>{tags.length ? tagRow(tags) : <span style={{ color: mu }}>No activity tag</span>}
              {it.clearance && <span style={{ marginLeft: tags.length ? 6 : 0, fontSize: 10.5, fontWeight: 800, color: neon(CLEAR_COLOR) }}>เคลียร์สินค้า</span>}</span></div>
          <div style={row}><span style={{ color: mu }}>Compensate</span>
            <b>{pd.compensate == null ? <span style={dim2}>No unit compensate (mechanic promo)</span>
              : !unlocked ? <span style={dim2}>Unlock with PIN to see compensate / GP</span>
              : !see ? <span style={dim2}>Not available for your department</span>
              : <span style={{ color: t.blue || '#58a6ff', fontFamily: 'ui-monospace,monospace' }}>฿{pd.compensate.toFixed(2)}</span>}</b></div>
          <div style={row}><span style={{ color: mu }}>GP</span>
            <b>{see ? (it.gp != null ? <span style={{ color: gpColor(it.gp) }}>{Math.round(it.gp * 100)}%</span> : <span style={{ color: mu }}>—</span>)
              : <span style={dim2}>{unlocked ? 'Not available for your department' : 'Locked'}</span>}</b></div>
        </div>
        {later.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: mu }}>LATER AT THIS STORE</span>
            {later.map(x => {
              const lp = it.periods[x.name], lo = offPctOf(it, lp)
              return (
                <div key={x.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 10px', borderRadius: 9, background: s2, fontSize: 13 }}>
                  <span>{x.name} <span style={{ color: mu }}>{datesOf(x)}</span></span>
                  <b>{priceTxt(lp) || '•'} {lo != null && lo > 0 && <span style={{ color: t.green }}>−{lo}%</span>}</b>
                </div>
              )
            })}
          </div>
        )}
        <button onClick={() => openProductView(it.barcode)} className="ps-glow" style={{ ...ghostBtn, '--g': GOLD_A, border: `1px solid ${GOLD_A}`, background: `${GOLD_A}1f` }}>
          See across all stores →
        </button>
      </div>
    )
  }

  function PlanView() {
    const planCols = plan.cols
    const undatedCols = planCols.filter(c => !c.r)
    const dp = defaultPick(planCols, TODAY)
    const years = [...new Set([...pickYears(planCols), ...(dp?.y != null ? [dp.y] : [])])].sort((a, b) => a - b)
    const pk = pick || dp
    const win = colsForPick(planCols, pk)
    const atNow = !pick || (pick.lvl === 'q' && dp?.lvl === 'q' && pick.y === dp.y && pick.q === dp.q)
    const choose = p => { setPick(p); setSel(null) }
    const colsIn = span => colsInSpan(planCols, span)

    const planBase = qn.length >= 2 ? items.filter(it => productIndex.get(it.barcode)?.hay.includes(qn)) : items
    const planShown = planBase.filter(it => win.some(c => it.periods?.[c.name]))
    const hiddenN = planBase.length - planShown.length
    const planGroups = Object.entries(planShown.reduce((g, i) => { (g[i.brand] = g[i.brand] || []).push(i); return g }, {}))

    const leadW = isMobile ? 112 : 250
    const colMin = isMobile ? 104 : 150
    const gridCols = `${leadW}px repeat(${Math.max(1, win.length)}, minmax(${colMin}px, 1fr))`
    const minW = leadW + Math.max(1, win.length) * colMin
    const stale = planCols.length > 0 && !plan.hasNow && !plan.hasFuture && !plan.hasUnknown
    const hasSel = !!sel && sel.retailer === retailer && allItems.some(i => i.barcode === sel.barcode && i.periods?.[sel.name])

    // ONE meaning per signal: soft bronze tint + outline = what you picked (one at a time);
    // small dot = contains today; NOW tag = live period. Chips are borderless inside a segment box.
    const chip = (on, dis) => ({
      position: 'relative', minHeight: isMobile ? 40 : 32, padding: '0 11px', borderRadius: 7, border: 0, fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 800 : 600,
      cursor: dis ? 'default' : 'pointer', opacity: dis ? .3 : 1, whiteSpace: 'nowrap',
      background: on ? `${GOLD_A}22` : 'none', color: on ? accentTx : tx, boxShadow: on ? `inset 0 0 0 1px ${GOLD_A}88` : 'none',
    })
    const seg = { display: 'flex', alignItems: 'center', gap: 2, padding: 3, borderRadius: 10, background: s2, border: `1px solid ${bdr}` }
    const todayDot = <span aria-label="contains today" style={{ position: 'absolute', left: '50%', bottom: 3, width: 4, height: 4, marginLeft: -2, borderRadius: 99, background: accentTx }} />
    const yearChip = on => ({ ...chip(false, false), background: on ? (dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.07)') : 'none', fontWeight: on ? 800 : 600, color: on ? tx : mu })
    const rowLbl = l => <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.1em', color: mu, minWidth: 54 }}>{l}</span>
    const selY = pk?.y ?? TODAY.getFullYear()
    const selQ = pk && pk.lvl !== 'u' && pk.q >= 0 ? pk.q : -1
    const isCurQ = (y, q) => y === TODAY.getFullYear() && q === Math.floor(TODAY.getMonth() / 3)
    const isCurM = (y, m) => y === TODAY.getFullYear() && m === TODAY.getMonth()
    // year chips only switch year (grey context); the whole year is its own labelled button so people find it
    const pickYear = y => choose(pk?.lvl === 'y' ? { lvl: 'y', y } : { lvl: 'q', y, q: [0, 1, 2, 3].find(q => colsIn(quarterSpan(y, q)).length) ?? 0 })
    const yearBtns = years.map(y => (
      <button key={y} onClick={() => pickYear(y)} style={yearChip(selY === y && pk?.lvl !== 'u')}>{y}</button>
    ))
    const yearHasCols = colsIn([new Date(selY, 0, 1), new Date(selY, 11, 31, 23, 59, 59, 999)]).length > 0
    const fullYearOn = pk?.lvl === 'y'
    const fullYearBtn = (
      <button disabled={!yearHasCols} onClick={() => choose({ lvl: 'y', y: selY })}
        style={{ ...chip(fullYearOn, !yearHasCols), flex: 'none', minHeight: isMobile ? 40 : 38, fontWeight: 800, color: accentTx,
          boxShadow: `inset 0 0 0 1px ${GOLD_A}${fullYearOn ? '88' : '55'}` }}>Full year</button>
    )
    const monthBtn = (m, q, pad) => {
      const on = pk?.lvl === 'm' && pk.m === m
      const n = colsIn(monthSpan(selY, m)).length
      return <button key={m} disabled={!n} onClick={() => choose({ lvl: 'm', y: selY, q, m })}
        style={{ ...chip(on, !n), ...(pad ? { padding: '0 6px' } : {}) }}>{MONTH_NAMES[m]}{isCurM(selY, m) && !on && todayDot}</button>
    }

    const quarterBtn = q => {
      const n = colsIn(quarterSpan(selY, q)).length
      const on = pk?.lvl === 'q' && selQ === q
      return <button key={q} disabled={!n} onClick={() => choose({ lvl: 'q', y: selY, q })}
        style={{ ...chip(on, !n), ...(isMobile ? {} : { padding: '0 8px', fontWeight: 800, color: on ? accentTx : mu }) }}>Q{q + 1}{isCurQ(selY, q) && !on && todayDot}</button>
    }
    // slot always reserved (visibility, not unmount) so the row never reflows when it appears
    const backBtn = (
      <button onClick={() => choose(null)} disabled={atNow} aria-hidden={atNow} tabIndex={atNow ? -1 : 0}
        style={{ ...chip(false, false), color: accentTx, textDecoration: 'underline', textUnderlineOffset: 3, visibility: atNow ? 'hidden' : 'visible' }}>Back to now</button>
    )

    // dropdown state: one option per period, plus an "all" entry that follows the current pick
    const periodGroups = [...planCols.filter(c => c.r).reduce((g, c) => {
      const k = quarterLabel(c); g.set(k, [...(g.get(k) || []), c]); return g
    }, new Map())]
    const singlePeriod = pk?.lvl === 'p'
    const periodOn = singlePeriod || pk?.lvl === 'u'
    const periodValue = singlePeriod ? `p:${pk.name}` : pk?.lvl === 'u' ? 'u' : 'all'
    const allOption = singlePeriod && pk.q != null ? `All in Q${pk.q + 1} ${pk.y}`
      : periodOn ? (dp?.lvl === 'u' ? null : 'Current quarter')
      : win.length ? `All ${plural(win.length, 'period')}` : 'None here'
    const periodLabel = singlePeriod
      ? pk.name + (planCols.find(c => c.name === pk.name)?.status === 'now' ? ' NOW' : '')
      : pk?.lvl === 'u' ? `All undated (${undatedCols.length})` : allOption
    const pickPeriod = v => {
      if (v === 'u') return choose({ lvl: 'u' })
      if (v === 'all') return choose(singlePeriod && pk.q != null ? { lvl: 'q', y: pk.y, q: pk.q } : periodOn ? null : pk)
      const name = v.slice(2), d = planCols.find(c => c.name === name)?.r?.s
      choose(d ? { lvl: 'p', name, y: d.getFullYear(), q: Math.floor(d.getMonth() / 3), m: d.getMonth() } : { lvl: 'p', name })
    }

    function PeriodSelector() {
      return (
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flexWrap: 'wrap', alignItems: isMobile ? 'stretch' : 'center', gap: 8, padding: '12px 18px', borderBottom: `1px solid ${bdr}`, minWidth: 0, maxWidth: '100%' }}>
          {!isMobile && (
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, flex: '0 0 auto', maxWidth: '100%' }}>
              {years.length > 0 && <div style={seg}>{yearBtns}</div>}
              {years.length > 0 && fullYearBtn}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {[0, 1, 2, 3].map(q => (
                  <div key={q} style={seg}>
                    {quarterBtn(q)}
                    {[0, 1, 2].map(i => monthBtn(q * 3 + i, q, true))}
                  </div>
                ))}
              </div>
            </div>
          )}
          {isMobile && (<>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              {rowLbl('QUARTER')}
              {yearBtns}
              {years.length > 0 && <span style={{ width: 1, height: 22, background: bdr, margin: '0 4px' }} />}
              {[0, 1, 2, 3].map(quarterBtn)}
              {years.length > 0 && fullYearBtn}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              {rowLbl('MONTH')}
              {selQ >= 0
                ? [0, 1, 2].map(i => monthBtn(selQ * 3 + i, selQ, false))
                : [0, 1, 2].map(i => { const m = Math.floor(TODAY.getMonth() / 3) * 3 + i; return <button key={m} disabled style={chip(false, true)}>{MONTH_NAMES[m]}</button> })}
            </div>
          </>)}
          {/* Period dropdown: a native select laid invisibly over a compact label, so the closed control
              keeps one fixed width while the open list still shows full dates. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...(isMobile ? { width: '100%' } : { flex: '0 0 auto' }) }}>
            {isMobile && rowLbl('PERIOD')}
            {planCols.length === 0 ? <span style={{ fontSize: 12.5, color: mu }}>No periods</span> : (
              <label className="ps-period" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, boxSizing: 'border-box',
                width: isMobile ? 'auto' : 200, flex: isMobile ? 1 : 'none', minWidth: 0, minHeight: isMobile ? 44 : 40, padding: '0 11px', borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
                border: `1px solid ${periodOn ? `${GOLD_A}88` : bdr}`, background: periodOn ? `${GOLD_A}22` : s2, color: periodOn ? accentTx : tx }}>
                {!isMobile && <span style={{ flex: 'none', fontSize: 10.5, letterSpacing: '.1em', color: mu }}>PERIOD</span>}
                <span data-period-label style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{periodLabel}</span>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true" style={{ flex: 'none' }}><path d="M5 9l7 7 7-7" /></svg>
                <select aria-label="Period" value={periodValue} onChange={e => pickPeriod(e.target.value)}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', fontSize: 16, colorScheme: dark ? 'dark' : 'light' }}>
                  {allOption && <option value="all">{allOption}</option>}
                  {periodGroups.map(([label, cols]) => (
                    <optgroup key={label} label={label}>
                      {cols.map(c => <option key={c.name} value={`p:${c.name}`}>{[c.name, datesOf(c), c.status === 'now' && 'NOW'].filter(Boolean).join(' · ')}</option>)}
                    </optgroup>
                  ))}
                  {undatedCols.length > 0 && (
                    <optgroup label="Undated">
                      <option value="u">All undated ({undatedCols.length})</option>
                      {undatedCols.map(c => <option key={c.name} value={`p:${c.name}`}>{c.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </label>
            )}
          </div>
        </div>
      )
    }

    return (
      <div style={{ minWidth: 0, maxWidth: '100%' }}>
        {PeriodSelector()}

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '4px 18px', borderBottom: `1px solid ${bdr}` }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: tx }}>{pickLabel(pk)} <span style={{ fontWeight: 600, color: mu }}>· {plural(win.length, 'period')}</span></span>
          {backBtn}
          <span style={{ marginLeft: 'auto', fontSize: 12.5, color: mu }}>
            {planShown.length} of {items.length} SKUs{hiddenN > 0 && <span> · {hiddenN} hidden</span>}
          </span>
        </div>

        {stale && (
          <div style={{ margin: '12px 18px 0', padding: '10px 14px', borderRadius: 10, border: `1px solid ${t.orange || '#f0883e'}66`, background: `${t.orange || '#f0883e'}14`, color: t.orange || '#f0883e', fontSize: 13 }}>
            Every period in this plan is in the past — the source sheet still carries old dates.
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div key={retailer + JSON.stringify(pk)} ref={pk?.lvl === 'y' ? undefined : tableRef} style={{ flex: 1, minWidth: 0, overflow: 'auto', maxHeight: isMobile ? '66vh' : '70vh', scrollbarColor: `${bdr} transparent`, WebkitOverflowScrolling: 'touch' }}>
            {planGroups.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center', color: mu, fontSize: 14 }}>
                No promos in this view. Clear the search or brand filter, or pick another period.
              </div>
            ) : (
              <div style={{ minWidth: minW }}>
                {/* header row */}
                <div style={{ display: 'grid', gridTemplateColumns: gridCols, position: 'sticky', top: 0, zIndex: 4, background: s2, borderBottom: `1px solid ${bdr}` }}>
                  <div style={{ gridRow: 'span 2', position: 'sticky', left: 0, zIndex: 5, background: s2, borderRight: `1px solid ${bdr}`, padding: '12px 14px', fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: mu }}>Product</div>
                  {quarterBands(win).map((b, i) => (
                    <div key={i} style={{ gridColumn: `span ${b.span}`, padding: '5px 10px', minHeight: 26, boxSizing: 'border-box', borderLeft: `1px solid ${bdr}`, borderBottom: `1px solid ${dim}`, minWidth: 0 }}>
                      {/* sticky so the label stays readable while a long quarter scrolls under the product column */}
                      <span style={{ position: 'sticky', left: leadW + 10, fontSize: 11, fontWeight: 800, letterSpacing: '.08em', color: mu, whiteSpace: 'nowrap' }}>{b.label}</span>
                    </div>
                  ))}
                  {win.map(c => (
                    <div key={c.name} data-now={c.status === 'now' ? '1' : undefined} style={{ padding: '9px 10px', borderLeft: `1px solid ${dim}`, borderBottom: `2px solid ${c.status === 'now' ? nowLine : 'transparent'}`,
                      background: c.status === 'now' ? `color-mix(in srgb, ${GOLD_A} 12%, ${s2})` : s2, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 800, color: c.status === 'now' ? accentTx : tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                        {c.status === 'now' && nowTag}
                      </div>
                      <div style={{ fontSize: 11.5, color: mu }}>{datesOf(c)}</div>
                    </div>
                  ))}
                </div>
                {/* brand bands + rows */}
                {planGroups.map(([brand, list]) => {
                  const key = `${retailer}|${brand}`
                  const open = !collapsed[key]
                  const clr = coColor(list[0].company) || t.accent
                  return (
                    <div key={brand}>
                      <div style={{ background: `color-mix(in srgb, ${clr} 7%, ${s2})`, borderBottom: `1px solid ${bdr}`, borderTop: `1px solid ${bdr}` }}>
                        <button onClick={() => setCollapsed(c => ({ ...c, [key]: open }))} aria-expanded={open}
                          style={{ position: 'sticky', left: 0, display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '0 14px', border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit', color: tx }}>
                          <span style={{ color: mu, width: 12, fontSize: 12 }}>{open ? '▾' : '▸'}</span>
                          <MonogramTile brand={brand} company={list[0].company} t={t} size="s" />
                          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: clr }}>{brand}</span>
                          <span style={{ fontSize: 11.5, color: mu }}>· {plural(list.length, 'SKU')}</span>
                        </button>
                      </div>
                      {open && list.map(it => {
                        const dIdx = disconIdxOf(it)
                        const di = dIdx >= 0 ? dIdx : undefined
                        return (
                          <div key={it.barcode} style={{ display: 'grid', gridTemplateColumns: gridCols }}>
                            <div style={{ position: 'sticky', left: 0, zIndex: 2, background: s, borderRight: `1px solid ${bdr}`, borderBottom: `1px solid ${dim}`, padding: isMobile ? '6px 8px' : '7px 14px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
                              <button onClick={() => openProductView(it.barcode)} title="See this product in every store"
                                style={{ padding: 0, border: 0, background: 'none', color: tx, fontFamily: 'inherit', fontSize: isMobile ? 12 : 13, fontWeight: 700, textAlign: 'left', cursor: 'pointer', minHeight: isMobile ? 40 : 0,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'normal' : 'nowrap', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: isMobile ? 3 : 1 }}>
                                {productIndex.get(it.barcode)?.name || it.product}
                              </button>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11 }}>
                                <span style={{ color: mu }}>RSP {it.rspIncVat != null ? `฿${it.rspIncVat}` : '—'}</span>
                                {canSee(retailer) && it.gp != null && <span style={{ color: gpColor(it.gp), fontWeight: 700 }}>GP {Math.round(it.gp * 100)}%</span>}
                                {it.clearance && <span style={{ fontSize: 9.5, fontWeight: 800, color: neon(CLEAR_COLOR), background: `${neon(CLEAR_COLOR)}22`, borderRadius: 4, padding: '0 5px' }}>เคลียร์สินค้า</span>}
                                {it.disconFrom && <span style={{ fontSize: 9.5, fontWeight: 800, color: disconClr }}>ยกเลิกขาย from {it.disconFrom}</span>}
                              </div>
                            </div>
                            {win.map(c => PlanCell(it, c, di))}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* detail panel — right side on desktop */}
          {hasSel && !isMobile && (
            <aside aria-label="Selected promotion" style={{ width: 320, flexShrink: 0, alignSelf: 'stretch', borderLeft: `1px solid ${bdr}`, padding: 18, background: dark ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.4)', maxHeight: '70vh', overflowY: 'auto' }}>
              {DetailPanel()}
            </aside>
          )}
        </div>

        {/* detail panel — bottom sheet on mobile. Portalled: the main card's backdrop-filter would
            otherwise become the containing block of this position:fixed overlay. */}
        {hasSel && isMobile && createPortal(
          <div onClick={() => setSel(null)} style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'flex-end', background: 'rgba(4,6,12,.55)' }}>
            <aside aria-label="Selected promotion" onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxHeight: '95dvh', overflowY: 'auto', borderRadius: '16px 16px 0 0', color: tx, fontSize: 14, fontFamily: 'inherit', padding: '18px 16px 28px', background: s, borderTop: `1px solid ${bdr}`, boxShadow: '0 -12px 40px rgba(0,0,0,.4)' }}>
              {DetailPanel()}
            </aside>
          </div>, document.body)}
      </div>
    )
  }

  const onProductView = view === 'product'

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* customer select */}
      <div className="ps-pills">
        <span className="ps-label" style={{ color: mu }}>Customer</span>
        {CUSTOMERS.map(r => (
          <button key={r} onClick={() => pickStore(r)} title={r}
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

      {/* toolbar: product search + tools */}
      {!comingSoon && (
      <div className="ps-toolbar">
        <div style={{ position: 'relative', flex: isMobile ? '1 1 100%' : '1 1 280px', maxWidth: isMobile ? 'none' : 460, minWidth: 0 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 9, height: isMobile ? 44 : 40, padding: '0 12px', borderRadius: 10, border: `1px solid ${bdr}`, background: s2 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GOLD_A} strokeWidth="2.2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input type="search" value={q} aria-label="Search product, brand or barcode"
              onChange={e => { setQ(e.target.value); setSugOpen(true) }}
              onFocus={() => setSugOpen(true)} onBlur={() => setSugOpen(false)}
              onKeyDown={e => { if (e.key === 'Escape') setSugOpen(false); else if (e.key === 'Enter' && sugOpen && sugs[0]) { e.preventDefault(); chooseSug(sugs[0].bc) } }}
              placeholder="Search product, brand or barcode"
              style={{ flex: 1, minWidth: 0, background: 'none', border: 0, outline: 0, color: tx, fontFamily: 'inherit', fontSize: isMobile ? 16 : 13.5 }} />
          </label>
          {sugOpen && sugs.length > 0 && (
            <div style={{ position: 'absolute', top: (isMobile ? 48 : 44), left: 0, right: 0, zIndex: 40, background: s, border: `1px solid ${GOLD_A}88`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 18px 40px rgba(0,0,0,.35)' }}>
              {sugs.map(e => (
                <button key={e.bc} onMouseDown={ev => { ev.preventDefault(); chooseSug(e.bc) }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, width: '100%', minHeight: 48, padding: '8px 14px', border: 0, borderBottom: `1px solid ${bdr}`, background: 'none', color: tx, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{e.name} — {e.brand} · in {e.stores.length} store{e.stores.length === 1 ? '' : 's'}</span>
                  <span style={{ fontSize: 11.5, color: mu }}>{e.bc}</span>
                </button>
              ))}
            </div>
          )}
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

      {/* brand filter — shared category navigator (passed from App.jsx) */}
      {!comingSoon && !onProductView && brandList.length > 0 && BrandCategoryFilter && (
        <div style={{ marginBottom: 12 }}>
          <BrandCategoryFilter idPrefix="ps-promo" brandList={brandList}
            selectedBrands={brandFilter} onToggle={toggleBrand} onClear={() => setBrandFilter([])}
            brandCompany={brandCompany} brandCounts={brandCounts} t={t} isMobile={isMobile} />
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
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', padding: '8px 14px', borderBottom: `1px solid ${bdr}`, background: dark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.02)' }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-.02em', color: tx }}>{onProductView ? 'Product across stores' : retailer}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', gap: 8, whiteSpace: 'nowrap' }}>
            {!isMobile && <span style={{ fontSize: 9.5, fontWeight: 800, color: mu, textTransform: 'uppercase', letterSpacing: '.12em' }}>Planning date</span>}
            <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'ui-monospace,monospace', color: dark ? GOLD_A : GOLD_B }}>{TODAY_ISO}</span>
          </div>
        </div>
        {/* views are invoked as functions (not JSX components) — they are re-defined on
            every render, and rendering them as <Component /> would remount the whole
            subtree on each state change, resetting scroll position and hover state */}
        {onProductView ? ProductView() : PlanView()}
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

  // Portalled: the page wrapper (.vc-fade) keeps a stacking context, so inside it this backdrop
  // would paint under the phone tab bar. A portal loses inherited colour, font and zoom: set here.
  return createPortal(
    <div className="ps-modal-backdrop" onClick={onClose} style={{ background: 'rgba(4,6,12,.55)', color: tx, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, zoom: 1.05 }}>
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
  , document.body)
}
