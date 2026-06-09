/**
 * PromoSection.jsx — Drop-in redesigned Promotion Plan for the Vcan dashboard.
 *
 * Fixes applied vs. original drop-in:
 *   - ACT.field color overridden to #f97316 (orange) to stay distinct from clearance cyan.
 *   - Customer selector uses the RetailerLogo component (passed as prop) instead of plain text.
 */

import { useState, useMemo, useRef, useLayoutEffect } from 'react'
import promoData, { PROMO_META, PROMO_ACTIVITY, PROMO_RETAILERS } from './promo_data.js'
import './PromoSection.css'

// ── constants ─────────────────────────────────────────────────────────────────
const DEPT_PINS = {
  [import.meta.env.VITE_PIN_SALES ?? '2745']: 'Sales/Trade Marketing',
  [import.meta.env.VITE_PIN_DATA   ?? '4343']: 'Data',
}

// Override field → orange (distinct from clearance cyan #22d3ee).
// Override media → blue (distinct from looks fuchsia).
const ACT = {
  ...PROMO_ACTIVITY,
  field: { ...PROMO_ACTIVITY.field, color: '#f97316' },
  media: { ...PROMO_ACTIVITY.media, color: '#3b82f6' },
}
const CLEAR_COLOR = '#22d3ee'
const TODAY = new Date()

// ── date helpers ──────────────────────────────────────────────────────────────
function parseDR(dr = '') {
  // "27/05-9/06/26"  or  "7/01-20/01/26"
  const m = dr.match(/^(\d+)\/(\d+)[–\-](\d+)\/(\d+)(?:\/(\d+))?$/)
  if (!m) return null
  const yr = m[5] ? (parseInt(m[5]) < 50 ? 2000 + parseInt(m[5]) : 1900 + parseInt(m[5])) : TODAY.getFullYear()
  const s = new Date(yr, parseInt(m[2]) - 1, parseInt(m[1]))
  let e = new Date(yr, parseInt(m[4]) - 1, parseInt(m[3]), 23, 59, 59, 999)
  if (e < s) e.setFullYear(e.getFullYear() + 1)
  return { s, e }
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function periodIsCurrent(p) {
  const r = parseDR(p.dateRange)
  if (r) return TODAY >= r.s && TODAY <= r.e
  // Monthly name: "Jan", "Feb"…
  const mi = MONTH_NAMES.findIndex(m => p.name.startsWith(m))
  if (mi >= 0) return mi === TODAY.getMonth()
  // Thai Buddhist: "1-31/5/2569"  or  "1-30 /4/2569"
  const th = p.name.match(/\/(\d{1,2})\/(\d{4})/)
  if (th) return parseInt(th[1]) - 1 === TODAY.getMonth() && parseInt(th[2]) - 543 === TODAY.getFullYear()
  return false
}

// Derive a short display label for a period name
function periodLabel(name) {
  const th = name.match(/\/(\d{1,2})\/\d{4}$/)
  if (th) return MONTH_NAMES[parseInt(th[1]) - 1] || name
  return name
}

// Derive month groupings for timeline axis from a periods array
function groupPeriodsByMonth(periods) {
  const groups = []
  periods.forEach((p, i) => {
    const r = parseDR(p.dateRange)
    let mName = ''
    if (r) mName = MONTH_NAMES[r.s.getMonth()]
    else {
      const mi = MONTH_NAMES.findIndex(m => p.name.startsWith(m))
      if (mi >= 0) mName = MONTH_NAMES[mi]
      else {
        const th = p.name.match(/\/(\d{1,2})\//)
        mName = th ? (MONTH_NAMES[parseInt(th[1]) - 1] || 'Period') : 'Period'
      }
    }
    const last = groups[groups.length - 1]
    if (last && last.name === mName) last.count++
    else groups.push({ name: mName, count: 1, nowInside: false })
  })
  // mark which group contains today
  let acc = 0
  const nowIdx = periods.findIndex(p => periodIsCurrent(p))
  groups.forEach(g => { if (nowIdx >= acc && nowIdx < acc + g.count) g.nowInside = true; acc += g.count })
  return groups
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
    const company = m?.company || p.company || ''
    return { ...p, brand, company }
  })
}

