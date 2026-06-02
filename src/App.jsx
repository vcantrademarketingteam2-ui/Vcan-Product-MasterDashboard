import { useState, useMemo, useEffect, useRef } from 'react'
import fallbackData, { GENERATED_AT } from './data.js'
import retailerData from './retailer_data.js'
import vcanLogo from './VCAN.png'

const RETAILERS = ['Tops', 'Villa', 'The Mall', 'Lotus', 'Homepro', 'Big C', 'TWD', 'Boots', 'Foodland', 'Central Department', "Pet'n me", 'Fuji']
const PRICING_PASSWORD = '2745'

const fmtTs = (d) => {
  const dt = new Date(d)
  if (isNaN(dt)) return null
  return dt.toLocaleDateString('th-TH', { dateStyle: 'short' }) + '  ' + dt.toLocaleTimeString('th-TH', { timeStyle: 'short' })
}
const RETAILER_SHORT = {
  'Tops': 'TOPS', 'Villa': 'VILLA', 'The Mall': 'THE MALL', 'Lotus': 'LOTUS',
  'Homepro': 'HOMEPRO', 'Big C': 'BIG C', 'TWD': 'TWD', 'Boots': 'BOOTS',
  'Foodland': 'FOODLAND', 'Central Department': 'CENTRAL', "Pet'n me": "PET'N ME", 'Fuji': 'FUJI'
}
// Drop logo files into public/retailers/ with these exact names to replace the text labels.
const RETAILER_LOGOS = {
  'Tops': '/retailers/tops.jpg',
  'Villa': '/retailers/villa.png',
  'The Mall': '/retailers/the-mall.png',
  'Lotus': '/retailers/lotus.png',
  'Homepro': '/retailers/homepro.png',
  'Big C': '/retailers/bigc.png',
  'TWD': '/retailers/twd.png',
  'Boots': '/retailers/boots.png',
  'Foodland': '/retailers/foodland.png',
  'Central Department': '/retailers/central.jpg',
  "Pet'n me": '/retailers/petnme.jpg',
  'Fuji': '/retailers/fuji.png',
}

// Wide wordmark logos (ratio ≫ 1) get a bigger width budget so they aren't capped
// down to a tiny height. Multiplies maxW only — rendered height stays uniform.
const RETAILER_LOGO_SCALE = {
  'Central Department': 2.4, // "CENTRAL RETAIL" wordmark, ~4:1
  "Pet'n me": 1.9,           // ~3.75:1
}

// Renders a retailer's logo on a white chip (so dark/transparent logos never blend
// into the row), falling back to the short text label if the image is missing.
function RetailerLogo({ name, h = 28, maxW = 76, fallbackStyle = {} }) {
  const [err, setErr] = useState(false)
  const src = RETAILER_LOGOS[name]
  if (err || !src) return <span style={{ whiteSpace: 'nowrap', ...fallbackStyle }}>{RETAILER_SHORT[name] || name}</span>
  const mw = maxW * (RETAILER_LOGO_SCALE[name] || 1)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: '#fff', borderRadius: 4, padding: '1px 2px', lineHeight: 0, boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }}>
      <img
        src={src}
        alt={RETAILER_SHORT[name] || name}
        title={name}
        onError={() => setErr(true)}
        style={{ height: h, width: 'auto', maxWidth: mw, objectFit: 'contain', display: 'block' }}
      />
    </span>
  )
}

function parseCSVToRows(text) {
  // Parses the full CSV text at once, correctly handling multi-line quoted fields
  const rows = []
  let cur = '', curRow = [], inQ = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQ && text[i + 1] === '"') { cur += '"'; i++ }
      else inQ = !inQ
    } else if (ch === ',' && !inQ) {
      curRow.push(cur); cur = ''
    } else if ((ch === '\n' || ch === '\r') && !inQ) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      curRow.push(cur); rows.push(curRow); curRow = []; cur = ''
    } else {
      cur += ch
    }
  }
  curRow.push(cur)
  if (curRow.some(c => c)) rows.push(curRow)
  return rows
}

function parseCSV(text) {
  const allRows = parseCSVToRows(text)
  const rows = []
  let currentCompany = '', currentBrand = ''
  const VENDORS = ['Vcan', 'Moola']
  const tr = (s) => (s || '').trim()
  const isBarcode = (s) => /^\d{8,}$/.test(tr(s))
  const normalizeBrand = (b) => {
    b = b.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
    if (/dove.?men/i.test(b) || /^shampoo$/i.test(b)) return 'Dove Men'
    return b
  }
  for (let i = 3; i < allRows.length; i++) {
    const row = allRows[i].map(tr)
    if (!row.some(c => c)) continue
    const c0 = row[0], c1 = row[1], c2 = row[2]
    if (VENDORS.includes(c0)) currentCompany = c0
    let barcode = '', product = '', packSize = '', rsp = '', status = '', retailerOffset = 8
    if (isBarcode(c1) && c0 && !VENDORS.includes(c0) && !isBarcode(c0)) {
      // Layout B: c0=brand, c1=barcode — checked BEFORE Layout A
      currentBrand = normalizeBrand(c0)
      barcode = c1; product = row[3] || ''; packSize = row[4] || ''
      rsp = (row[5] || '').replace(/[^\d.]/g, ''); status = row[6] || ''; retailerOffset = 7
    } else if (isBarcode(c2)) {
      // Layout A (c1=brand, c2=barcode) or Layout C (inherited brand)
      if (c1 && !isBarcode(c1)) currentBrand = normalizeBrand(c1)
      barcode = c2; product = row[4] || ''; packSize = row[5] || ''
      rsp = (row[6] || '').replace(/[^\d.]/g, ''); status = row[7] || ''; retailerOffset = 8
    } else continue
    // Google Sheets strips leading zeros from numeric UPC-A barcodes (12-digit → 11-digit)
    if (barcode.length === 11) barcode = '0' + barcode
    if (!barcode || !product || product.trim().toLowerCase() === 'total') continue
    if (!isBarcode(barcode)) continue
    const retailerStatus = {}
    RETAILERS.forEach((r, j) => { retailerStatus[r] = row[retailerOffset + j] || '' })
    const brandFinal = (currentBrand !== 'Dove Men' && /dove.?men/i.test(product)) ? 'Dove Men' : currentBrand
    rows.push({ company: currentCompany, brand: brandFinal, barcode, product, packSize, rsp: rsp ? parseFloat(rsp) : 0, status, retailers: retailerStatus })
  }
  return rows
}

// ── PackshotImg: tries jpg → png → webp → placeholder ─────────────────────
function PackshotImg({ barcode, side = 'front', style = {}, placeholderSize = 40, onSrcChange }) {
  const EXTS = ['webp', 'jpg', 'png']
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => { setIdx(0); setFailed(false) }, [barcode, side])
  const src = `/packshots/${barcode}_${side}.${EXTS[idx]}`
  if (failed) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(128,128,128,0.08)', borderRadius: 8, gap: 6, ...style }}>
      <span style={{ fontSize: placeholderSize * 0.9, opacity: 0.3 }}>📦</span>
      <span style={{ fontSize: 10, color: '#888', opacity: 0.6 }}>No image</span>
    </div>
  )
  return (
    <img
      src={src}
      alt=""
      onLoad={() => onSrcChange && onSrcChange(src)}
      onError={() => idx < EXTS.length - 1 ? setIdx(i => i + 1) : setFailed(true)}
      style={{ objectFit: 'contain', ...style }}
    />
  )
}

// ── ProductPopup ────────────────────────────────────────────────────────────
function ProductPopup({ product, onClose, t, dark, isMobile = false, pricing = {}, variant = 'products' }) {
  const [side, setSide] = useState('front')
  const [loadedSrc, setLoadedSrc] = useState(null)
  const [zoomed, setZoomed] = useState(false)
  const [zoomScale, setZoomScale] = useState(1)
  const [panPos, setPanPos] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  // pricing lock — persists across products within the same session
  const [pricingUnlocked, setPricingUnlocked] = useState(() => sessionStorage.getItem('pu') === '1')
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)
  const lbRef = useRef(null)
  const dragRef = useRef(null)
  useEffect(() => {
    setSide('front')
    setLoadedSrc(null)
    setZoomed(false)
    setZoomScale(1)
    setPanPos({ x: 0, y: 0 })
    // Esc: close lightbox first, then popup
    const h = (e) => {
      if (e.key === 'Escape') {
        setZoomed(prev => { if (prev) return false; onClose(); return prev })
      }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [product, onClose])
  // Reset zoom + pan whenever lightbox closes
  useEffect(() => { if (!zoomed) { setZoomScale(1); setPanPos({ x: 0, y: 0 }) } }, [zoomed])
  // Ctrl+Scroll zoom — must be non-passive to call preventDefault
  useEffect(() => {
    if (!zoomed) return
    const el = lbRef.current; if (!el) return
    const onWheel = (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setZoomScale(prev => Math.max(0.25, Math.min(8, prev * (e.deltaY < 0 ? 1.12 : 1 / 1.12))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomed])
  if (!product) return null
  const statusColor = product.status === 'ขาย' ? t.green : product.status === 'รอขาย' ? t.yellow : t.red
  const statusLabel = product.status === 'ขาย' ? 'Active' : product.status === 'รอขาย' ? 'Pending' : 'Discontinued'
  const dlName = loadedSrc ? `${product.barcode}_${side}${loadedSrc.slice(loadedSrc.lastIndexOf('.'))}` : ''
  // Inline icon components
  const IconZoom = () => (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="5.5" cy="5.5" r="4"/>
      <line x1="8.9" y1="8.9" x2="13" y2="13"/>
      <line x1="5.5" y1="3.5" x2="5.5" y2="7.5"/>
      <line x1="3.5" y1="5.5" x2="7.5" y2="5.5"/>
    </svg>
  )
  const IconDl = () => (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 1v8M4.5 7.5l2.5 2.5 2.5-2.5"/>
      <path d="M1 12h12"/>
    </svg>
  )

  // ── Reusable popup pieces — arranged differently per `variant` ──
  // hero=true → big centered image (Packshot view); hero=false → narrow side panel (Products view)
  const imagePanel = (hero) => (
    <div style={{ width: hero ? '100%' : (isMobile ? '100%' : 260), minWidth: hero ? 'unset' : (isMobile ? 'unset' : 220), flexShrink: 0, padding: hero ? '24px 16px 18px' : (isMobile ? '16px' : '20px 16px'), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, borderRight: hero || isMobile ? 'none' : `1px solid ${t.border}`, borderBottom: isMobile || hero ? `1px solid ${t.border}` : 'none', background: hero ? (dark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.015)') : 'transparent' }}>
      <PackshotImg barcode={product.barcode} side={side} onSrcChange={setLoadedSrc} style={{ width: hero ? 'auto' : '100%', maxWidth: hero ? 420 : 'unset', height: hero ? 320 : (isMobile ? 180 : 220), borderRadius: 8, background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }} placeholderSize={56} />
      {/* Controls row: Front/Back · Zoom · Save */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        {['front', 'back'].map(s => (
          <button key={s} onClick={() => { setSide(s); setLoadedSrc(null) }} style={{ padding: '5px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: side === s ? t.accent : t.surface2, color: side === s ? '#000' : t.muted, border: `1px solid ${side === s ? t.accent : t.border}` }}>
            {s === 'front' ? '▶ Front' : '◀ Back'}
          </button>
        ))}
        <span style={{ width: 1, height: 22, background: t.border, flexShrink: 0 }} />
        <button onClick={() => loadedSrc && setZoomed(true)} title="ขยายดูรูป (Zoom)" style={{ padding: '5px 10px', borderRadius: 8, cursor: loadedSrc ? 'zoom-in' : 'default', background: t.surface2, color: loadedSrc ? t.text : t.muted, border: `1px solid ${loadedSrc ? t.border : 'transparent'}`, opacity: loadedSrc ? 1 : 0.35, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600 }}>
          <IconZoom /> Zoom
        </button>
        {loadedSrc ? (
          <a href={loadedSrc} download={dlName} title="ดาวน์โหลดรูป" style={{ padding: '5px 10px', borderRadius: 8, cursor: 'pointer', background: t.surface2, color: t.text, border: `1px solid ${t.border}`, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600 }}>
            <IconDl /> Save
          </a>
        ) : (
          <span style={{ padding: '5px 10px', borderRadius: 8, background: 'transparent', color: t.muted, border: '1px solid transparent', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, opacity: 0.35 }}>
            <IconDl /> Save
          </span>
        )}
      </div>
    </div>
  )

  const statsRow = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {[
        { label: 'RSP', value: product.rsp ? `฿${product.rsp}` : '—' },
        { label: 'Pack Size', value: product.packSize || '—' },
        { label: 'Status', value: statusLabel, color: statusColor },
      ].map(({ label, value, color }) => (
        <div key={label} style={{ flex: 1, background: t.surface2, borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: color || t.text }}>{value}</div>
        </div>
      ))}
    </div>
  )

  const pricingBlock = () => Object.keys(pricing).length > 0 ? (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Retailer Pricing</div>
        {pricingUnlocked && (
          <button onClick={() => { setPricingUnlocked(false); sessionStorage.removeItem('pu') }} style={{ background: 'none', border: 'none', fontSize: 10, color: t.muted, cursor: 'pointer', padding: '2px 6px', opacity: 0.6 }}>🔒 Lock</button>
        )}
      </div>
      {!pricingUnlocked ? (
        <div style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, padding: '18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 28, lineHeight: 1 }}>🔒</div>
          <div style={{ fontSize: 12, color: t.muted, fontWeight: 600, textAlign: 'center' }}>Cost & GP data is confidential<br/>Enter PIN to view</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="password"
              inputMode="numeric"
              maxLength={10}
              value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPwError(false) }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (pwInput === PRICING_PASSWORD) { setPricingUnlocked(true); sessionStorage.setItem('pu', '1'); setPwInput('') }
                  else { setPwError(true); setPwInput('') }
                }
              }}
              placeholder="PIN"
              style={{ width: 90, background: t.surface, border: `1.5px solid ${pwError ? '#f85149' : t.border}`, borderRadius: 8, color: t.text, padding: '8px 12px', fontSize: 14, textAlign: 'center', outline: 'none', letterSpacing: 4 }}
              autoFocus
            />
            <button
              onClick={() => {
                if (pwInput === PRICING_PASSWORD) { setPricingUnlocked(true); sessionStorage.setItem('pu', '1'); setPwInput('') }
                else { setPwError(true); setPwInput('') }
              }}
              style={{ background: t.accent, border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, fontSize: 12, padding: '8px 16px', cursor: 'pointer' }}
            >Unlock</button>
          </div>
          {pwError && <div style={{ fontSize: 11, color: '#f85149', fontWeight: 600 }}>Incorrect PIN</div>}
        </div>
      ) : (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, minWidth: 220 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                <th style={{ textAlign: 'left', padding: '4px 8px', color: t.muted, fontWeight: 700, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Retailer</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: t.muted, fontWeight: 700, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Cost/Unit</th>
                <th style={{ textAlign: 'right', padding: '4px 8px', color: t.muted, fontWeight: 700, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>GP</th>
              </tr>
            </thead>
            <tbody>
              {RETAILERS.filter(r => pricing[r]).map(r => {
                const d = pricing[r]
                const gpColor = d.gp >= 0.30 ? t.green : d.gp >= 0.20 ? t.yellow : t.red
                return (
                  <tr key={r} style={{ borderBottom: `1px solid ${t.dim}` }}>
                    <td style={{ padding: '5px 8px', fontWeight: 700, color: t.text, whiteSpace: 'nowrap' }}>{r}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', color: t.text, whiteSpace: 'nowrap' }}>{d.costUnit != null ? '฿' + d.costUnit.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: d.gp != null ? gpColor : t.muted }}>{d.gp != null ? Math.round(d.gp * 100) + '%' : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  ) : null

  const coverageBlock = (cols) => (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
        <div style={{ fontSize: 11, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Retailer Coverage</div>
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          {[
            { label: 'Active', bg: t.green },
            { label: 'Pending', bg: t.yellow },
            { label: 'On Process', bg: t.blue },
            { label: 'Discon', bg: t.red },
          ].map(({ label, bg }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: t.muted, fontWeight: 600 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: bg, display: 'inline-block', flexShrink: 0 }} />{label}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 6 }}>
        {RETAILERS.map(r => {
          const v = product.retailers[r] || ''
          const isActive = v === 'A'
          const isPending = v === 'รอขาย' || v === 'On Process'
          const isDiscon = v === 'ยกเลิกขาย'
          const dotColor = isActive ? t.green : isPending ? t.yellow : isDiscon ? t.red : t.dim
          const dotBg = isActive ? `${t.green}22` : isPending ? `${t.yellow}22` : isDiscon ? `${t.red}22` : 'transparent'
          return (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', borderRadius: 8, background: dotBg, border: `1px solid ${isActive || isPending || isDiscon ? dotColor + '44' : t.border}` }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0, display: 'inline-block' }} />
              <span style={{ fontSize: 11.5, fontWeight: isActive ? 700 : 400, color: isActive || isPending || isDiscon ? t.text : t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r}</span>
            </div>
          )
        })}
      </div>
    </div>
  )

  const isPackshotView = variant === 'packshot' && !isMobile

  return (
    <>
      {/* ── Lightbox ── */}
      {zoomed && loadedSrc && (
        <div
          ref={lbRef}
          onClick={() => setZoomed(false)}
          onMouseMove={(e) => {
            if (!dragRef.current) return
            setPanPos({ x: dragRef.current.ox + (e.clientX - dragRef.current.startX), y: dragRef.current.oy + (e.clientY - dragRef.current.startY) })
          }}
          onMouseUp={() => { dragRef.current = null; setIsDragging(false) }}
          onMouseLeave={() => { dragRef.current = null; setIsDragging(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 24 }}
        >
          {/* Wrapper: handles pan (translate) + drag start */}
          <div
            onClick={e => e.stopPropagation()}
            onDoubleClick={() => { setZoomScale(1); setPanPos({ x: 0, y: 0 }) }}
            onMouseDown={(e) => {
              if (zoomScale <= 1) return
              e.preventDefault(); e.stopPropagation()
              dragRef.current = { startX: e.clientX, startY: e.clientY, ox: panPos.x, oy: panPos.y }
              setIsDragging(true)
            }}
            style={{ transform: `translate(${panPos.x}px, ${panPos.y}px)`, userSelect: 'none', cursor: isDragging ? 'grabbing' : (zoomScale > 1 ? 'grab' : 'default') }}
          >
            <img
              src={loadedSrc} alt=""
              style={{
                maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 10,
                boxShadow: '0 0 80px rgba(0,0,0,0.7)',
                transform: `scale(${zoomScale})`, transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease',
                display: 'block', pointerEvents: 'none',
              }}
            />
          </div>
          {/* Close */}
          <button onClick={() => setZoomed(false)} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '50%', color: '#fff', fontSize: 18, width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>✕</button>
          {/* Zoom badge */}
          {zoomScale !== 1 && (
            <div onClick={e => { e.stopPropagation(); setZoomScale(1); setPanPos({ x: 0, y: 0 }) }} style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(6px)', borderRadius: 20, padding: '5px 16px', color: '#fff', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer' }}>
              {Math.round(zoomScale * 100)}% — click to reset
            </div>
          )}
          {/* Caption + hint */}
          <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', borderRadius: 20, padding: '7px 20px', color: '#e6edf3', fontSize: 12, fontWeight: 600, maxWidth: '90vw', pointerEvents: 'none', textAlign: 'center' }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.product} — {side === 'front' ? '▶ Front' : '◀ Back'}</div>
            {!isMobile && <span style={{ opacity: 0.45, fontWeight: 400, fontSize: 10 }}>Ctrl+Scroll zoom · Drag to pan · Double-click reset</span>}
          </div>
        </div>
      )}
      {/* ── Popup backdrop + card ── */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 2000, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 24, backdropFilter: 'blur(3px)' }}>
        <div onClick={e => e.stopPropagation()} style={{ background: t.surface, borderRadius: isMobile ? '16px 16px 0 0' : 18, width: '100%', maxWidth: isMobile ? '100%' : 860, maxHeight: isMobile ? '95dvh' : '90vh', overflow: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.5)', border: `1px solid ${t.border}` }}>
          {/* Mobile drag handle */}
          {isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 6 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: t.border }} />
            </div>
          )}
          {/* Header */}
          <div style={{ padding: isMobile ? '10px 14px 14px' : '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'flex-start', gap: 12, background: t.surface2 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: t.text, lineHeight: 1.4, marginBottom: 4 }}>{product.product}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: product.company === 'Vcan' ? t.vcanClr : t.moolaClr }}>{product.company}</span>
                <span style={{ color: t.border }}>·</span>
                <span style={{ fontSize: 12, color: t.muted }}>{product.brand}</span>
                <span style={{ color: t.border }}>·</span>
                <span style={{ fontSize: 11, fontFamily: 'monospace', color: t.muted }}>{product.barcode}</span>
              </div>
            </div>
            <button onClick={onClose} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, color: t.muted, fontSize: 20, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
          </div>
          {/* Body — Packshot view = image-forward (hero on top); Products view = data-forward (image left) */}
          {isPackshotView ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {imagePanel(true)}
              <div style={{ padding: '18px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {statsRow}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22, alignItems: 'start' }}>
                  {pricingBlock()}
                  {coverageBlock('repeat(2, 1fr)')}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 0, flexDirection: isMobile ? 'column' : 'row', flexWrap: 'nowrap' }}>
              {imagePanel(false)}
              <div style={{ flex: 1, minWidth: 0, padding: isMobile ? '16px' : '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {statsRow}
                {pricingBlock()}
                {coverageBlock('repeat(3, 1fr)')}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default function App() {
  const [rawData, setRawData] = useState(fallbackData)
  const [lastUpdated, setLastUpdated] = useState(() => fmtTs(__BUILD_TIME__))
  const [dataSource, setDataSource] = useState('xlsx')
  const [dark, setDark] = useState(true)
  const [tab, setTab] = useState('products')
  const [vendorFilter, setVendorFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [selectedBrands, setSelectedBrands] = useState([])
  const [selectedRetailers, setSelectedRetailers] = useState([])
  const [statusTab, setStatusTab] = useState('ALL')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState(null)
  const [psSearch, setPsSearch] = useState('')
  const [psRetailers, setPsRetailers] = useState([])
  const togglePsRetailer = (r) => setPsRetailers(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setMobileNavOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const handleImportCSV = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = parseCSV(ev.target.result)
        if (parsed.length > 0) {
          setRawData(parsed); setDataSource('csv'); setSelectedBrands([])
          setVendorFilter('ALL'); setStatusTab('ALL'); setSearch('')
          setLastUpdated(fmtTs(file.lastModified))
          alert('✅ Import สำเร็จ! พบ ' + parsed.length + ' รายการจาก "' + file.name + '"')
        } else alert('❌ ไม่พบข้อมูลในไฟล์ กรุณาตรวจสอบ format ของ CSV')
      } catch { alert('❌ เกิดข้อผิดพลาดในการอ่านไฟล์') }
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  const VENDOR_BRANDS = useMemo(() => ({
    ALL: [...new Set(rawData.map(p => p.brand.trim()))].filter(Boolean).sort(),
    Vcan: [...new Set(rawData.filter(p => p.company === 'Vcan').map(p => p.brand.trim()))].filter(Boolean).sort(),
    Moola: [...new Set(rawData.filter(p => p.company === 'Moola').map(p => p.brand.trim()))].filter(Boolean).sort(),
  }), [rawData])

  const t = dark ? {
    bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
    text: '#e6edf3', muted: '#7d8590', dim: '#30363d', accent: '#f0c040',
    green: '#3fb950', yellow: '#d29922', red: '#f85149', blue: '#58a6ff',
    orange: '#e3b341', rowHover: '#1c2128', sidebarBg: '#010409', headerBg: '#010409',
    vcanClr: '#f0c040', moolaClr: '#f25757',
  } : {
    bg: '#edf0f4', surface: '#f4f6f9', surface2: '#e4e9f0', border: '#c6ccd8',
    text: '#1a1f28', muted: '#57606a', dim: '#c6ccd8', accent: '#b8850a',
    green: '#1a7f37', yellow: '#9a6700', red: '#cf222e', blue: '#0969da',
    orange: '#953800', rowHover: '#e4e9f0', sidebarBg: '#e4e9f0', headerBg: '#edf0f4',
    vcanClr: '#8b6914', moolaClr: '#c0392b',
  }

  const visibleBrands = VENDOR_BRANDS[vendorFilter] || VENDOR_BRANDS.ALL
  const handleVendorChange = (v) => { setVendorFilter(v); setSelectedBrands([]) }
  const toggleBrand = (b) => setSelectedBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])
  const clearAll = () => { setSearch(''); setSelectedBrands([]); setSelectedRetailers([]); setStatusTab('ALL'); setVendorFilter('ALL'); setSortCol(null); setSortDir('asc') }
  const toggleRetailer = (r) => setSelectedRetailers(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  const handleSort = (col) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortCol(null); setSortDir('asc') }
    } else { setSortCol(col); setSortDir('asc') }
  }
  const hasActiveFilters = search || selectedBrands.length > 0 || selectedRetailers.length > 0 || statusTab !== 'ALL' || vendorFilter !== 'ALL'
  const visibleRetailers = selectedRetailers.length > 0 ? selectedRetailers : RETAILERS

  const stats = useMemo(() => ({
    total: rawData.length,
    active: rawData.filter(p => p.status === 'ขาย').length,
    pending: rawData.filter(p => p.status === 'รอขาย').length,
    discon: rawData.filter(p => p.status === 'ยกเลิกขาย').length,
  }), [rawData])

  const filtered = useMemo(() => rawData.filter(p => {
    if (vendorFilter !== 'ALL' && p.company !== vendorFilter) return false
    if (selectedBrands.length > 0 && !selectedBrands.includes(p.brand.trim())) return false
    if (statusTab !== 'ALL' && p.status !== statusTab) return false
    if (selectedRetailers.length > 0) {
      // keep product only if it has any relationship with at least one selected retailer
      if (!selectedRetailers.some(r => p.retailers[r])) return false
    }
    if (search) {
      const q = search.toLowerCase()
      if (!p.product.toLowerCase().includes(q) && !p.brand.toLowerCase().includes(q) && !p.barcode.includes(q)) return false
    }
    return true
  }), [rawData, vendorFilter, selectedBrands, selectedRetailers, statusTab, search])

  const sortedFiltered = useMemo(() => {
    if (!sortCol) return filtered
    const STATUS_ORDER = { 'ขาย': 0, 'รอขาย': 1, 'ยกเลิกขาย': 2 }
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortCol === 'barcode') cmp = Number(a.barcode) - Number(b.barcode)
      else if (sortCol === 'rsp') cmp = (a.rsp || 0) - (b.rsp || 0)
      else if (sortCol === 'status') cmp = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3)
      else if (sortCol === 'vendor') cmp = a.company.localeCompare(b.company)
      else if (sortCol === 'brand') cmp = a.brand.localeCompare(b.brand, undefined, { sensitivity: 'base' })
      else if (sortCol === 'product') cmp = a.product.localeCompare(b.product, undefined, { sensitivity: 'base' })
      else if (sortCol === 'pack') cmp = (a.packSize || '').localeCompare(b.packSize || '', undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortCol, sortDir])

  const psFiltered = useMemo(() => rawData.filter(p => {
    if (vendorFilter !== 'ALL' && p.company !== vendorFilter) return false
    if (selectedBrands.length > 0 && !selectedBrands.includes(p.brand.trim())) return false
    if (statusTab !== 'ALL' && p.status !== statusTab) return false
    if (psRetailers.length > 0) {
      // keep product only if listed at ≥1 selected retailer (not discontinued/empty)
      if (!psRetailers.some(r => { const v = p.retailers[r]; return v && v !== 'ยกเลิกขาย' })) return false
    }
    if (psSearch) {
      const q = psSearch.toLowerCase()
      return p.product.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q) || p.barcode.includes(q)
    }
    return true
  }), [rawData, vendorFilter, selectedBrands, statusTab, psSearch, psRetailers])

  // ── Market intelligence — actionable analytics (whitespace, GP, health, scorecard) ──
  const intel = useMemo(() => {
    const isActive = (v) => v === 'A'
    const isPending = (v) => v === 'รอขาย' || v === 'On Process'

    // Retailer-level aggregates
    const retailers = RETAILERS.map(r => {
      const skus = rawData.filter(p => isActive(p.retailers[r]))
      const pending = rawData.filter(p => isPending(p.retailers[r])).length
      const brandsSet = new Set(skus.map(p => p.brand.trim()))
      let gpSum = 0, gpN = 0
      skus.forEach(p => {
        const g = retailerData[p.barcode]?.[r]?.gp
        if (g != null) { gpSum += g; gpN++ }
      })
      return { name: r, active: skus.length, pending, brands: brandsSet.size, avgGp: gpN ? gpSum / gpN : null }
    })
    const totalActiveSlots = retailers.reduce((s, r) => s + r.active, 0) || 1
    retailers.forEach(r => { r.sharePct = Math.round(r.active / totalActiveSlots * 100) })
    const retailersByActive = [...retailers].sort((a, b) => b.active - a.active)
    // Core retailers = top 6 by active SKU coverage (the high-traffic doors worth chasing)
    const coreRetailers = retailersByActive.slice(0, 6).map(r => r.name)

    // Brand-level aggregates
    const map = {}
    rawData.forEach(p => {
      const b = p.brand.trim()
      if (!map[b]) map[b] = { brand: b, company: p.company, total: 0, active: 0, pending: 0, discon: 0, activeRetailers: {}, gpSum: 0, gpN: 0 }
      const m = map[b]
      m.total++
      if (p.status === 'ขาย') m.active++
      else if (p.status === 'รอขาย') m.pending++
      else if (p.status === 'ยกเลิกขาย') m.discon++
      RETAILERS.forEach(r => {
        if (!m.activeRetailers[r]) m.activeRetailers[r] = 0
        if (isActive(p.retailers[r])) m.activeRetailers[r]++
      })
      const rd = retailerData[p.barcode]
      if (rd) Object.values(rd).forEach(d => { if (d.gp != null) { m.gpSum += d.gp; m.gpN++ } })
    })

    const brands = Object.values(map).map(m => {
      const coverage = RETAILERS.filter(r => m.activeRetailers[r] > 0).length
      const activeRatio = m.total ? m.active / m.total : 0
      const avgGp = m.gpN ? m.gpSum / m.gpN : null
      const missingCore = coreRetailers.filter(r => !(m.activeRetailers[r] > 0))
      // "Live" = the brand is genuinely still being sold (majority of its SKUs active),
      // so we don't surface gaps for brands that are mostly discontinued.
      const isLive = m.active >= 2 && activeRatio >= 0.5
      return { ...m, coverage, activeRatio, avgGp, missingCore, isLive }
    }).sort((a, b) => b.coverage - a.coverage || b.active - a.active)

    // Distribution gaps — live brands present in most core doors but missing a few
    const gaps = brands
      .filter(b => b.isLive && b.missingCore.length > 0 && b.missingCore.length < coreRetailers.length)
      .map(b => ({ brand: b.brand, company: b.company, active: b.active, coverage: b.coverage, present: coreRetailers.filter(r => b.activeRetailers[r] > 0), missing: b.missingCore }))
      .sort((a, b) => a.missing.length - b.missing.length || b.active - a.active)

    const activeBrandCount = brands.filter(b => b.active > 0).length
    const summary = {
      totalActive: rawData.filter(p => p.status === 'ขาย').length,
      totalPending: rawData.filter(p => p.status === 'รอขาย').length,
      brandCount: activeBrandCount,
      avgCoverage: activeBrandCount ? brands.filter(b => b.active > 0).reduce((s, b) => s + b.coverage, 0) / activeBrandCount : 0,
    }
    return { brands, retailers, retailersByActive, coreRetailers, gaps, summary }
  }, [rawData])

  const maxRetailerActive = Math.max(...intel.retailers.map(r => r.active), 1)
  const gpTone = (g) => g == null ? t.muted : g >= 0.30 ? t.green : g >= 0.20 ? t.yellow : t.red

  function RetailerDot({ value }) {
    if (value === 'A') return (
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.green, margin: 'auto', boxShadow: `0 0 5px ${t.green}88` }} />
    )
    if (value === 'รอขาย') return (
      <div style={{ width: 10, height: 10, borderRadius: '50%', margin: 'auto', background: `linear-gradient(to left, ${t.yellow} 50%, transparent 50%)`, border: `1.5px solid ${t.yellow}` }} />
    )
    if (value === 'On Process') return (
      <div style={{ width: 10, height: 10, borderRadius: '50%', margin: 'auto', background: `linear-gradient(to left, ${t.blue} 50%, transparent 50%)`, border: `1.5px solid ${t.blue}` }} />
    )
    if (value === 'ยกเลิกขาย') return (
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.red, margin: 'auto' }} />
    )
    return <div style={{ width: 6, height: 1, background: t.dim, margin: 'auto' }} />
  }

  function StatCard({ label, value, sub, color }) {
    return (
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: isMobile ? '14px 16px' : '20px 24px', boxShadow: dark ? 'none' : '0 2px 6px rgba(0,0,0,0.07)' }}>
        <div style={{ fontSize: 11, color: t.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: isMobile ? 28 : 36, fontWeight: 800, color: color || t.text, lineHeight: 1, marginBottom: 4 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: t.muted }}>{sub}</div>}
      </div>
    )
  }

  const IconBarChart = ({ size = 15, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 14 14" fill={color} xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="8" width="3" height="5.5" rx="0.6"/>
      <rect x="5.5" y="4" width="3" height="9.5" rx="0.6"/>
      <rect x="10.5" y="1" width="3" height="12.5" rx="0.6"/>
    </svg>
  )
  const NAV_ITEMS = [
    { key: 'products', icon: '⊞', label: 'Products' },
    { key: 'analytics', icon: <IconBarChart />, label: 'Analytics' },
    { key: 'packshot', icon: '⊡', label: 'Packshot' },
    { key: 'promotion', icon: '☰', label: 'Promotion Plan' },
  ]

  const SIDEBAR_W = isMobile ? 0 : (sidebarOpen ? 244 : 164)

  const TABLE_COLS = [
    { label: 'No.', key: null,       align: 'center', w: 44 },
    { label: 'Vendor', key: 'vendor', align: 'center', w: 64 },
    { label: 'Brand',  key: 'brand',  align: 'left' },
    { label: 'Barcode', key: 'barcode', align: 'left' },
    { label: 'Product Name', key: 'product', align: 'left' },
    { label: 'Pack',   key: 'pack',   align: 'center', w: 52 },
    { label: 'RSP',    key: 'rsp',    align: 'center', w: 72 },
    { label: 'Status', key: 'status', align: 'center', w: 84 },
  ]
  const SortIcon = ({ col }) => (
    <span style={{ fontSize: 9, marginLeft: 3, opacity: sortCol === col ? 1 : 0.3, color: sortCol === col ? t.accent : 'inherit' }}>
      {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: t.bg, color: t.text, fontSize: 14 }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Plus Jakarta Sans',sans-serif;-webkit-font-smoothing:antialiased;}
        input,select,button{font-family:inherit;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${t.border};border-radius:3px;}
        .rhover:hover{background:${t.rowHover}!important;}
        .bpill{transition:all 0.15s;cursor:pointer;}
        .bpill:hover{background:${t.accent}!important;color:#000!important;border-color:${t.accent}!important;}
        .nav-item{transition:all 0.15s;cursor:pointer;}
        .nav-item:hover{background:${t.surface2}!important;}
        .sb-btn{transition:background 0.15s;cursor:pointer;}
        .sb-btn:hover{background:${t.surface2}!important;}
        @media(max-width:767px){
          .rhover:hover{background:unset!important;}
          .bpill:hover{background:unset!important;color:unset!important;border-color:unset!important;}
          .bpill:active{background:${t.accent}!important;color:#000!important;border-color:${t.accent}!important;}
        }
      `}</style>

      {/* ── MOBILE BACKDROP ── */}
      {isMobile && mobileNavOpen && (
        <div onClick={() => setMobileNavOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 150, backdropFilter: 'blur(2px)' }} />
      )}

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: isMobile ? 260 : SIDEBAR_W,
        minHeight: '100vh', background: t.sidebarBg,
        borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column',
        position: isMobile ? 'fixed' : 'sticky',
        top: 0, left: 0, height: '100vh', overflow: 'hidden',
        transition: isMobile ? 'transform 0.28s cubic-bezier(0.4,0,0.2,1)' : 'width 0.25s ease',
        transform: isMobile ? (mobileNavOpen ? 'translateX(0)' : 'translateX(-100%)') : 'none',
        flexShrink: 0, zIndex: isMobile ? 200 : 100,
      }}>
        {/* Logo row */}
        <div style={{
          display: 'flex', alignItems: 'center', minHeight: 60, gap: 10,
          padding: '0 12px 0 10px',
          justifyContent: 'flex-start',
          borderBottom: `1px solid ${t.border}`, flexShrink: 0,
        }}>
          {/* Hamburger always on left */}
          <button onClick={() => isMobile ? setMobileNavOpen(false) : setSidebarOpen(o => !o)} className="sb-btn" style={{
            background: 'none', border: 'none', color: t.muted, padding: '7px',
            borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 4,
            alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
          }}>
            <span style={{ display: 'block', width: 15, height: 1.5, background: t.muted, borderRadius: 2 }} />
            <span style={{ display: 'block', width: 15, height: 1.5, background: t.muted, borderRadius: 2 }} />
            <span style={{ display: 'block', width: 15, height: 1.5, background: t.muted, borderRadius: 2 }} />
          </button>
          {/* Logo — transparent PNG, always visible */}
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
            <img src={vcanLogo} alt="VCAN" style={{ height: 30, objectFit: 'contain', display: 'block', maxWidth: '100%' }} />
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NAV_ITEMS.map(({ key, icon, label }) => {
            const active = tab === key
            return (
              <button key={key} onClick={() => { setTab(key); if (isMobile) setMobileNavOpen(false) }} className="nav-item" style={{
                background: active ? `${t.accent}18` : 'none', border: 'none',
                color: active ? t.accent : t.text, display: 'flex', alignItems: 'center',
                gap: 10, padding: '10px 12px',
                justifyContent: 'flex-start',
                fontWeight: active ? 700 : 400, fontSize: 13, width: '100%',
                borderLeft: active ? `3px solid ${t.accent}` : '3px solid transparent',
                borderRadius: '0 8px 8px 0',
                opacity: active ? 1 : 0.7,
              }}>
                <span style={{ fontSize: 17, flexShrink: 0, width: 22, textAlign: 'center', lineHeight: 1 }}>{icon}</span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
              </button>
            )
          })}
        </nav>

        {/* Filters — show when sidebar open (desktop) or always on mobile */}
        {(sidebarOpen || isMobile) && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 16px' }}>
            <div style={{ height: 1, background: t.border, margin: '4px 0 12px' }} />

            {/* Vendor */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Vendor</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['ALL', 'Vcan', 'Moola'].map(v => (
                  <button key={v} className="bpill" onClick={() => handleVendorChange(v)} style={{
                    flex: 1, background: vendorFilter === v ? t.accent : t.surface2,
                    color: vendorFilter === v ? '#000' : t.muted,
                    border: `1px solid ${vendorFilter === v ? t.accent : t.border}`,
                    borderRadius: 8, padding: '6px 4px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}>{v}</button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <div style={{ fontSize: 10, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Status</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[
                  { key: 'ALL', label: 'All Statuses' },
                  { key: 'ขาย', label: 'Active', color: t.green },
                  { key: 'รอขาย', label: 'Pending', color: t.yellow },
                  { key: 'ยกเลิกขาย', label: 'Discontinued', color: t.red },
                ].map(({ key, label, color }) => (
                  <button key={key} onClick={() => setStatusTab(key)} className="nav-item" style={{
                    background: statusTab === key ? `${(color || t.text)}18` : 'none', border: 'none',
                    color: statusTab === key ? (color || t.text) : t.muted,
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', fontWeight: statusTab === key ? 700 : 400,
                    fontSize: 12, width: '100%', cursor: 'pointer',
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: color || t.border, flexShrink: 0 }} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <header style={{
          background: t.headerBg, borderBottom: `1px solid ${t.border}`,
          padding: isMobile ? '0 12px' : '0 24px', height: 56, display: 'flex', alignItems: 'center',
          gap: isMobile ? 8 : 10, position: 'sticky', top: 0, zIndex: 50,
        }}>
          {/* Mobile hamburger */}
          {isMobile && (
            <button onClick={() => setMobileNavOpen(o => !o)} className="sb-btn" style={{ background: 'none', border: 'none', color: t.muted, padding: '7px 6px', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <span style={{ display: 'block', width: 16, height: 1.5, background: t.muted, borderRadius: 2 }} />
              <span style={{ display: 'block', width: 16, height: 1.5, background: t.muted, borderRadius: 2 }} />
              <span style={{ display: 'block', width: 16, height: 1.5, background: t.muted, borderRadius: 2 }} />
            </button>
          )}
          {/* Title + version + timestamp — shown on both mobile and desktop */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontWeight: 800, fontSize: isMobile ? 14 : 17, color: t.text, letterSpacing: 0.2, whiteSpace: 'nowrap', flexShrink: 0 }}>
              Product Master
            </div>
            <span style={{ color: t.accent, fontSize: isMobile ? 11 : 14, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>v2.4.8</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: isMobile ? 11 : 13, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, padding: isMobile ? '3px 8px' : '5px 12px', overflow: 'hidden', minWidth: 0, flexShrink: 1 }}>
              <span style={{ width: isMobile ? 6 : 7, height: isMobile ? 6 : 7, borderRadius: '50%', flexShrink: 0, background: dataSource === 'csv' ? t.blue : t.green }} />
              <span style={{ fontWeight: 800, color: dataSource === 'csv' ? t.blue : t.green, flexShrink: 0 }}>
                {dataSource === 'csv' ? 'CSV' : 'XLSX'}
              </span>
              {lastUpdated && (
                <span style={{ color: t.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  &nbsp;·&nbsp;{isMobile ? lastUpdated.split('  ')[0] : lastUpdated}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: isMobile ? 6 : 8, alignItems: 'center', flexShrink: 0 }}>
            {/* Dark mode */}
            <button onClick={() => setDark(d => !d)} className="sb-btn" style={{
              background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8,
              color: t.muted, fontSize: 15, padding: isMobile ? '5px 8px' : '5px 10px', cursor: 'pointer',
            }}>{dark ? '☀' : '🌙'}</button>
            {/* Import CSV */}
            <label style={{
              background: t.accent, border: 'none', borderRadius: 8,
              padding: isMobile ? '7px 10px' : '7px 16px', color: '#000', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {isMobile ? '↑ CSV' : '↑ Import CSV'}
              <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
            </label>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: isMobile ? '16px 12px' : '24px', overflowY: 'auto' }}>

          {/* PRODUCTS */}
          {tab === 'products' && (
            <>
              {/* Stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <StatCard label="Total SKUs" value={stats.total} sub="all products" />
                <StatCard label="Active" value={stats.active} sub={`${stats.total ? Math.round(stats.active / stats.total * 100) : 0}% of total`} color={t.green} />
                <StatCard label="Pending" value={stats.pending} sub="รอขาย" color={t.yellow} />
                <StatCard label="Discontinued" value={stats.discon} sub="ยกเลิกขาย" color={t.red} />
              </div>

              {/* Sticky filter section */}
              <div style={{ position: 'sticky', top: 0, zIndex: 10, background: t.bg, paddingBottom: 16, paddingTop: 4 }}>
                {/* Search + Clear all */}
                <div style={{
                  background: t.surface, border: `1px solid ${t.border}`,
                  borderRadius: 12, padding: '10px 14px', marginBottom: 10,
                  boxShadow: dark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: t.muted, fontSize: 15, pointerEvents: 'none' }}>⌕</span>
                      <input value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="ค้นหา product, brand, barcode..."
                        style={{
                          width: '100%', background: t.surface2, border: `1px solid ${t.border}`,
                          borderRadius: 8, color: t.text, padding: '8px 36px 8px 38px',
                          fontSize: 13, outline: 'none',
                        }} />
                      {search && (
                        <button onClick={() => setSearch('')} style={{
                          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1,
                        }}>×</button>
                      )}
                    </div>
                    {hasActiveFilters && (
                      <button onClick={clearAll} style={{
                        background: 'none', border: `1.5px solid ${t.border}`, borderRadius: 8,
                        color: t.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        padding: '8px 14px', whiteSpace: 'nowrap', flexShrink: 0,
                      }}>✕ Clear all</button>
                    )}
                  </div>
                </div>

                {/* Retailer logo pills — desktop only (mobile table has no retailer columns) */}
                {!isMobile && <div style={{
                  background: t.surface, border: `1px solid ${t.border}`,
                  borderRadius: 12, padding: '10px 14px', marginBottom: 10,
                  boxShadow: dark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>Customer</span>
                    {RETAILERS.map(r => {
                      const sel = selectedRetailers.includes(r)
                      return (
                        <button key={r} onClick={() => toggleRetailer(r)} title={r} style={{
                          display: 'inline-flex', alignItems: 'center',
                          background: sel ? `${t.accent}18` : t.surface2,
                          border: `2px solid ${sel ? t.accent : t.border}`,
                          borderRadius: 10, padding: '3px 7px', cursor: 'pointer',
                          boxShadow: sel ? `0 0 0 3px ${t.accent}22` : 'none',
                        }}>
                          <RetailerLogo name={r} h={22} maxW={58} fallbackStyle={{ fontSize: 11, fontWeight: 700, color: t.text }} />
                        </button>
                      )
                    })}
                    {selectedRetailers.length > 0 && (
                      <button onClick={() => setSelectedRetailers([])} style={{ background: 'none', border: 'none', color: t.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '4px 6px', flexShrink: 0 }}>✕ Clear</button>
                    )}
                  </div>
                </div>}

                {/* Brand pills — card background for contrast */}
                <div style={{
                  background: t.surface, border: `1px solid ${t.border}`,
                  borderRadius: 12, padding: '10px 14px',
                  boxShadow: dark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                    {visibleBrands.map(b => {
                      const sel = selectedBrands.includes(b)
                      return (
                        <button key={b} className="bpill" onClick={() => toggleBrand(b)} style={{
                          background: sel ? t.accent : t.surface2,
                          color: sel ? '#000' : t.text,
                          border: `1.5px solid ${sel ? t.accent : t.border}`,
                          borderRadius: 22, padding: '6px 16px', fontSize: 12.5,
                          fontWeight: sel ? 700 : 500, cursor: 'pointer',
                          boxShadow: sel ? `0 0 0 2px ${t.accent}33` : 'none',
                        }}>{b}</button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
                {/* Table info bar */}
                <div style={{ padding: '10px 18px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: t.surface, flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 13, color: t.muted, fontWeight: 500 }}>
                    Showing <strong style={{ color: t.text, fontWeight: 700 }}>{filtered.length}</strong> of {rawData.length} products
                    {isMobile && <span style={{ color: t.muted, fontSize: 11 }}> · แตะแถวเพื่อดูรายละเอียด</span>}
                  </span>
                  {!isMobile && (
                    <div style={{ display: 'flex', gap: 16, fontSize: 13, color: t.muted, alignItems: 'center', fontWeight: 600 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.green, display: 'inline-block' }} />Active
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: `linear-gradient(to left,${t.yellow} 50%,transparent 50%)`, border: `1.5px solid ${t.yellow}` }} />Pending
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: `linear-gradient(to left,${t.blue} 50%,transparent 50%)`, border: `1.5px solid ${t.blue}` }} />On Process
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.red, display: 'inline-block' }} />Discon
                      </span>
                    </div>
                  )}
                </div>
                {/* Scrollable table — thead frozen */}
                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: isMobile ? 'calc(100dvh - 260px)' : 'calc(100vh - 300px)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      {isMobile ? (
                        <tr style={{ background: t.surface2, boxShadow: `0 2px 0 ${t.accent}` }}>
                          <th style={{ padding: '10px 8px', textAlign: 'center', color: t.text, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', borderBottom: `2px solid ${t.border}`, position: 'sticky', top: 0, background: t.surface2, zIndex: 1, width: 52 }}>#</th>
                          <th onClick={() => handleSort('product')} style={{ padding: '10px 12px', textAlign: 'left', color: sortCol === 'product' ? t.accent : t.text, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', borderBottom: `2px solid ${t.border}`, position: 'sticky', top: 0, background: t.surface2, zIndex: 1, cursor: 'pointer', userSelect: 'none' }}>
                            Brand / Product <SortIcon col="product" />
                          </th>
                          <th onClick={() => handleSort('status')} style={{ padding: '10px 8px', textAlign: 'center', color: sortCol === 'status' ? t.accent : t.text, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', borderBottom: `2px solid ${t.border}`, position: 'sticky', top: 0, background: t.surface2, zIndex: 1, width: 82, cursor: 'pointer', userSelect: 'none' }}>
                            Status <SortIcon col="status" />
                          </th>
                        </tr>
                      ) : (
                        <tr style={{ background: t.surface2, boxShadow: `0 2px 0 ${t.accent}` }}>
                          {TABLE_COLS.map(({ label, key, align, w }) => (
                            <th key={label} onClick={() => key && handleSort(key)} style={{
                              padding: '12px 12px', textAlign: align, color: sortCol === key && key ? t.accent : t.text,
                              fontWeight: 700, fontSize: 12, letterSpacing: 0.5,
                              textTransform: 'uppercase', borderBottom: `2px solid ${t.border}`,
                              width: w, whiteSpace: 'nowrap',
                              position: 'sticky', top: 0, background: t.surface2, zIndex: 1,
                              cursor: key ? 'pointer' : 'default', userSelect: 'none',
                            }}>{label}{key && <SortIcon col={key} />}</th>
                          ))}
                          {visibleRetailers.map(r => (
                            <th key={r} style={{
                              padding: '10px 5px', textAlign: 'center', color: t.text,
                              fontWeight: 700, fontSize: 10.5, whiteSpace: 'nowrap',
                              borderBottom: `2px solid ${t.border}`,
                              position: 'sticky', top: 0, background: t.surface2, zIndex: 1,
                            }}><RetailerLogo name={r} h={28} maxW={74} fallbackStyle={{ fontSize: 10.5 }} /></th>
                          ))}
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {isMobile ? sortedFiltered.map((p, i) => (
                        <tr key={p.barcode + i} className="rhover" onClick={() => setSelectedProduct(p)} style={{ borderBottom: `1px solid ${t.dim}`, cursor: 'pointer' }}>
                          <td style={{ padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <div style={{ fontSize: 11, color: t.muted, fontWeight: 500 }}>{i + 1}</div>
                            <div style={{ fontSize: 10, fontWeight: 800, color: p.company === 'Vcan' ? t.vcanClr : t.moolaClr, marginTop: 2 }}>{p.company}</div>
                          </td>
                          <td style={{ padding: '10px 12px', verticalAlign: 'middle' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: p.company === 'Vcan' ? t.vcanClr : t.moolaClr, marginBottom: 2 }}>{p.brand}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: t.text, lineHeight: 1.35 }}>{p.product}</div>
                            <div style={{ fontSize: 10, fontFamily: 'monospace', color: t.muted, marginTop: 2 }}>
                              {p.barcode}{p.rsp ? ` · ฿${p.rsp}` : ''}
                            </div>
                          </td>
                          <td style={{ padding: '10px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 700, whiteSpace: 'nowrap', background: p.status === 'ขาย' ? `${t.green}28` : p.status === 'รอขาย' ? `${t.yellow}28` : `${t.red}28`, color: p.status === 'ขาย' ? t.green : p.status === 'รอขาย' ? t.yellow : t.red, border: `1px solid ${p.status === 'ขาย' ? t.green : p.status === 'รอขาย' ? t.yellow : t.red}44` }}>
                              {p.status === 'ขาย' ? 'Active' : p.status === 'รอขาย' ? 'Pending' : 'Discon'}
                            </span>
                          </td>
                        </tr>
                      )) : sortedFiltered.map((p, i) => (
                        <tr key={p.barcode + i} className="rhover" onClick={() => setSelectedProduct(p)} style={{ borderBottom: `1px solid ${t.dim}`, cursor: 'pointer' }}>
                          <td style={{ padding: '9px 12px', color: t.muted, fontSize: 12, textAlign: 'center', fontWeight: 500 }}>{i + 1}</td>
                          <td style={{ padding: '9px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 800, fontSize: 11.5, color: p.company === 'Vcan' ? t.vcanClr : t.moolaClr }}>{p.company}</span>
                          </td>
                          <td style={{ padding: '9px 12px', fontWeight: 700, fontSize: 13, color: t.text, whiteSpace: 'nowrap' }}>{p.brand}</td>
                          <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 12, color: t.muted, whiteSpace: 'nowrap', letterSpacing: 0.4 }}>{p.barcode}</td>
                          <td style={{ padding: '9px 12px', maxWidth: 300 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, color: t.text }} title={p.product}>{p.product}</div>
                          </td>
                          <td style={{ padding: '9px 8px', textAlign: 'center', fontSize: 13, fontWeight: 700, color: t.text }}>{p.packSize || <span style={{ color: t.dim }}>—</span>}</td>
                          <td style={{ padding: '9px 8px', textAlign: 'center', whiteSpace: 'nowrap', fontWeight: 700 }}>
                            {p.rsp ? <span style={{ color: t.text, fontSize: 13 }}>฿{p.rsp}</span> : <span style={{ color: t.dim }}>—</span>}
                          </td>
                          <td style={{ padding: '9px 8px', textAlign: 'center' }}>
                            <span style={{ fontSize: 11.5, padding: '3px 10px', borderRadius: 20, fontWeight: 700, background: p.status === 'ขาย' ? `${t.green}28` : p.status === 'รอขาย' ? `${t.yellow}28` : `${t.red}28`, color: p.status === 'ขาย' ? t.green : p.status === 'รอขาย' ? t.yellow : t.red, border: `1px solid ${p.status === 'ขาย' ? t.green : p.status === 'รอขาย' ? t.yellow : t.red}44` }}>
                              {p.status === 'ขาย' ? 'Active' : p.status === 'รอขาย' ? 'Pending' : 'Discon'}
                            </span>
                          </td>
                          {visibleRetailers.map(r => (
                            <td key={r} style={{ padding: '9px 5px', textAlign: 'center' }}>
                              <RetailerDot value={p.retailers[r]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={isMobile ? 3 : 8 + visibleRetailers.length} style={{ padding: 56, textAlign: 'center', color: t.muted }}>
                            <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
                            <div style={{ fontWeight: 600 }}>ไม่พบสินค้าที่ตรงกับ filter</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ANALYTICS */}
          {tab === 'analytics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* ── Portfolio overview ── */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { label: 'Active SKUs', val: intel.summary.totalActive, sub: 'currently on shelf', c: t.green },
                  { label: 'Active Brands', val: intel.summary.brandCount, sub: 'with ≥1 live SKU', c: t.blue },
                  { label: 'Avg Coverage', val: intel.summary.avgCoverage.toFixed(1), sub: `of ${RETAILERS.length} retailers / brand`, c: t.accent },
                  { label: 'Pending Pipeline', val: intel.summary.totalPending, sub: 'awaiting listing', c: t.yellow },
                ].map(({ label, val, sub, c }) => (
                  <div key={label} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: isMobile ? '14px 16px' : '18px 20px' }}>
                    <div style={{ fontSize: 11, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: isMobile ? 26 : 32, fontWeight: 800, color: c, lineHeight: 1 }}>{val}</div>
                    <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>{sub}</div>
                  </div>
                ))}
              </div>

              {/* ── Brand Distribution Matrix ── */}
              <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: isMobile ? 16 : 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Brand Distribution Matrix</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: t.muted }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 12, height: 12, borderRadius: '50%', background: t.green, display: 'inline-block' }} />Listed
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.dim, display: 'inline-block' }} />Not listed
                    </span>
                  </div>
                </div>
                <div style={{ color: t.muted, fontSize: 12, marginBottom: 16 }}>Where each active brand is currently on shelf, by retailer — sorted by coverage. Hover a dot for SKU count.</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 740 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${t.border}` }}>
                        <th style={{ padding: '9px 12px', textAlign: 'left', color: t.muted, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, position: 'sticky', left: 0, background: t.surface, zIndex: 1 }}>Brand</th>
                        {RETAILERS.map(r => <th key={r} style={{ padding: '9px 4px', textAlign: 'center', color: t.muted, fontWeight: 700, fontSize: 9.5, whiteSpace: 'nowrap' }}><RetailerLogo name={r} h={24} maxW={60} fallbackStyle={{ fontSize: 9.5 }} /></th>)}
                        <th style={{ padding: '9px 10px', textAlign: 'center', color: t.muted, fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>Cov.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intel.brands.filter(b => b.active > 0).map(b => (
                        <tr key={b.brand} className="rhover" style={{ borderBottom: `1px solid ${t.dim}` }}>
                          <td style={{ padding: '7px 12px', fontWeight: 600, color: t.text, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: t.surface, zIndex: 1 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.company === 'Vcan' ? t.vcanClr : t.moolaClr, display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }} />{b.brand}
                          </td>
                          {RETAILERS.map(r => {
                            const n = b.activeRetailers[r] || 0
                            return (
                              <td key={r} style={{ padding: '7px 4px', textAlign: 'center' }} title={n > 0 ? `${b.brand} — ${RETAILER_SHORT[r]}: ${n} active SKU${n > 1 ? 's' : ''}` : `${b.brand} — not listed at ${RETAILER_SHORT[r]}`}>
                                <span style={{ display: 'inline-block', width: n > 0 ? 13 : 6, height: n > 0 ? 13 : 6, borderRadius: '50%', background: n > 0 ? t.green : t.dim, boxShadow: n > 0 ? `0 0 0 3px ${t.green}1e` : 'none', verticalAlign: 'middle' }} />
                              </td>
                            )
                          })}
                          <td style={{ padding: '7px 10px', textAlign: 'center' }}>
                            <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontWeight: 700, fontSize: 11, background: b.coverage >= 8 ? `${t.green}22` : b.coverage >= 4 ? `${t.blue}22` : t.surface2, color: b.coverage >= 8 ? t.green : b.coverage >= 4 ? t.blue : t.muted }}>{b.coverage}/{RETAILERS.length}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Distribution Gaps ── */}
              <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: isMobile ? 16 : 24 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Distribution Gaps</div>
                <div style={{ color: t.muted, fontSize: 12, marginBottom: 16 }}>
                  Live brands (≥2 active SKUs) not yet in every core door — measured against {intel.coreRetailers.map(r => RETAILER_SHORT[r]).join(' · ')}
                </div>
                {intel.gaps.length === 0 ? (
                  <div style={{ color: t.muted, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>✓ All live brands are present across every core retailer</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                    {intel.gaps.map(g => (
                      <div key={g.brand} style={{ padding: '14px 16px', borderRadius: 12, background: t.surface2, border: `1px solid ${t.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 800, color: t.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.brand}</div>
                            <div style={{ fontSize: 11, color: t.muted, marginTop: 1 }}>
                              <span style={{ color: g.company === 'Vcan' ? t.vcanClr : t.moolaClr, fontWeight: 700 }}>{g.company}</span> · {g.active} active SKUs
                            </div>
                          </div>
                          <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: t.yellow, background: `${t.yellow}1e`, border: `1px solid ${t.yellow}44`, borderRadius: 20, padding: '3px 10px' }}>{g.missing.length} gap{g.missing.length > 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {intel.coreRetailers.map(r => {
                            const inStore = g.present.includes(r)
                            return (
                              <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: inStore ? `${t.green}1e` : 'transparent', color: inStore ? t.green : t.muted, border: `1px solid ${inStore ? t.green + '44' : t.border}`, opacity: inStore ? 1 : 0.85 }}>
                                <span>{inStore ? '✓' : '+'}</span><RetailerLogo name={r} h={20} maxW={56} fallbackStyle={{ fontSize: 10.5 }} />
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Retailer Scorecard ── */}
              <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: isMobile ? 16 : 24 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Retailer Scorecard</div>
                <div style={{ color: t.muted, fontSize: 12, marginBottom: 16 }}>Channel size at a glance — active SKUs, brands carried, pending listings, and the agreed average GP.</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 560 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${t.border}` }}>
                        {['Retailer', 'Active SKUs', 'Brands', 'Pending', 'Avg GP', 'Share'].map((h, i) => (
                          <th key={h} style={{ padding: '9px 10px', textAlign: i <= 1 ? 'left' : 'center', color: t.muted, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {intel.retailersByActive.map(r => {
                        const isCore = intel.coreRetailers.includes(r.name)
                        return (
                          <tr key={r.name} className="rhover" style={{ borderBottom: `1px solid ${t.dim}` }}>
                            <td style={{ padding: '9px 10px', fontWeight: 700, color: t.text, whiteSpace: 'nowrap' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                                <RetailerLogo name={r.name} h={30} maxW={88} fallbackStyle={{ fontWeight: 700, color: t.text }} />
                                {isCore && <span style={{ fontSize: 9, fontWeight: 700, color: t.accent, border: `1px solid ${t.accent}66`, borderRadius: 4, padding: '1px 5px' }}>CORE</span>}
                              </span>
                            </td>
                            <td style={{ padding: '9px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, minWidth: 60, height: 8, background: t.surface2, borderRadius: 4, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${Math.round(r.active / maxRetailerActive * 100)}%`, background: 'linear-gradient(90deg,#58a6ff,#7c3aed)', borderRadius: 4 }} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: t.text, width: 26, textAlign: 'right' }}>{r.active}</span>
                              </div>
                            </td>
                            <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 600 }}>{r.brands}</td>
                            <td style={{ padding: '9px 10px', textAlign: 'center', color: r.pending > 0 ? t.yellow : t.muted, fontWeight: r.pending > 0 ? 700 : 400 }}>{r.pending || '—'}</td>
                            <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: gpTone(r.avgGp) }}>{r.avgGp != null ? Math.round(r.avgGp * 100) + '%' : '—'}</td>
                            <td style={{ padding: '9px 10px', textAlign: 'center', color: t.muted, fontWeight: 600 }}>{r.sharePct}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* PACKSHOT GALLERY */}
          {tab === 'packshot' && (
            <>
              {/* ── Search bar ── */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: t.muted, fontSize: 15, pointerEvents: 'none' }}>⌕</span>
                <input value={psSearch} onChange={e => setPsSearch(e.target.value)} placeholder="ค้นหา product, brand, barcode..." style={{ width: '100%', background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, padding: '9px 36px 9px 38px', fontSize: 13, outline: 'none', boxShadow: dark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)' }} />
                {psSearch && <button onClick={() => setPsSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>}
              </div>
              {/* ── Customer (retailer) pills — logos (above brand) ── */}
              <div style={{ display: 'flex', gap: 7, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: t.muted, fontWeight: 600, flexShrink: 0 }}>Customer:</span>
                <button onClick={() => setPsRetailers([])} style={{ background: psRetailers.length === 0 ? t.accent : t.surface2, color: psRetailers.length === 0 ? '#000' : t.text, border: `1.5px solid ${psRetailers.length === 0 ? t.accent : t.border}`, borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>All</button>
                {RETAILERS.map(r => {
                  const sel = psRetailers.includes(r)
                  return (
                    <button key={r} onClick={() => togglePsRetailer(r)} title={r} style={{ display: 'inline-flex', alignItems: 'center', background: sel ? `${t.accent}18` : t.surface2, border: `2px solid ${sel ? t.accent : t.border}`, borderRadius: 10, padding: isMobile ? '6px 9px' : '4px 7px', cursor: 'pointer', boxShadow: sel ? `0 0 0 3px ${t.accent}22` : 'none', minHeight: isMobile ? 40 : 'unset' }}>
                      <RetailerLogo name={r} h={isMobile ? 26 : 22} maxW={isMobile ? 68 : 58} fallbackStyle={{ fontSize: 11, fontWeight: 700, color: t.text }} />
                    </button>
                  )
                })}
                {psRetailers.length > 0 && (
                  <button onClick={() => setPsRetailers([])} style={{ background: 'none', border: 'none', color: t.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '4px 6px', flexShrink: 0 }}>✕ Clear</button>
                )}
              </div>
              {/* ── Brand pills ── */}
              <div style={{ display: 'flex', gap: 7, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: t.muted, fontWeight: 600, flexShrink: 0 }}>Brand:</span>
                <button key="ALL" className="bpill" onClick={() => setSelectedBrands([])} style={{ background: selectedBrands.length === 0 ? t.accent : t.surface2, color: selectedBrands.length === 0 ? '#000' : t.text, border: `1px solid ${selectedBrands.length === 0 ? t.accent : t.border}`, borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>All</button>
                {VENDOR_BRANDS.ALL.map(b => {
                  const sel = selectedBrands.includes(b)
                  return <button key={b} className="bpill" onClick={() => toggleBrand(b)} style={{ background: sel ? t.accent : t.surface2, color: sel ? '#000' : t.text, border: `1px solid ${sel ? t.accent : t.border}`, borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{b}</button>
                })}
              </div>
              {/* ── Legend + count bar ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, padding: '8px 14px', background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, flexWrap: 'wrap' }}>
                {[
                  { label: 'Active', color: t.green },
                  { label: 'Pending', color: t.yellow },
                  { label: 'Discontinued', color: t.red },
                ].map(({ label, color }) => (
                  <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: t.muted, fontWeight: 600 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />{label}
                  </span>
                ))}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: t.muted }}>
                  Showing <strong style={{ color: t.text, fontWeight: 700 }}>{psFiltered.length}</strong> of {rawData.length} products
                </span>
              </div>
              {/* ── Grid ── */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '130px' : '160px'}, 1fr))`, gap: isMobile ? 10 : 12 }}>
                {psFiltered.map((p, i) => (
                  <div key={p.barcode + i} onClick={() => setSelectedProduct(p)} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.18s, box-shadow 0.18s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)'; e.currentTarget.style.boxShadow = `0 16px 40px rgba(0,0,0,0.28), 0 0 0 2px ${t.accent}66` }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
                  >
                    <PackshotImg barcode={p.barcode} side="front" style={{ width: '100%', height: 150, background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }} placeholderSize={40} />
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: p.company === 'Vcan' ? t.vcanClr : t.moolaClr, marginBottom: 3 }}>{p.brand}</div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: t.text, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={p.product}>{p.product}</div>
                      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>฿{p.rsp || '—'}</span>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 12, fontWeight: 600, background: p.status === 'ขาย' ? `${t.green}22` : p.status === 'รอขาย' ? `${t.yellow}22` : `${t.red}22`, color: p.status === 'ขาย' ? t.green : p.status === 'รอขาย' ? t.yellow : t.red }}>{p.status === 'ขาย' ? 'Active' : p.status === 'รอขาย' ? 'Pending' : 'Discon'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {psFiltered.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px 0', color: t.muted }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
                  <div style={{ fontWeight: 600 }}>ไม่พบสินค้าที่ตรงกับ filter</div>
                </div>
              )}
            </>
          )}

          {/* PROMOTION PLAN */}
          {tab === 'promotion' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 20 }}>
              <div style={{ background: t.surface, border: `2px dashed ${t.border}`, borderRadius: 20, padding: '60px 100px', textAlign: 'center' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>☰</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Promotion Plan</div>
                <div style={{ display: 'inline-block', background: 'linear-gradient(135deg,#58a6ff,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: 14, padding: '8px 24px', borderRadius: 40, marginBottom: 16 }}>
                  COMING SOON — Version 2.5
                </div>
                <div style={{ color: t.muted, fontSize: 13, lineHeight: 1.8 }}>
                  ระบบวางแผน Promotion รายห้าง<br />
                  ต้องทำ standard template ก่อนเพราะแต่ละห้างมี format ต่างกัน<br />
                  <span style={{ color: t.blue, fontWeight: 600 }}>อยู่ระหว่างการพัฒนาในเวอร์ชัน 2.5</span>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ── PRODUCT POPUP ── */}
      {selectedProduct && (
        <ProductPopup
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          t={t}
          dark={dark}
          isMobile={isMobile}
          pricing={retailerData[selectedProduct.barcode] || {}}
          variant={tab === 'packshot' ? 'packshot' : 'products'}
        />
      )}
    </div>
  )
}