// ── component ─────────────────────────────────────────────────────────────────
export default function PromoSection({ rawData, retailerData, t, dark, isMobile, onSelect, RetailerLogo }) {
  const [retailer, setRetailer] = useState(PROMO_RETAILERS[0] || '')
  const [brandFilter, setBrandFilter] = useState([])
  const [layout, setLayout] = useState('calendar')
  const [unlocked, setUnlocked] = useState(null)
  const [pin, setPin] = useState('')
  const [pinErr, setPinErr] = useState(false)
  const [openKey, setOpenKey] = useState(null)
  const [calcOpen, setCalcOpen] = useState(false)

  const calInnerRef = useRef(null)
  const tlInnerRef  = useRef(null)
  const [calNowX, setCalNowX] = useState(null)
  const [tlNowX,  setTlNowX]  = useState(null)

  // ── derived data ────────────────────────────────────────────────────────────
  const periods = useMemo(() => {
    return (PROMO_META[retailer]?.periods || []).map((p, i) => ({ ...p, idx: i, isCurrent: periodIsCurrent(p) }))
  }, [retailer])

  const currentIdx = useMemo(() => periods.findIndex(p => p.isCurrent), [periods])
  const months = useMemo(() => groupPeriodsByMonth(periods), [periods])

  const allItems = useMemo(() => {
    const raw = promoData.filter(p => p.retailer === retailer)
    return enrich(raw, rawData)
  }, [retailer, rawData])

  const brandList = useMemo(() => [...new Set(allItems.map(i => i.brand))].filter(Boolean).sort(), [allItems])

  const items = useMemo(() => {
    if (!brandFilter.length) return allItems
    return allItems.filter(i => brandFilter.includes(i.brand))
  }, [allItems, brandFilter])

  const grouped = useMemo(() => {
    const g = {}
    items.forEach(i => { (g[i.brand] = g[i.brand] || []).push(i) })
    return Object.entries(g)
  }, [items])

  // measure NOW column x-position from DOM after render (avoids unreliable CSS calc on %-in-max-content)
  useLayoutEffect(() => {
    function measure(innerEl, setter) {
      if (!innerEl || currentIdx < 0) { setter(null); return }
      const slot = innerEl.querySelector('.ps-now-ph') || innerEl.querySelector('.ps-now-slot')
      if (!slot) { setter(null); return }
      const sr = slot.getBoundingClientRect()
      const ir = innerEl.getBoundingClientRect()
      setter(Math.round(sr.left - ir.left) - 1)
    }
    if (layout === 'calendar') measure(calInnerRef.current, setCalNowX)
    else                       measure(tlInnerRef.current,  setTlNowX)
  }, [layout, retailer, currentIdx, brandFilter])

  // per-period activity dots from items (union of all cells in that period)
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
  const gpColor = gp => gp == null ? t.muted : gp >= 0.30 ? t.green : gp >= 0.20 ? t.yellow : t.red
  const coColor = c => c === 'Vcan' ? t.vcanClr : t.moolaClr
  const priceTxt = pd => pd.salePrice != null ? '฿' + pd.salePrice.toLocaleString('th-TH') : (pd.saleLabel || '')
  const off = (item, pd) => pd?.salePrice != null ? Math.round((1 - pd.salePrice / item.rspIncVat) * 100) : null

  const toggleBrand = b => setBrandFilter(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])
  const toggleChip = (key, e) => { e.stopPropagation(); setOpenKey(prev => prev === key ? null : key) }

  const submitPin = e => {
    e.preventDefault()
    const dept = DEPT_PINS[pin]
    if (dept) { setUnlocked(dept); setPin(''); setPinErr(false) }
    else { setPinErr(true); setPin('') }
  }

  // ── theme shorthands ─────────────────────────────────────────────────────────
  const s = t.surface, s2 = t.surface2, bdr = t.border, dim = t.dim, tx = t.text, mu = t.muted
  const rowHov = dark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.025)'
  const nowBg = dark ? 'rgba(240,192,64,.12)' : 'rgba(240,192,64,.16)'
  const nowLine = t.accent

  // ── sub-components ───────────────────────────────────────────────────────────
  function ActDots({ acts, size = 5 }) {
    return acts.map(a => ACT[a] ? (
      <i key={a} className="ps-chip-dot" title={ACT[a].label}
        style={{ background: ACT[a].color, boxShadow: `0 0 4px -1px ${ACT[a].color}`, width: size, height: size }} />
    ) : null)
  }

  function Calendar() {
    return (
      <div className="ps-cal-scroll" style={{ scrollbarColor: `${bdr} transparent` }}>
        {/* position:relative lets the NOW overlay span all rows including band rows */}
        <div className="ps-cal-inner" ref={calInnerRef} style={{ position: 'relative' }}>
          {/* NOW glow line — first in DOM so it paints behind rows and chips */}
          {calNowX !== null && (
            <div style={{
              position: 'absolute', top: 0, bottom: 0, pointerEvents: 'none',
              left: calNowX, width: 2, background: nowLine,
              boxShadow: `0 0 10px 3px ${nowLine}, 0 0 22px 6px rgba(240,192,64,.18)`,
            }} />
          )}
          {/* header */}
          <div className="ps-cal-head" style={{ background: s2, borderBottom: `1px solid ${bdr}` }}>
            <div className="ps-cal-rh" style={{ background: s2, borderRight: `1px solid ${bdr}`, color: mu }}>Product</div>
            {periods.map((p, i) => {
              const isNow = i === currentIdx
              const acts = actsByPeriod[p.name] || []
              return (
                <div key={p.name} className={`ps-cal-ph${isNow ? ' ps-now-ph' : ''}`}
                  style={{ background: isNow ? `linear-gradient(180deg,${nowBg},${s2})` : s2, borderLeft: `1px solid ${dim}` }}>
                  <div className="ps-cal-ph-code" style={{ color: isNow ? t.accent : tx }}>{periodLabel(p.name)}</div>
                  {p.dateRange && <div className="ps-cal-ph-rng" style={{ color: mu }}>{p.dateRange}</div>}
                  {isNow ? <div className="ps-now-tag" style={{ background: t.accent, color: '#1a1505' }}>NOW</div>
                    : <div className="ps-cal-ph-caps">{acts.map(a => ACT[a] && <i key={a} style={{ width: 6, height: 6, borderRadius: 99, background: ACT[a].color, boxShadow: `0 0 4px -1px ${ACT[a].color}` }} />)}</div>}
                </div>
              )
            })}
          </div>

          {/* rows */}
          {grouped.map(([brand, list]) => (
            <div key={brand}>
              {/* brand band */}
              <div className="ps-cal-band" style={{ background: s2, borderBottom: `1px solid ${bdr}`, borderTop: `1px solid ${bdr}` }}>
                <span className="ps-cal-band-dot" style={{ background: coColor(list[0].company) || t.accent }} />
                <span className="ps-cal-band-name" style={{ color: coColor(list[0].company) || t.accent }}>{brand}</span>
                <span className="ps-cal-band-count" style={{ color: mu }}>{list.length} SKU{list.length > 1 ? 's' : ''}</span>
              </div>
              {list.map(it => (
                <div key={it.barcode} className="ps-cal-row" style={{ borderColor: dim, background: s }}>
                  {/* product rail */}
                  <div className="ps-cal-rail" style={{ background: s, borderRight: `1px solid ${bdr}` }} onClick={() => onSelect?.(it)}>
                    <div className="ps-cal-rail-name" style={{ color: tx }}>{it.product}</div>
                    <div className="ps-cal-rail-sub">
                      <span className="ps-cal-rail-rsp" style={{ color: mu }}>RSP ฿{it.rspIncVat}</span>
                      {unlocked && <span className="ps-cal-rail-gp" style={{ color: gpColor(it.gp) }}>GP {Math.round(it.gp * 100)}%</span>}
                      {it.clearance && <span className="ps-cal-rail-tag" style={{ color: CLEAR_COLOR, background: 'rgba(34,211,238,.14)' }}>CLEAR</span>}
                    </div>
                  </div>
                  {/* period cells */}
                  {periods.map((p, i) => {
                    const pd = it.periods?.[p.name]
                    const isNow = i === currentIdx
                    const prim = (pd?.activities || []).find(a => ACT[a])
                    const mc = prim ? ACT[prim].color : it.clearance ? CLEAR_COLOR : t.accent
                    const ckey = it.barcode + '|' + p.name
                    const pctOff = off(it, pd)
                    if (!pd) return (
                      <div key={p.name} className="ps-cal-cell ps-cal-cell-empty"
                        style={{ borderLeft: `1px solid ${dim}`, background: isNow ? nowBg : 'transparent', color: mu }} />
                    )
                    return (
                      <div key={p.name} className={`ps-cal-cell${isNow ? ' ps-now-cell' : ''}`}
                        style={{ borderLeft: `1px solid ${dim}`, background: isNow ? nowBg : 'transparent',
                          boxShadow: isNow ? 'inset -2px 0 10px rgba(240,192,64,.28)' : 'none' }}>
                        <span className="ps-chip" onClick={e => toggleChip(ckey, e)}
                          style={{ background: prim ? `color-mix(in srgb, ${mc} 14%, ${s2})` : dark ? `color-mix(in srgb, ${t.accent} 12%, ${s2})` : `color-mix(in srgb, ${t.accent} 18%, ${s2})`,
                            border: `1px solid ${prim ? mc + '88' : t.accent + '55'}` }}>
                          {pctOff != null && pctOff > 0 && <span className="ps-tip">−{pctOff}%</span>}
                          <span className="ps-chip-pr" style={{ color: tx }}>{priceTxt(pd)}</span>
                          {openKey === ckey && pctOff != null && pctOff > 0 && (
                            <span className="ps-chip-off">−{pctOff}%</span>
                          )}
                          {openKey === ckey && unlocked && pd.compensate != null && (
                            <span style={{ fontSize: 9, fontFamily: 'monospace', color: t.blue || '#58a6ff', fontWeight: 700 }}>฿{pd.compensate.toFixed(2)}</span>
                          )}
                          {(pd.activities || []).length > 0 && (
                            <span className="ps-chip-dots"><ActDots acts={pd.activities} size={5} /></span>
                          )}
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

  function Timeline() {
    return (
      <div className="ps-tl-scroll" style={{ scrollbarColor: `${bdr} transparent` }}>
        <div className="ps-tl-inner" ref={tlInnerRef} style={{ position: 'relative' }}>
          {/* NOW glow line — first in DOM so it paints behind rows and bars */}
          {tlNowX !== null && (
            <div style={{
              position: 'absolute', top: 0, bottom: 0, pointerEvents: 'none',
              left: tlNowX, width: 2, background: nowLine,
              boxShadow: `0 0 10px 3px ${nowLine}, 0 0 22px 6px rgba(240,192,64,.18)`,
            }} />
          )}

          {/* month axis only — cleaner than calendar's period-code grid */}
          <div className="ps-tl-axis" style={{ background: s2, borderBottom: `2px solid ${bdr}` }}>
            <div className="ps-tl-lead" style={{ background: s2, borderRight: `1px solid ${bdr}`, color: mu }}>Product</div>
            <div className="ps-tl-months">
              {months.map((m, i) => (
                <div key={i} className="ps-tl-month" style={{
                  flexGrow: m.count,
                  background: m.nowInside ? `linear-gradient(180deg,${nowBg},transparent)` : 'transparent',
                  borderLeftColor: dim,
                }}>
                  <b style={{ color: m.nowInside ? t.accent : tx }}>{m.name}</b>
                  <small style={{ color: mu }}>2026</small>
                </div>
              ))}
            </div>
          </div>

          {/* brand swimlanes */}
          {grouped.map(([brand, list]) => (
            <div key={brand}>
              {/* thin colored brand header strip (sticky left) */}
              <div className="ps-tl-brand-hdr" style={{
                borderLeft: `4px solid ${coColor(list[0].company) || t.accent}`,
                background: dark ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.03)',
                borderBottom: `1px solid ${dim}`,
                borderTop: `1px solid ${bdr}`,
              }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: coColor(list[0].company) || t.accent }}>{brand}</span>
                <span style={{ fontSize: 9.5, fontFamily: 'monospace', color: mu, marginLeft: 8 }}>{list.length} SKU{list.length > 1 ? 's' : ''}</span>
              </div>

              {/* product rows — Gantt bar style */}
              {list.map(it => (
                <div key={it.barcode} className="ps-tl-row" style={{ borderColor: dim, minHeight: 68 }}>
                  {/* left panel */}
                  <div className="ps-tl-row-lead" style={{
                    background: s, borderRight: `1px solid ${bdr}`,
                    borderLeft: `3px solid ${coColor(it.company) || t.accent}`,
                  }} onClick={() => onSelect?.(it)}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: tx, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>{it.product}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: mu }}>฿{it.rspIncVat}</span>
                      {unlocked && <span style={{ fontSize: 10, fontFamily: 'monospace', fontWeight: 700, color: gpColor(it.gp) }}>GP {Math.round(it.gp * 100)}%</span>}
                      {it.clearance && <span style={{ fontSize: 8.5, fontWeight: 800, color: CLEAR_COLOR, background: 'rgba(34,211,238,.14)', borderRadius: 4, padding: '1px 5px', letterSpacing: '.04em' }}>CLEAR</span>}
                    </div>
                  </div>

                  {/* Gantt lane */}
                  <div className="ps-tl-lane">
                    {periods.map((p, i) => {
                      const pd = it.periods?.[p.name]
                      const isNow = i === currentIdx
                      const prim = (pd?.activities || []).find(a => ACT[a])
                      const mc = prim ? ACT[prim].color : it.clearance ? CLEAR_COLOR : t.accent
                      const ckey = it.barcode + '|' + p.name
                      const pctOff = off(it, pd)
                      return (
                        <div key={p.name}
                          className={`ps-tl-slot${isNow ? ' ps-now-slot' : ''}`}
                          style={{ borderLeftColor: 'transparent', background: isNow ? nowBg : 'transparent', minHeight: 68 }}>
                          {pd && (
                            <span className="ps-bar" onClick={e => toggleChip(ckey, e)}
                              style={{
                                background: `linear-gradient(135deg, ${mc}e0, ${mc}99)`,
                                boxShadow: `0 2px 10px ${mc}55, inset 0 1px 0 rgba(255,255,255,.18)`,
                              }}>
                              {pctOff != null && pctOff > 0 && <span className="ps-tip">−{pctOff}%</span>}
                              <span className="ps-bar-pr">{priceTxt(pd)}</span>
                              {pctOff != null && pctOff > 0 && <span className="ps-bar-off">−{pctOff}%</span>}
                              {(pd.activities || []).length > 0 && (
                                <span className="ps-bar-dots">
                                  {pd.activities.map(a => ACT[a]
                                    ? <i key={a} style={{ width: 6, height: 6, borderRadius: 99, background: ACT[a].color, boxShadow: `0 0 4px ${ACT[a].color}`, display: 'inline-block' }} />
                                    : null)}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}

        </div>
      </div>
    )
  }

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* customer select — uses RetailerLogo prop (same as the main app) */}
      <div className="ps-pills">
        <span className="ps-label" style={{ color: mu }}>Customer</span>
        {PROMO_RETAILERS.map(r => (
          <button key={r} onClick={() => { setRetailer(r); setBrandFilter([]) }} title={r} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: isMobile ? 60 : 76, height: isMobile ? 42 : 38,
            padding: '4px 6px', cursor: 'pointer', fontFamily: 'inherit',
            background: retailer === r ? `${t.accent}18` : s2,
            border: `1.5px solid ${retailer === r ? t.accent : bdr}`,
            borderRadius: 10,
            boxShadow: retailer === r ? `0 0 0 3px ${t.accent}22` : 'none', transition: '.15s',
          }}>
            {RetailerLogo
              ? <RetailerLogo name={r} h={isMobile ? 24 : 20} maxW={isMobile ? 54 : 68}
                  fallbackStyle={{ fontSize: 10, fontWeight: 700, color: retailer === r ? t.accent : tx, textAlign: 'center', lineHeight: 1.2 }} />
              : <span style={{ fontSize: 11, fontWeight: 700, color: retailer === r ? t.accent : tx }}>{r}</span>
            }
          </button>
        ))}
      </div>

      {/* brand filter */}
      {brandList.length > 0 && (
        <div className="ps-pills">
          <span className="ps-label" style={{ color: mu }}>Brand</span>
          <button className="ps-brand-pill" onClick={() => setBrandFilter([])} style={{
            background: !brandFilter.length ? t.accent : s2, color: !brandFilter.length ? '#1a1505' : tx,
            border: `1.5px solid ${!brandFilter.length ? t.accent : bdr}`,
            borderRadius: 99, padding: '6px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>All</button>
          {brandList.map(b => (
            <button key={b} onClick={() => toggleBrand(b)} style={{
              background: brandFilter.includes(b) ? t.accent : s2,
              color: brandFilter.includes(b) ? '#1a1505' : tx,
              border: `1.5px solid ${brandFilter.includes(b) ? t.accent : bdr}`,
              borderRadius: 99, padding: '6px 14px', fontSize: 12.5, fontWeight: brandFilter.includes(b) ? 700 : 500,
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>{b}</button>
          ))}
        </div>
      )}

      {/* toolbar: layout toggle + legend + tools */}
      <div className="ps-toolbar">
        <div className="ps-seg" style={{ background: s2, border: `1px solid ${bdr}` }}>
          {[['calendar','📅 Calendar'], ['timeline','📊 Timeline']].map(([k, l]) => (
            <button key={k} className={layout === k ? 'on' : ''} onClick={() => setLayout(k)} style={{
              background: layout === k ? `linear-gradient(160deg,${t.accent},${t.orange || t.accent})` : 'none',
              color: layout === k ? '#1a1505' : mu,
            }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 13, alignItems: 'center', flexWrap: 'wrap' }}>
          {Object.entries(ACT).map(([k, a]) => (
            <span key={k} className="ps-actleg" style={{ color: mu }}>
              <span className="ps-actleg-dot" style={{ background: a.color, boxShadow: `0 0 5px -1px ${a.color}` }} />
              {a.label}
            </span>
          ))}
          <span className="ps-actleg" style={{ color: mu }}>
            <span className="ps-actleg-dot" style={{ background: CLEAR_COLOR, boxShadow: `0 0 5px -1px ${CLEAR_COLOR}` }} />
            เคลียร์สินค้า
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginLeft: 'auto' }}>
          <button onClick={() => setCalcOpen(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, background: t.accent, border: 'none',
            borderRadius: 8, color: '#1a1505', fontSize: 12, fontWeight: 700, padding: '7px 14px',
            cursor: 'pointer', fontFamily: 'inherit',
          }}>🧮 Compensate Calc</button>
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
              <button type="submit" style={{ border: 0, borderLeft: `1px solid ${bdr}`, background: s, color: mu, fontSize: 11, fontWeight: 700, padding: '0 12px', cursor: 'pointer', fontFamily: 'inherit' }}>Unlock</button>
            </form>
          )}
        </div>
      </div>

      {/* main card */}
      <div style={{ background: s, border: `1px solid ${bdr}`, borderRadius: 12, overflow: 'hidden', boxShadow: dark ? 'none' : '0 2px 8px rgba(0,0,0,.06)' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: `1px solid ${bdr}`, background: dark ? 'rgba(255,255,255,.025)' : 'rgba(0,0,0,.02)' }}>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.02em', color: tx }}>{retailer}</span>
          <span style={{ fontSize: 12, color: mu, fontWeight: 600 }}>{items.length} products · {periods.length} periods</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: mu, fontFamily: 'monospace' }}>
            {periods[0]?.dateRange?.split('-')[0] || ''} → {periods[periods.length - 1]?.dateRange?.split('-')[1] || ''}
          </span>
        </div>
        {items.length === 0
          ? <div style={{ padding: '56px 0', textAlign: 'center', color: mu }}>ไม่พบข้อมูลที่ตรงกับ filter</div>
          : layout === 'calendar' ? <Calendar /> : <Timeline />
        }
      </div>

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

  const result = useMemo(() => {
    if (rsp == null) return { err: 'ค้นหาและเลือก product ก่อน' }
    if (type !== 'b2g1' && isNaN(p)) return { err: 'ใส่ราคาโปรโมชัน' }
    const eff = type === '2for' ? p / 2 : p
    let comp
    if (type === 'b2g1') comp = mode === 'keepgp' ? costAt(rsp) : rsp
    else if (mode === 'keepgp') comp = costAt(rsp) - costAt(eff)
    else comp = rsp - eff
    return { comp }
  }, [bc, type, mode, promo])

  const s = t.surface, s2 = t.surface2, bdr = t.border, tx = t.text, mu = t.muted

  return (
    <div className="ps-modal-backdrop" onClick={onClose} style={{ background: 'rgba(4,6,12,.55)' }}>
      <div className="ps-modal" onClick={e => e.stopPropagation()} style={{ background: s, borderColor: bdr, boxShadow: '0 16px 48px rgba(0,0,0,.4)' }}>
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
          {/* type toggle */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 10, background: s2, border: `1px solid ${bdr}`, borderRadius: 10, padding: 3 }}>
            {[['single','Single'],['2for','2 for X'],['b2g1','B2G1']].map(([k,l]) => (
              <button key={k} onClick={() => setType(k)} style={{ flex: 1, border: 0, borderRadius: 7, padding: '6px 0', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12,
                background: type === k ? `linear-gradient(160deg,${t.accent},${t.orange||t.accent})` : 'none',
                color: type === k ? '#1a1505' : mu }}>{l}</button>
            ))}
          </div>
          {/* mode toggle */}
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
