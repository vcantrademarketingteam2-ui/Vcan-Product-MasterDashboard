import { useState, useMemo, useEffect, useRef } from 'react'
import fallbackData, { GENERATED_AT } from './data.js'
import retailerData from './retailer_data.js'
import promoData, { PROMO_META } from './promo_data.js'
import vcanLogo from './VCAN.png'
import PromoSection from './PromoSection.jsx'
import { upcomingWithin, bangkokToday, daysUntil } from './promoAlerts.js'
import { DEPT_PINS, canSeeRetailer, canViewAccessLog, logPricingAccess, getAccessLog, clearAccessLog } from './deptPins.js'

// Bell-alert urgency → tone + plain-language countdown. Tones map to theme colors
// in render (today=red, soon ≤2d=orange, upcoming ≤5d=yellow) — the 2-day / 5-day
// warning scheme. Pure + module-scope so it stays trivially testable.
function alertUrgency(days) {
  if (days <= 0) return { tone: 'today', text: 'Starts today' }
  if (days === 1) return { tone: 'soon', text: 'Starts tomorrow' }
  if (days <= 2) return { tone: 'soon', text: `${days} days left until it starts` }
  return { tone: 'upcoming', text: `${days} days left until it starts` }
}

// Products brand-filter grouping. Patterns match by brand keyword so SKU variants
// ("Malizia Bath Foam 1L", "VITAKRAFT CAT", "PEARS SOAP") inherit the base brand's
// category. Anything unmatched lands in "Other" — VENDOR_BRANDS.ALL is data-derived,
// so the grouping must never silently drop a brand.
const BRAND_CATEGORIES = ['Laundry', 'Homecare', 'Personal Care', 'Intimate', 'Pet', 'Kitchen Ware', 'Other']
// Order matters: brandCategory returns the FIRST matching category, so the more
// specific rules (Intimate, exact-match Laundry L'Arbre Vert) come before the
// broad Personal Care fallbacks (/malizia/, /l'arbre/).
const BRAND_CAT_RULES = [
  ['Pet',           [/vitakraft/i]],
  ['Kitchen Ware',  [/\bwmf\b/i]],
  ['Intimate',      [/malizia\s*intimate/i, /tena/i]],
  ['Laundry',       [/perwoll/i, /purex/i, /vernel/i, /vnew/i, /^l['’]?arbre vert\s*$/i]],
  ['Homecare',      [/sofix/i, /somat/i, /pril/i, /combat/i, /general\s*fresh/i, /brilly/i, /tempo/i]],
  ['Personal Care', [/dove/i, /dial/i, /pears/i, /pepsodent/i, /jack/i, /malizia/i, /l['’]?arbre/i, /sundae/i]],
]
function brandCategory(b) {
  for (const [cat, pats] of BRAND_CAT_RULES) if (pats.some(p => p.test(b))) return cat
  return 'Other'
}

// BrandPill (v3.6.0, logos wired v3.7.0, "Marquee Capsule" redesign v3.8.0) —
// shared brand identity chip: vendor-tinted logo plaque + name, reused on Products
// filter / popup header / Packshot cards / Analytics labels / Promo brand strips.
// The plaque replaced a fixed-square monogram tile — wide wordmarks (Sundae,
// Malizia, up to ~3.7:1) were getting crushed flat in a square; the plaque now
// sizes to each logo's own aspect ratio (measured on load, see BrandPlaque),
// clamped so square logos stay square and nothing runs away past 2.3x tall.
// Brand name is demoted to a caption alongside the plaque — logo leads, name
// follows. Monogram = initials of the first two words, or the first two letters
// of a single-word brand, still used as the plaque's own fallback content.
function brandMonogram(b) {
  const words = b.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return (b.replace(/[^a-zA-Z]/g, '').slice(0, 2) || b.slice(0, 2)).toUpperCase()
}
// Drop logo files into public/brands/ with these exact names to replace monogram
// tiles. Several data.js brand keys are variants of one physical brand (Malizia
// Bath Foam 1L/300ml/Intimate, VITAKRAFT Bird/CAT/DOG/Rabbit/Rodent, L'Arbre Vert
// + Body Wash, Dove Bar Soap, PEARS BODY WASH/SOAP) — they intentionally share one file.
const BRAND_LOGOS = {
  'Brilly': '/brands/brilly.png',
  'combat': '/brands/combat.png',
  'Dial': '/brands/dial.png',
  'Dove Bar Soap': '/brands/dove.png',
  'Dove Men': '/brands/dove-men.png',
  'General Fresh': '/brands/general-fresh.png',
  "Jack N' Jill": '/brands/jack-n-jill.png',
  "L'Arbre Vert": '/brands/larbre-vert.png',
  "L'Arbre Vert Body Wash": '/brands/larbre-vert.png',
  'Malizia Bath Foam 1L': '/brands/malizia.png',
  'Malizia Bath Foam 300ml': '/brands/malizia.png',
  'Malizia Intimate': '/brands/malizia.png',
  'PEARS BODY WASH': '/brands/pears.png',
  'PEARS SOAP': '/brands/pears.png',
  'Pepsodent sensitive': '/brands/pepsodent.png',
  'Perwoll': '/brands/perwoll.png',
  'Pril': '/brands/pril.png',
  'Purex': '/brands/purex.png',
  'Sofix': '/brands/sofix.png',
  'Somat': '/brands/somat.png',
  'Sundae Bath Foam': '/brands/sundae.png',
  'Tempo': '/brands/tempo.png',
  'Tena': '/brands/tena.png',
  'VITAKRAFT Bird': '/brands/vitakraft.png',
  'VITAKRAFT CAT': '/brands/vitakraft.png',
  'VITAKRAFT DOG': '/brands/vitakraft.png',
  'VITAKRAFT Rabbit': '/brands/vitakraft.png',
  'VITAKRAFT Rodent': '/brands/vitakraft.png',
  'Vnew': '/brands/vnew.png',
  'WMF': '/brands/wmf.png',
}
const BP_DIMS = {
  s: { h: 38, plaqueH: 30, pillR: 11, plaqueR: 9,  tileFont: 10,   capFont: 12,   pad: '0 12px 0 4px', gap: 7 },
  m: { h: 50, plaqueH: 42, pillR: 15, plaqueR: 11, tileFont: 12,   capFont: 13.5, pad: '0 16px 0 4px', gap: 11 },
  l: { h: 63, plaqueH: 55, pillR: 19, plaqueR: 14, tileFont: 14,   capFont: 15.5, pad: '0 20px 0 5px', gap: 13 },
}
// Plaque width = clamp(1.0x, naturalAR*1.0x, 2.3x) the plaque height — square logos
// stay square, wide wordmarks get a wide stage, nothing runs away unbounded. AR is
// unknown until the image loads, so it starts at 1 (square) and widens on onLoad —
// a one-time reflow, imperceptible for these small same-origin assets.
function plaqueWidth(ar, h) {
  return Math.round(Math.min(Math.max(h, ar * h), h * 2.3))
}
function BrandPlaque({ brand, company, t, size = 'm' }) {
  const clr = company === 'Vcan' ? t.vcanClr : t.moolaClr
  const d = BP_DIMS[size]
  const [err, setErr] = useState(false)
  const [ar, setAr] = useState(1)
  const src = BRAND_LOGOS[brand]
  if (src && !err) {
    return (
      <span style={{
        width: plaqueWidth(ar, d.plaqueH), height: d.plaqueH, borderRadius: d.plaqueR, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: '#fff', overflow: 'hidden', padding: 3, boxSizing: 'border-box',
      }}>
        <img src={src} alt={brand} onError={() => setErr(true)}
          onLoad={(e) => setAr(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      </span>
    )
  }
  return (
    <span style={{
      width: d.plaqueH, height: d.plaqueH, borderRadius: d.plaqueR, flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: d.tileFont, fontWeight: 800, color: 'rgba(0,0,0,.78)',
      background: `linear-gradient(135deg, ${clr}, ${clr}99)`,
    }}>{brandMonogram(brand)}</span>
  )
}
// selected = vendor-colored glow ring only (decided, no fill swap); count = SKUs in
// current scope, shown on filter pills only (decided) — pass null elsewhere.
function BrandPill({ brand, company, t, size = 'm', selected = false, count = null, onClick }) {
  const clr = company === 'Vcan' ? t.vcanClr : t.moolaClr
  const interactive = !!onClick
  const d = BP_DIMS[size]
  const Tag = interactive ? 'button' : 'span'
  return (
    <Tag type={interactive ? 'button' : undefined} onClick={onClick}
      className={interactive ? `ps-glow${selected ? ' ps-glow-on' : ''}` : undefined}
      style={{
        '--g': clr, display: 'inline-flex', alignItems: 'center', gap: d.gap, height: d.h,
        padding: d.pad, borderRadius: d.pillR, boxSizing: 'border-box', fontFamily: 'inherit',
        background: t.surface2, border: `1.5px solid ${selected ? clr : t.border}`,
        cursor: interactive ? 'pointer' : 'default', maxWidth: '100%',
        transition: 'border-color .13s ease',
      }} title={brand}
    >
      <BrandPlaque brand={brand} company={company} t={t} size={size} />
      <span style={{
        fontSize: d.capFont, fontWeight: selected ? 700 : 600, color: selected ? clr : t.muted,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: '0 1 auto',
        transition: 'color .13s ease',
      }}>{brand}</span>
      {count != null && (
        <span style={{ fontSize: 10, fontWeight: 700, color: t.muted, background: `${t.accent}22`, borderRadius: 99, padding: '1px 6px', marginLeft: 1, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      )}
    </Tag>
  )
}

// Status the summary cards (and card-click filter) bucket by:
// no retailer scope → the product's global master status; with retailer(s)
// scoped → its status AT those retailers, matching the column dots
// (A=active, รอขาย/On Process=pending, ยกเลิกขาย=discon). Across multiple
// retailers, most-active wins.
// ponytail: most-active priority for multi-retailer; revisit only if a per-column split is asked for.
function effStatusFor(p, selectedRetailers) {
  if (selectedRetailers.length === 0) return p.status
  let rank = -1 // 2 active, 1 pending, 0 discon, -1 not listed
  for (const r of selectedRetailers) {
    const v = p.retailers[r]
    const k = v === 'A' ? 2 : (v === 'รอขาย' || v === 'On Process') ? 1 : v === 'ยกเลิกขาย' ? 0 : -1
    if (k > rank) rank = k
  }
  return rank === 2 ? 'ขาย' : rank === 1 ? 'รอขาย' : rank === 0 ? 'ยกเลิกขาย' : null
}

// Count-up animation for KPI / bento numbers — respects prefers-reduced-motion.
function useCountUp(target, dur = 1100) {
  const [v, setV] = useState(0)
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  useEffect(() => {
    if (reduced) return
    let raf, t0
    const step = (ts) => {
      if (!t0) t0 = ts
      const p = Math.min(1, (ts - t0) / dur)
      setV(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, dur, reduced])
  return reduced ? target : v
}
function CountUp({ v, dec = 0 }) {
  const n = useCountUp(v)
  return dec ? n.toFixed(dec) : Math.round(n).toLocaleString()
}

const RETAILERS = ['Tops', 'Villa', 'The Mall', 'Lotus', 'Homepro', 'Big C', 'TWD', 'Boots', 'Foodland', 'Central Department', "Pet'n me", 'Fuji']

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
  'Tops': '/retailers/tops.png',
  'Villa': '/retailers/villa.png',
  'The Mall': '/retailers/the-mall.png',
  'Lotus': '/retailers/lotus.png',
  'Homepro': '/retailers/homepro.png',
  'Big C': '/retailers/bigc.jpg',
  'TWD': '/retailers/twd.png',
  'Boots': '/retailers/boots.jpg',
  'Foodland': '/retailers/foodland.png',
  'Central Department': '/retailers/central.jpg',
  "Pet'n me": '/retailers/petnme.png',
  'Fuji': '/retailers/fuji.png',
}
// Tops/Villa/Lotus/Homepro/BigC/TWD/Boots/Central/Pet'n me ship as solid brand-color
// tiles (no alpha) — render bare, no wrapper background, or a second white box doubles
// up behind their own fill. Villa/The Mall/Foodland/Fuji are the only 4 with real
// transparency (raw wordmarks); whether each needs a frosted plate depends on ink color
// vs the theme background, measured (WCAG contrast) rather than assumed:
// Villa navy 1.54:1 / The Mall black 1.16:1 against dark bg #0d1117 → both need a plate
// in dark mode only (both pass >5:1 on light unaided). Foodland/Fuji white ink is
// 1.14:1 against light bg #f4efe9 → need a plate in light mode only (18.9:1 on dark
// unaided). No retailer needs a plate in both themes.
const RETAILER_DARK_PLATE = new Set(['Villa', 'The Mall'])
const RETAILER_LIGHT_PLATE = new Set(['Foodland', 'Fuji'])
// Ambient neon glow behind each retailer tile (docs/superpowers/specs/2026-07-13-retailer-glow-codex-brief.md).
// Always-on decoration, not a selection state — kept separate from the .ps-glow ring
// the interactive filter-pill wrappers apply on top. Villa uses brand blue #3aa0ff
// instead of its navy #2d2b74, which reads muddy as a glow (brief's call).
const RETAILER_GLOW = {
  'Tops': '#ff3c1c', 'Villa': '#3aa0ff', 'The Mall': '#ed1c24', 'Lotus': '#00beb5',
  'Homepro': '#1867b2', 'Big C': '#a0c515', 'TWD': '#9b1c20', 'Boots': '#05054b',
  'Foodland': '#ec2029', 'Central Department': '#e23b3b', "Pet'n me": '#ffc502', 'Fuji': '#e4151b',
}

// Activity badge colors for Promotion Plan — defined here (not imported) so colors are
// independent of the generated promo_data.js
const PROMO_ACTIVITY_DISPLAY = {
  field: { label: 'ลงพื้นที่', color: '#f97316' },  // orange — matches the source-file colour, distinct from clearance cyan
  media: { label: 'ลงสื่อ', color: '#A855F7' },     // purple
  looks: { label: 'LOOKS Magazine', color: '#e879f9' },  // fuchsia/pink — clearly distinct from orange field
}

// Renders a retailer's logo, falling back to the short text label if the image is
// missing. Most logos ship as solid brand-color tiles and render bare (no wrapper
// background — a flat white chip behind an already-colored tile was the "white
// border" bug). The 4 transparent-wordmark logos get a frosted glass plate, but only
// in the theme where their ink color actually fails contrast (see RETAILER_DARK_PLATE
// / RETAILER_LIGHT_PLATE above) — full contrast math there, not a blanket plate.
// v3.8.0 "Bare Tile": plate shrinks to a whisper (1px/3px, radius 7) so it reads as
// part of the logo, not a chip — chrome now lives at the call site (see the R1
// selection/dim styling on the interactive filter-pill wrappers), not in here.
function RetailerLogo({ name, h = 28, maxW = 76, dark, fallbackStyle = {} }) {
  const [err, setErr] = useState(false)
  const src = RETAILER_LOGOS[name]
  if (err || !src) return <span style={{ whiteSpace: 'nowrap', ...fallbackStyle }}>{RETAILER_SHORT[name] || name}</span>
  const needsPlate = (dark && RETAILER_DARK_PLATE.has(name)) || (!dark && RETAILER_LIGHT_PLATE.has(name))
  const glow = RETAILER_GLOW[name]
  // Ambient, not hover/selection feedback — kept softer than .ps-glow's hover/selected
  // rings (which live one layer up, on the interactive filter-pill button) so the two
  // never compete when both are present.
  const glowShadow = glow ? `0 0 4px -1px ${glow}, 0 0 9px -3px ${glow}` : ''
  // Fixed-size frame: every logo sits in the same maxW×h box and is scaled to fit
  // (contain) — wide wordmarks shrink to fit width, square logos get side whitespace,
  // so all chips stay uniform and nothing overflows. No per-logo scale needed.
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: maxW, height: h, borderRadius: 7, boxSizing: 'border-box', lineHeight: 0,
      ...(needsPlate
        ? { background: 'rgba(220,220,225,0.92)', backdropFilter: 'blur(6px)', padding: '1px 3px', boxShadow: glowShadow ? `${glowShadow}, 0 0 0 1px rgba(0,0,0,0.08)` : '0 0 0 1px rgba(0,0,0,0.08)' }
        : { background: 'transparent', padding: 0, boxShadow: glowShadow || 'none' }),
    }}>
      <img
        src={src}
        alt={RETAILER_SHORT[name] || name}
        title={name}
        onError={() => setErr(true)}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', borderRadius: needsPlate ? 0 : 5 }}
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
    let barcode, product, packSize, rsp, status, retailerOffset = 8
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
  // idx/failed reset on barcode/side change via the `key` prop at each call site
  // (forces a remount) instead of an effect — see PackshotImg call sites.
  // cache-bust per data build — a stale CDN/browser cache can otherwise keep
  // serving an old image (or old 404) for an updated packshot on one device
  const src = `/packshots/${barcode}_${side}.${EXTS[idx]}?v=${encodeURIComponent(GENERATED_AT)}`
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
const ACT_COLORS = { field: '#f97316', media: '#22d3ee', looks: '#f061ff', clearance: '#f43f5e' }

function ProductPopup({ product, onClose, t, dark, isMobile = false, pricing = {}, variant = 'products', promoItems = [], promoMeta = {} }) {
  const [side, setSide] = useState('front')
  const [popTab, setPopTab] = useState('info')
  const [loadedSrc, setLoadedSrc] = useState(null)
  const [zoomed, setZoomed] = useState(false)
  const [zoomScale, setZoomScale] = useState(1)
  const [panPos, setPanPos] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  // pricing lock — persists across products within the same session
  const [pricingUnlocked, setPricingUnlocked] = useState(() => sessionStorage.getItem('pu') === '1')
  const [unlockedDept, setUnlockedDept] = useState(() => sessionStorage.getItem('puDept') || '')
  const [pwInput, setPwInput] = useState('')
  const [pwError, setPwError] = useState(false)
  const [dlW, setDlW] = useState('')  // export width  (''=original)
  const [dlH, setDlH] = useState('')  // export height (''=original)
  const lbRef = useRef(null)
  const dragRef = useRef(null)

  const downloadAs = (format) => {
    if (!loadedSrc) return
    const ext = format  // 'jpg' | 'png' | 'webp'
    const tw = dlW ? Math.round(Number(dlW)) : null
    const th = dlH ? Math.round(Number(dlH)) : null
    const isOriginal = !tw && !th
    const srcExt = loadedSrc.split('?')[0].split('.').pop().toLowerCase()  // jpg | png | webp
    // Same format as the source at original size → no re-encode, just hand back the file.
    if (isOriginal && ext === srcExt) {
      if (ext === 'png') alert('รูปนี้เป็นไฟล์ PNG อยู่แล้ว — ดาวน์โหลดไฟล์ต้นฉบับ')
      const a = document.createElement('a'); a.href = loadedSrc; a.download = dlName; a.click(); return
    }
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Fit the image (contain, centered, undistorted) into the target W×H box.
      // Original = native box (scale 1, no padding). One missing side mirrors the other (square).
      const boxW = tw || th || img.width
      const boxH = th || tw || img.height
      const scale = Math.min(boxW / img.width, boxH / img.height)
      const dw = img.width * scale, dh = img.height * scale
      const dx = (boxW - dw) / 2, dy = (boxH - dh) / 2
      const canvas = document.createElement('canvas'); canvas.width = boxW; canvas.height = boxH
      const ctx = canvas.getContext('2d')
      if (ext === 'jpg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, boxW, boxH) }
      ctx.drawImage(img, dx, dy, dw, dh)
      const mime = ext === 'jpg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/webp'
      const q = ext === 'jpg' ? 0.92 : undefined
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `${product.barcode}_${side}.${ext}`; a.click()
        URL.revokeObjectURL(url)
      }, mime, q)
    }
    img.src = loadedSrc
  }
  // Popup state (side/loadedSrc/zoomed/etc.) resets per-product via the `key` prop
  // on ProductPopup at the call site (forces a remount) rather than an effect —
  // the useState initializers above already match the old reset values.
  // Reset zoom + pan whenever the lightbox closes — done inline at each close
  // site (closeZoom) rather than via an effect keyed on `zoomed`.
  const closeZoom = () => { setZoomed(false); setZoomScale(1); setPanPos({ x: 0, y: 0 }) }
  useEffect(() => {
    // Esc: close lightbox first, then popup
    const h = (e) => {
      if (e.key === 'Escape') {
        if (zoomed) closeZoom(); else onClose()
      }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose, zoomed])
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
  // Promo history: all periods with a salePrice for this barcode across all retailers.
  // Kept above the `if (!product) return null` below — hooks must run unconditionally.
  const myPromos = useMemo(() => {
    if (!product) return []
    const entries = []
    promoItems.filter(it => String(it.barcode) === String(product.barcode)).forEach(it => {
      const meta = promoMeta[it.retailer]?.periods || []
      Object.entries(it.periods || {}).forEach(([pName, pd]) => {
        if (!pd?.salePrice) return
        const pm = meta.find(m => m.name === pName)
        entries.push({ retailer: it.retailer, period: pName, dateRange: pm?.dateRange || '', price: pd.salePrice, label: pd.saleLabel || '', activities: pd.activities || [] })
      })
    })
    return entries.sort((a, b) => a.retailer.localeCompare(b.retailer) || a.period.localeCompare(b.period))
  }, [product, promoItems, promoMeta])
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
      <PackshotImg key={`${product.barcode}_${side}`} barcode={product.barcode} side={side} onSrcChange={setLoadedSrc} style={{ width: hero ? 'auto' : '100%', maxWidth: hero ? 420 : 'unset', height: hero ? 320 : (isMobile ? 180 : 220), borderRadius: 8, background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }} placeholderSize={56} />
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[{ fmt: 'webp', label: 'WebP' }, { fmt: 'jpg', label: 'JPG' }, { fmt: 'png', label: 'PNG' }].map(({ fmt, label }) => (
                <button key={fmt} onClick={() => downloadAs(fmt)} title={`Download as ${label}${(dlW || dlH) ? ` @${dlW || dlH}×${dlH || dlW}` : ''}`}
                  style={{ padding: '5px 9px', borderRadius: 7, cursor: 'pointer', background: t.surface2, color: t.text, border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
                  <IconDl />{label}
                </button>
              ))}
            </div>
            {/* Resolution: Original · custom W×H · square presets */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 240 }}>
              {(() => {
                const isOrig = !dlW && !dlH
                const chip = (on) => ({ padding: '3px 7px', borderRadius: 5, cursor: 'pointer', fontSize: 10, fontWeight: 600, background: on ? t.accent : t.surface2, color: on ? '#000' : t.muted, border: `1px solid ${on ? t.accent : t.border}` })
                const box = { width: 42, padding: '3px 5px', borderRadius: 5, fontSize: 10, fontWeight: 600, textAlign: 'center', background: t.surface2, color: t.text, border: `1px solid ${t.border}` }
                return (<>
                  <button onClick={() => { setDlW(''); setDlH('') }} style={chip(isOrig)}>Original</button>
                  <input type="number" min="1" value={dlW} placeholder="W" onChange={e => setDlW(e.target.value)} style={box} />
                  <span style={{ color: t.muted, fontSize: 10 }}>×</span>
                  <input type="number" min="1" value={dlH} placeholder="H" onChange={e => setDlH(e.target.value)} style={box} />
                  <span style={{ color: t.muted, fontSize: 9 }}>px</span>
                  {[800, 1200, 2000].map(n => (
                    <button key={n} title={`${n}×${n}`} onClick={() => { setDlW(String(n)); setDlH(String(n)) }} style={chip(Number(dlW) === n && Number(dlH) === n)}>{n}²</button>
                  ))}
                </>)
              })()}
            </div>
          </div>
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

  const pricingBlock = () => {
    if (Object.keys(pricing).length === 0) return null
    const anyRemark = RETAILERS.some(r => pricing[r]?.remark)
    return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>Retailer Pricing</div>
        {pricingUnlocked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, color: t.muted, fontWeight: 600 }}>{unlockedDept} dept</span>
            <button onClick={() => { setPricingUnlocked(false); setUnlockedDept(''); sessionStorage.removeItem('pu'); sessionStorage.removeItem('puDept') }} style={{ background: 'none', border: 'none', fontSize: 10, color: t.muted, cursor: 'pointer', padding: '2px 6px', opacity: 0.6 }}>🔒 Lock</button>
          </div>
        )}
      </div>
      {!pricingUnlocked ? (
        <div style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, padding: '18px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 28, lineHeight: 1 }}>🔒</div>
          <div style={{ fontSize: 12, color: t.muted, fontWeight: 600, textAlign: 'center' }}>Cost & GP data is confidential<br/>Enter PIN to view</div>
          {/* form onSubmit handles both Enter key and button tap reliably on mobile */}
          <form onSubmit={e => {
            e.preventDefault()
            const dept = DEPT_PINS[pwInput]
            if (dept) {
              setPricingUnlocked(true); setUnlockedDept(dept)
              sessionStorage.setItem('pu', '1'); sessionStorage.setItem('puDept', dept)
              logPricingAccess(dept, product.product); setPwInput('')
            } else { setPwError(true); setPwInput('') }
          }} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="password"
              inputMode="numeric"
              maxLength={10}
              value={pwInput}
              onChange={e => { setPwInput(e.target.value); setPwError(false) }}
              placeholder="PIN"
              style={{ width: isMobile ? 110 : 90, background: t.surface, border: `1.5px solid ${pwError ? '#f85149' : t.border}`, borderRadius: 8, color: t.text, padding: isMobile ? '10px 14px' : '8px 12px', fontSize: isMobile ? 18 : 14, textAlign: 'center', outline: 'none', letterSpacing: 4 }}
              autoFocus={!isMobile}
            />
            <button
              type="submit"
              style={{ background: t.accent, border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, fontSize: 13, padding: isMobile ? '10px 20px' : '8px 16px', cursor: 'pointer', minHeight: isMobile ? 44 : 'unset' }}
            >Unlock</button>
          </form>
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
                {anyRemark && <th style={{ textAlign: 'left', padding: '4px 8px', color: t.muted, fontWeight: 700, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>Remark</th>}
              </tr>
            </thead>
            <tbody>
              {RETAILERS.filter(r => pricing[r] && canSeeRetailer(unlockedDept, r)).map(r => {
                const d = pricing[r]
                const gpColor = d.gp >= 0.30 ? t.green : d.gp >= 0.20 ? t.yellow : t.red
                return (
                  <tr key={r} style={{ borderBottom: `1px solid ${t.dim}` }}>
                    <td style={{ padding: '5px 8px', fontWeight: 700, color: t.text, whiteSpace: 'nowrap' }}>{r}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', color: t.text, whiteSpace: 'nowrap' }}>{d.costUnit != null ? '฿' + d.costUnit.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
                    <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: d.gp != null ? gpColor : t.muted }}>{d.gp != null ? Math.round(d.gp * 100) + '%' : '—'}</td>
                    {anyRemark && <td style={{ padding: '5px 8px', color: t.muted, fontSize: 11 }}>{d.remark || ''}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
    )
  }

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
          const v = (product.retailers || {})[r] || ''
          const isActive = v === 'A'
          const isPending = v === 'รอขาย' || v === 'On Process'
          const isDiscon = v === 'ยกเลิกขาย'
          const dotColor = isActive ? t.green : isPending ? t.yellow : isDiscon ? t.red : t.dim
          const dotBg = isActive ? `${t.green}22` : isPending ? `${t.yellow}22` : isDiscon ? `${t.red}22` : 'transparent'
          return (
            <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', borderRadius: 8, background: dotBg, border: `1px solid ${isActive || isPending || isDiscon ? dotColor + '44' : t.border}` }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0, display: 'inline-block', boxShadow: isActive ? `0 0 5px 1px rgba(63,185,80,0.55)` : isPending ? `0 0 5px 1px rgba(210,153,34,0.45)` : isDiscon ? `0 0 5px 1px rgba(248,81,73,0.45)` : 'none' }} />
              <span style={{ fontSize: 11.5, fontWeight: isActive ? 700 : 400, color: isActive || isPending || isDiscon ? t.text : t.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r}</span>
            </div>
          )
        })}
      </div>
    </div>
  )

  const isPackshotView = variant === 'packshot' && !isMobile

  const promoBlock = (
    <div>
      {myPromos.length === 0
        ? <div style={{ fontSize: 13, color: t.muted, padding: '20px 0', textAlign: 'center' }}>No promo entries found for this product.</div>
        : <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 400 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                  {['Retailer', 'Period', 'Dates', 'Price', 'Type'].map(h => (
                    <th key={h} style={{ padding: '4px 8px', textAlign: 'left', color: t.muted, fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myPromos.map((e, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${t.border}`, opacity: 1 }}>
                    <td style={{ padding: '5px 8px', fontWeight: 600, color: t.text, whiteSpace: 'nowrap' }}>{e.retailer}</td>
                    <td style={{ padding: '5px 8px', color: t.muted, fontFamily: 'ui-monospace,monospace', fontSize: 11 }}>{e.period}</td>
                    <td style={{ padding: '5px 8px', color: t.muted, whiteSpace: 'nowrap' }}>{e.dateRange || '—'}</td>
                    <td style={{ padding: '5px 8px', fontWeight: 700, color: t.accent, whiteSpace: 'nowrap' }}>฿{e.price}{e.label ? ` ${e.label}` : ''}</td>
                    <td style={{ padding: '5px 8px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {e.activities.map(a => <span key={a} style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: `${ACT_COLORS[a] || t.muted}22`, color: ACT_COLORS[a] || t.muted }}>{a}</span>)}
                        {e.activities.length === 0 && <span style={{ fontSize: 10, color: t.muted }}>price</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      }
    </div>
  )

  return (
    <>
      {/* ── Lightbox ── */}
      {zoomed && loadedSrc && (
        <div
          ref={lbRef}
          onClick={closeZoom}
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
          <button onClick={closeZoom} style={{ position: 'absolute', top: 20, right: 20, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '50%', color: '#fff', fontSize: 18, width: 40, height: 40, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>✕</button>
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
        <div onClick={e => e.stopPropagation()} style={{ background: dark ? 'rgba(22,27,34,.85)' : 'rgba(251,248,243,.88)', backdropFilter: 'blur(22px) saturate(1.4)', WebkitBackdropFilter: 'blur(22px) saturate(1.4)', borderRadius: isMobile ? '16px 16px 0 0' : 18, width: '100%', maxWidth: isMobile ? '100%' : 860, maxHeight: isMobile ? '95dvh' : '90vh', overflow: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.5)', border: `1px solid ${dark ? t.border : 'rgba(255,255,255,.65)'}` }}>
          {/* Mobile drag handle */}
          {isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 10, paddingBottom: 6 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: t.border }} />
            </div>
          )}
          {/* Header */}
          <div style={{ padding: isMobile ? '10px 14px 14px' : '16px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'flex-start', gap: 12, background: t.surface2 }}>
            {!isMobile && <BrandPill brand={product.brand} company={product.company} t={t} size="l" />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: t.text, lineHeight: 1.4, marginBottom: 4 }}>{product.product}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {isMobile && <BrandPill brand={product.brand} company={product.company} t={t} size="s" />}
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
                {/* tab pills */}
                <div style={{ display: 'flex', gap: 6 }}>
                  {[['info', 'Info'], ['promos', `Promos${myPromos.length ? ` (${myPromos.length})` : ''}`]].map(([key, label]) => (
                    <button key={key} onClick={() => setPopTab(key)} style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 99, border: `1px solid ${popTab === key ? t.accent : t.border}`, background: popTab === key ? `${t.accent}22` : 'transparent', color: popTab === key ? t.accent : t.muted, cursor: 'pointer' }}>{label}</button>
                  ))}
                </div>
                {popTab === 'info' ? <>
                  {statsRow}
                  {pricingBlock()}
                  {coverageBlock('repeat(3, 1fr)')}
                </> : promoBlock}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// Nav-tab icons — pure/stateless, hoisted to module scope so they're stable
// component references (defining them inside App() re-created them every render).
function IconBarChart({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill={color} xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="8" width="3" height="5.5" rx="0.6"/>
      <rect x="5.5" y="4" width="3" height="9.5" rx="0.6"/>
      <rect x="10.5" y="1" width="3" height="12.5" rx="0.6"/>
    </svg>
  )
}
function IconGrid({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  )
}
function IconImage({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5L5 20"/>
    </svg>
  )
}
function IconCalendar({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/>
    </svg>
  )
}

export default function App() {
  const [rawData, setRawData] = useState(fallbackData)
  const [lastUpdated, setLastUpdated] = useState(() => fmtTs(__BUILD_TIME__))
  const [dataSource, setDataSource] = useState('xlsx')
  const [dark, setDark] = useState(true)
  const [tab, setTab] = useState('products')
  const [alerts, setAlerts] = useState([])
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [alertsSeen, setAlertsSeen] = useState(() => sessionStorage.getItem('alertsSeen') === bangkokToday())
  useEffect(() => {
    fetch('/notification_schedule.json')
      .then(r => (r.ok ? r.json() : []))
      .then(sched => setAlerts(upcomingWithin(sched, bangkokToday(), 5)))
      .catch(() => {})
  }, [])
  const alertsRef = useRef(null)
  const todayISO = bangkokToday()
  const alertMinDays = alerts.length ? Math.min(...alerts.map(a => daysUntil(a.startDate, todayISO))) : null
  useEffect(() => {
    if (!alertsOpen) return
    const handler = (e) => { if (alertsRef.current && !alertsRef.current.contains(e.target)) setAlertsOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [alertsOpen])
  // Admin access log — who unlocked cost/GP, on what, when (this device only; see deptPins.js)
  const [logOpen, setLogOpen] = useState(false)
  const [logDept, setLogDept] = useState(() => {
    const d = sessionStorage.getItem('puDept') || ''
    return canViewAccessLog(d) ? d : ''
  })
  const [logPin, setLogPin] = useState('')
  const [logPinErr, setLogPinErr] = useState(false)
  const [, setLogTick] = useState(0)  // value unused — setter forces a re-read of getAccessLog()
  const logRef = useRef(null)
  useEffect(() => {
    if (!logOpen) return
    const handler = (e) => { if (logRef.current && !logRef.current.contains(e.target)) setLogOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [logOpen])
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
  const [matrixPopover, setMatrixPopover] = useState(null)
  const [periodPopover, setPeriodPopover] = useState(null)  // {period, brands, x, y}
  const [promoRetailer] = useState(null)  // single-select — setter unused, dead calc-modal filter below always sees null
  const [promoUnlocked, setPromoUnlocked] = useState(() => sessionStorage.getItem('pu') === '1')
  const [, setPromoUnlockedDept] = useState(() => sessionStorage.getItem('puDept') || '')  // value unused, only the setter is read
  const [promoPwInput, setPromoPwInput] = useState('')
  const [promoPwError, setPromoPwError] = useState(false)
  // Compensate calculator (popup) — RSP/GP come from a chosen product, user types promo price
  const [calcOpen, setCalcOpen] = useState(false)
  const [calcMode, setCalcMode] = useState('keepgp')   // basis: 'keepgp' | 'full'
  const [calcType, setCalcType] = useState('single')   // promo type: 'single' | '2for' | 'b2g1'
  const [calcProductBc, setCalcProductBc] = useState('')
  const [calcPromo, setCalcPromo] = useState('')
  const [calcCopied, setCalcCopied] = useState(false)
  const [alertTestState, setAlertTestState] = useState('')  // '' | 'sending' | 'ok' | 'err'
  const clearCalc = () => { setCalcProductBc(''); setCalcPromo(''); setCalcCopied(false) }
  const [anaVendor, setAnaVendor] = useState('ALL')   // Analytics page vendor scope: 'ALL' | 'Vcan' | 'Moola'

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (!mobile) setMobileNavOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Keep the mobile browser chrome (status bar / address bar) in sync with the theme,
  // so light mode doesn't show a dark bar that makes the page look like dimmed dark mode.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', dark ? '#010409' : '#f4efe9')
  }, [dark])

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
    bg: '#f4efe9', surface: '#fbf8f3', surface2: '#f3ede4', border: '#ded3c2',
    text: '#262019', muted: '#70634f', dim: '#e3dacb', accent: '#a5784a',
    green: '#1a7f37', yellow: '#9a6700', red: '#cf222e', blue: '#0969da',
    orange: '#953800', rowHover: '#f6f1e9', sidebarBg: '#efe7dc', headerBg: '#f4efe9',
    vcanClr: '#9c6b35', moolaClr: '#c0392b',
  }

  // frosted-glass panel (v2.22.0 "real glass") — translucent enough to refract the aurora
  // behind it, strong saturated frost, a light rim (inset top-left), layered depth shadows,
  // and a faint top specular sheen (the leading linear-gradient background layer).
  const glassPanel = dark ? {
    background: 'linear-gradient(180deg, rgba(255,255,255,.06), transparent 38%), rgba(22,27,34,.42)',
    backdropFilter: 'blur(24px) saturate(1.8)', WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
    border: '1px solid rgba(255,255,255,.10)',
    boxShadow: '0 12px 40px rgba(0,0,0,.45), 0 2px 8px rgba(0,0,0,.35), inset 1px 1px 0 rgba(255,255,255,.10)',
  } : {
    background: 'linear-gradient(180deg, rgba(255,255,255,.55), transparent 42%), rgba(251,248,243,.40)',
    backdropFilter: 'blur(24px) saturate(1.8)', WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
    border: '1px solid rgba(255,255,255,.7)',
    boxShadow: '0 12px 40px rgba(82,62,40,.14), 0 2px 8px rgba(82,62,40,.10), inset 1px 1px 0 rgba(255,255,255,.85)',
  }

  const visibleBrands = VENDOR_BRANDS[vendorFilter] || VENDOR_BRANDS.ALL
  const brandGroups = useMemo(() => {
    const g = {}
    visibleBrands.forEach(b => { (g[brandCategory(b)] = g[brandCategory(b)] || []).push(b) })
    return g
  }, [visibleBrands])
  const handleVendorChange = (v) => { setVendorFilter(v); setSelectedBrands([]) }
  const toggleBrand = (b) => setSelectedBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])
  // brand → company (stable, for the monogram tile's vendor color) and brand → SKU count
  // scoped by vendor/retailer/search (mirrors statsBase, minus the brand filter itself so
  // picking a brand doesn't zero out its own count badge).
  const brandCompany = useMemo(() => {
    const m = {}
    rawData.forEach(p => { const b = p.brand.trim(); if (!(b in m)) m[b] = p.company })
    return m
  }, [rawData])
  const brandCounts = useMemo(() => {
    const scoped = rawData.filter(p => {
      if (vendorFilter !== 'ALL' && p.company !== vendorFilter) return false
      if (selectedRetailers.length > 0 && !selectedRetailers.some(r => p.retailers[r])) return false
      if (search) {
        const q = search.toLowerCase()
        if (!p.product.toLowerCase().includes(q) && !p.brand.toLowerCase().includes(q) && !p.barcode.includes(q)) return false
      }
      return true
    })
    const m = {}
    scoped.forEach(p => { const b = p.brand.trim(); m[b] = (m[b] || 0) + 1 })
    return m
  }, [rawData, vendorFilter, selectedRetailers, search])
  // size="s" here only — this feeds the Products-tab category filter panel, which
  // needs to fit many brands without scrolling; popup/packshot/analytics pills stay
  // at their bigger size elsewhere (BrandPill's other call sites are unaffected).
  const renderBrandPill = (b) => (
    <BrandPill key={b} brand={b} company={brandCompany[b]} t={t} size="s"
      selected={selectedBrands.includes(b)} count={brandCounts[b] || 0}
      onClick={() => toggleBrand(b)} />
  )
  const clearAll = () => { setSearch(''); setSelectedBrands([]); setSelectedRetailers([]); setStatusTab('ALL'); setVendorFilter('ALL'); setSortCol(null); setSortDir('asc') }
  const toggleRetailer = (r) => setSelectedRetailers(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  const toggleStatus = (k) => setStatusTab(s => (s === k ? 'ALL' : k))
  const handleSort = (col) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc')
      else { setSortCol(null); setSortDir('asc') }
    } else { setSortCol(col); setSortDir('asc') }
  }
  const hasActiveFilters = search || selectedBrands.length > 0 || selectedRetailers.length > 0 || statusTab !== 'ALL' || vendorFilter !== 'ALL'
  const visibleRetailers = selectedRetailers.length > 0 ? selectedRetailers : RETAILERS

  // Scope = active filters EXCEPT status. The four summary cards ARE the status
  // breakdown, so they reflect this scope (retailer / vendor / brand / search) and
  // stay meaningful even when a status is also picked. Retailer is the headline
  // driver (task 3): pick "Tops" and the cards show only products listed at Tops.
  const statsBase = useMemo(() => rawData.filter(p => {
    if (vendorFilter !== 'ALL' && p.company !== vendorFilter) return false
    if (selectedBrands.length > 0 && !selectedBrands.includes(p.brand.trim())) return false
    if (selectedRetailers.length > 0 && !selectedRetailers.some(r => p.retailers[r])) return false
    if (search) {
      const q = search.toLowerCase()
      if (!p.product.toLowerCase().includes(q) && !p.brand.toLowerCase().includes(q) && !p.barcode.includes(q)) return false
    }
    return true
  }), [rawData, vendorFilter, selectedBrands, selectedRetailers, search])

  const stats = useMemo(() => {
    let active = 0, pending = 0, discon = 0
    statsBase.forEach(p => {
      const s = effStatusFor(p, selectedRetailers)
      if (s === 'ขาย') active++
      else if (s === 'รอขาย') pending++
      else if (s === 'ยกเลิกขาย') discon++
    })
    return { total: statsBase.length, active, pending, discon }
  }, [statsBase, selectedRetailers])

  // Human label for what the cards are scoped to (reverts to "all products" when clear).
  const scopeLabel = selectedRetailers.length > 0
    ? `at ${selectedRetailers.join(' · ')}`
    : (vendorFilter !== 'ALL' || selectedBrands.length > 0 || search) ? 'filtered subset' : 'all products'

  // Table list = the same scope, then narrowed by the status filter.
  const filtered = useMemo(
    () => (statusTab === 'ALL' ? statsBase : statsBase.filter(p => effStatusFor(p, selectedRetailers) === statusTab)),
    [statsBase, statusTab, selectedRetailers]
  )

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
    // Scope the whole page by the Analytics vendor selector (ALL / Vcan / Moola).
    const data = anaVendor === 'ALL' ? rawData : rawData.filter(p => p.company === anaVendor)

    // Retailer-level aggregates
    const retailers = RETAILERS.map(r => {
      const skus = data.filter(p => isActive(p.retailers[r]))
      const pending = data.filter(p => isPending(p.retailers[r])).length
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
    data.forEach(p => {
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
    const cActive = data.filter(p => p.status === 'ขาย').length
    const cPending = data.filter(p => p.status === 'รอขาย').length
    const cDiscon = data.filter(p => p.status === 'ยกเลิกขาย').length
    const dTot = Math.max(cActive + cPending + cDiscon, 1)
    const summary = {
      totalActive: cActive,
      totalPending: cPending,
      totalDiscon: cDiscon,
      total: data.length,
      aDeg: cActive / dTot * 360,
      pDeg: (cActive + cPending) / dTot * 360,
      brandCount: activeBrandCount,
      avgCoverage: activeBrandCount ? brands.filter(b => b.active > 0).reduce((s, b) => s + b.coverage, 0) / activeBrandCount : 0,
    }
    return { brands, retailers, retailersByActive, coreRetailers, gaps, summary }
  }, [rawData, anaVendor])

  // Promo tab derived data — enriches promoData with brand/company from product master.
  // Promo barcodes not in the master (e.g. Vernel) fall back to the product name's first
  // word as the brand, so every row still groups under something sensible.
  const enrichedPromoData = useMemo(() => {
    // Build brand list sorted longest-first for prefix matching: lets us map
    // "General Fresh Five-FORCE..." → "General Fresh" (from master) not "General".
    const knownBrands = [...new Set(rawData.map(r => r.brand.trim()))].sort((a, b) => b.length - a.length)
    return promoData.map(p => {
      const m = rawData.find(r => r.barcode === p.barcode)
      const discon = m ? m.status === 'ยกเลิกขาย' : false
      if (m) return { ...p, brand: m.brand, company: m.company, discon }
      if (p.brand) return { ...p, discon }
      const prod = (p.product || '').trim()
      const prodLower = prod.toLowerCase()
      // Longest-match: find a master brand that is a prefix of this product name
      const matched = knownBrands.find(b => {
        const bl = b.toLowerCase()
        return prodLower === bl || prodLower.startsWith(bl + ' ') || prodLower.startsWith(bl + '-')
      })
      if (matched) return { ...p, brand: matched, discon }
      // Last resort: text before first hyphen (≤25 chars), else first word
      const dashIdx = prod.indexOf('-')
      const fallback = (dashIdx > 0 && dashIdx < 25) ? prod.slice(0, dashIdx).trim() : (prod.split(/\s+/)[0] || '—')
      return { ...p, brand: fallback, discon }
    })
  }, [rawData])

  const maxRetailerActive = Math.max(...intel.retailers.map(r => r.active), 1)
  const gpTone = (g) => g == null ? t.muted : g >= 0.30 ? t.green : g >= 0.20 ? t.yellow : t.red

  function RetailerDot({ value }) {
    if (value === 'A') return (
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.green, margin: 'auto', boxShadow: `0 0 7px 2px rgba(63,185,80,0.6)` }} />
    )
    if (value === 'รอขาย') return (
      <div style={{ width: 10, height: 10, borderRadius: '50%', margin: 'auto', background: `linear-gradient(to left, ${t.yellow} 50%, transparent 50%)`, border: `1.5px solid ${t.yellow}`, boxShadow: `0 0 6px 2px rgba(210,153,34,0.5)` }} />
    )
    if (value === 'On Process') return (
      <div style={{ width: 10, height: 10, borderRadius: '50%', margin: 'auto', background: `linear-gradient(to left, ${t.blue} 50%, transparent 50%)`, border: `1.5px solid ${t.blue}`, boxShadow: `0 0 6px 2px rgba(88,166,255,0.5)` }} />
    )
    if (value === 'ยกเลิกขาย') return (
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.red, margin: 'auto', boxShadow: `0 0 5px 1px rgba(248,81,73,0.5)` }} />
    )
    return <div style={{ width: 6, height: 1, background: t.dim, margin: 'auto' }} />
  }

  const BentoHead = ({ title, desc }) => (
    <div>
      <div style={{ fontWeight: 700, fontSize: 14.5, color: t.text, letterSpacing: '-0.01em' }}>{title}</div>
      <div style={{ fontSize: 11, color: t.muted, marginTop: 3, lineHeight: 1.45 }}>{desc}</div>
    </div>
  )

  function StatCard({ label, value, sub, color, active, onClick }) {
    const ring = color || t.accent
    return (
      <div className="vc-rise vc-lift" onClick={onClick} role={onClick ? 'button' : undefined} title={onClick ? `Filter: ${label}` : undefined} style={{
        ...glassPanel, borderRadius: 12, padding: isMobile ? '14px 16px' : '20px 24px',
        cursor: onClick ? 'pointer' : 'default',
        outline: active ? `2px solid ${ring}` : '2px solid transparent', outlineOffset: -2,
        boxShadow: active ? `${glassPanel.boxShadow}, 0 0 0 4px ${ring}22` : glassPanel.boxShadow,
      }}>
        <div style={{ fontSize: 11, color: t.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: isMobile ? 28 : 36, fontWeight: 800, color: color || t.text, lineHeight: 1, marginBottom: 4 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: t.muted }}>{sub}</div>}
      </div>
    )
  }

  const NAV_ITEMS = [
    { key: 'products', icon: <IconGrid />, label: 'Products' },
    { key: 'analytics', icon: <IconBarChart size={15} />, label: 'Analytics' },
    { key: 'packshot', icon: <IconImage />, label: 'Packshot' },
    { key: 'promotion', icon: <IconCalendar />, label: 'Promotion Plan' },
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
    <div style={{ display: 'flex', minHeight: '100vh', color: t.text, fontSize: 14, zoom: 1.05,
      // Aurora glows behind everything so glass panels actually refract on every page.
      // Light = warm sage/coral porcelain; dark = subtle gold/blue over the deep base.
      // Slightly stronger so the new translucent glass has something to refract.
      // Mobile: skip the big aurora + fixed-attachment (buggy on mobile). On a narrow screen
      // the 900px radials cover the whole viewport and wash the porcelain in green/coral —
      // it read as a dim tint, not light mode. Use the solid bg instead.
      background: isMobile ? t.bg : (dark
        ? `radial-gradient(950px 620px at 86% -10%, rgba(240,192,64,.10), transparent 60%), radial-gradient(820px 600px at -8% 104%, rgba(88,166,255,.09), transparent 60%), ${t.bg}`
        : `radial-gradient(900px 600px at 88% -8%, rgba(122,168,116,.17), transparent 62%), radial-gradient(820px 620px at -6% 96%, rgba(214,106,90,.15), transparent 62%), ${t.bg}`),
      backgroundAttachment: isMobile ? 'scroll' : 'fixed' }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{background:${t.bg};}
        body{font-family:'Plus Jakarta Sans',sans-serif;-webkit-font-smoothing:antialiased;}
        input,select,button{font-family:inherit;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${t.border};border-radius:3px;}
        .rhover:hover{background:${t.rowHover}!important;}
        .bpill{transition:all 0.15s;cursor:pointer;}
        .bpill:hover{background:${t.accent}!important;color:#000!important;border-color:${t.accent}!important;transform:translateY(-2px);box-shadow:0 4px 12px ${t.accent}55;}
        .nav-item{transition:all 0.15s;cursor:pointer;}
        .nav-item:hover{background:${t.surface2}!important;}
        .sb-btn{transition:background 0.15s;cursor:pointer;}
        .sb-btn:hover{background:${t.surface2}!important;}
        /* Restrained neon-glyph glow for chrome icons — keyed to the icon's own colour
           (currentColor), so active/accent icons glow accent, muted ones stay subtle. */
        .neon-ico{filter:drop-shadow(0 0 2px currentColor);transition:filter .15s;}
        .neon-ico:hover{filter:drop-shadow(0 0 4px currentColor);}
        .clr-btn{transition:all 0.15s;cursor:pointer;}
        .clr-btn:hover{box-shadow:0 0 8px 3px rgba(248,81,73,0.4)!important;border-color:#f85149!important;color:#f85149!important;}

        /* Retailer pill "Bare Tile" (v3.8.0) — chrome-free filter pill; selection
           reads by glow ring + dimming siblings, never by a background box. */
        .rp-btn{transition:opacity .15s ease,box-shadow .15s ease,transform .12s ease;}
        .rp-btn:hover{transform:translateY(-1px);}
        .rp-btn:hover:not(.rp-sel){box-shadow:0 0 0 1px ${t.border};}
        .rp-sel{box-shadow:0 0 0 2px var(--g,${t.accent}),0 0 14px -2px var(--g,${t.accent});}
        .rp-row:has(.rp-sel) .rp-btn:not(.rp-sel){opacity:.42;}

        /* ── universal motion system (v2.21.0) ── */
        @keyframes vcRise{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:none;}}
        @keyframes vcFade{from{opacity:0;}to{opacity:1;}}
        .vc-lift{transition:transform .22s cubic-bezier(.22,.61,.36,1),box-shadow .25s;}
        @media(prefers-reduced-motion:no-preference){
          .vc-fade{animation:vcFade .34s ease both;}
          .vc-rise{animation:vcRise .5s cubic-bezier(.22,.61,.36,1) both;}
          .vc-rise:nth-child(1){animation-delay:.02s;}
          .vc-rise:nth-child(2){animation-delay:.07s;}
          .vc-rise:nth-child(3){animation-delay:.12s;}
          .vc-rise:nth-child(4){animation-delay:.17s;}
          .vc-rise:nth-child(5){animation-delay:.22s;}
          .vc-rise:nth-child(6){animation-delay:.27s;}
          .vc-lift:hover{transform:translateY(-3px);}
        }
        @media(max-width:767px){
          .rhover:hover{background:unset!important;}
          .bpill:hover{background:unset!important;color:unset!important;border-color:unset!important;}
          .bpill:active{background:${t.accent}!important;color:#000!important;border-color:${t.accent}!important;}
          .vc-lift:hover{transform:none;}
        }
      `}</style>

      {/* ── MOBILE BACKDROP ── */}
      {isMobile && mobileNavOpen && (
        <div onClick={() => setMobileNavOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 150, backdropFilter: 'blur(2px)' }} />
      )}

      {/* ── SIDEBAR ── */}
      {/* height divided by the root zoom (1.05) so the pinned credit isn't pushed off-screen */}
      <aside style={{
        width: isMobile ? 260 : SIDEBAR_W,
        minHeight: 'calc(100vh / 1.05)',
        background: dark ? 'rgba(1,4,9,.72)' : 'rgba(239,231,220,.72)',
        backdropFilter: 'blur(18px) saturate(1.3)', WebkitBackdropFilter: 'blur(18px) saturate(1.3)',
        borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column',
        position: isMobile ? 'fixed' : 'sticky',
        top: 0, left: 0, height: 'calc(100vh / 1.05)', overflow: 'hidden',
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
          <button onClick={() => isMobile ? setMobileNavOpen(false) : setSidebarOpen(o => !o)} className="sb-btn neon-ico" style={{
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
                <span className="neon-ico" style={{ flexShrink: 0, width: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{icon}</span>
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
        {/* Credit */}
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${t.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: dark ? '#8d96a3' : t.muted, lineHeight: 1.6, textAlign: 'center', fontWeight: 500 }}>
            Made by Meth<br />Trade Marketing
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Header */}
        <header style={{
          background: dark ? 'rgba(1,4,9,.68)' : 'rgba(244,239,233,.68)',
          backdropFilter: 'blur(16px) saturate(1.4)', WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
          borderBottom: `1px solid ${t.border}`,
          padding: isMobile ? '0 12px' : '0 24px', height: 56, display: 'flex', alignItems: 'center',
          gap: isMobile ? 8 : 10, position: 'sticky', top: 0, zIndex: 50,
        }}>
          {/* Mobile hamburger */}
          {isMobile && (
            <button onClick={() => setMobileNavOpen(o => !o)} className="sb-btn neon-ico" style={{ background: 'none', border: 'none', color: t.muted, padding: '7px 6px', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
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
            <span style={{ color: t.accent, fontSize: isMobile ? 11 : 14, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>v3.11.1</span>
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
            {/* Promo alerts bell */}
            <div ref={alertsRef} style={{ position: 'relative' }}>
              <button onClick={() => { setAlertsOpen(o => !o); if (!alertsSeen) { sessionStorage.setItem('alertsSeen', bangkokToday()); setAlertsSeen(true) } }} className="sb-btn neon-ico" aria-label="Upcoming promo alerts" style={{
                background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.muted,
                padding: isMobile ? '5px 8px' : '5px 10px', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {alerts.length > 0 && !alertsSeen && (
                  <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: alertMinDays <= 0 ? t.red : alertMinDays <= 2 ? (dark ? '#fb923c' : '#b45309') : t.yellow, color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{alerts.length}</span>
                )}
              </button>
              {alertsOpen && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 280, maxHeight: 360, overflowY: 'auto', background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.3)', zIndex: 60, padding: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: t.muted, padding: '4px 8px 8px' }}>Upcoming promos (≤5 days)</div>
                  {alerts.length === 0 && <div style={{ fontSize: 12, color: t.muted, padding: '4px 8px 8px' }}>Nothing in the next 5 days.</div>}
                  {alerts.map((e, i) => {
                    const d = daysUntil(e.startDate, todayISO)
                    const u = alertUrgency(d)
                    const clr = u.tone === 'today' ? t.red : u.tone === 'soon' ? (dark ? '#fb923c' : '#b45309') : t.yellow
                    return (
                      <div key={i} style={{
                        padding: '9px 10px 9px 12px', marginTop: i ? 6 : 2, borderRadius: 10,
                        background: `${clr}14`, borderLeft: `4px solid ${clr}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: t.text }}>{e.retailer}</span>
                          {e.activities?.length > 0 && (
                            <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em', color: clr, background: `${clr}24`, borderRadius: 5, padding: '1px 6px' }}>{e.activities.join(' · ')}</span>
                          )}
                        </div>
                        {e.brands?.length > 0 && (
                          <div style={{ fontSize: 12, color: t.text, opacity: .82, marginTop: 3, lineHeight: 1.35 }}>{e.brands.join(', ')}</div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 800, color: clr }}>{u.text}</span>
                          <span style={{ fontSize: 10.5, color: t.muted, fontFamily: 'ui-monospace,monospace' }}>· {e.startDate}</span>
                        </div>
                      </div>
                    )
                  })}
                  <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 4, padding: '8px 8px 4px', display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={() => {
                      const secret = window.prompt('Enter alert secret:');
                      if (!secret) return;
                      setAlertTestState('sending');
                      fetch(`/api/test-alert?secret=${encodeURIComponent(secret)}`, { method: 'POST' })
                        .then(async r => {
                          const txt = await r.text().catch(() => '');
                          if (r.ok) { setAlertTestState('ok'); }
                          else { alert(`Error ${r.status}: ${txt}`); setAlertTestState('err'); }
                        })
                        .catch(e => { alert(`Network error: ${e.message}`); setAlertTestState('err'); })
                        .finally(() => setTimeout(() => setAlertTestState(''), 4000));
                    }} disabled={alertTestState === 'sending'} style={{ background: 'none', border: `1px solid ${alertTestState === 'ok' ? t.green : alertTestState === 'err' ? '#f43f5e' : t.border}`, borderRadius: 6, color: alertTestState === 'ok' ? t.green : alertTestState === 'err' ? '#f43f5e' : t.muted, fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '5px 12px' }}>
                      {alertTestState === 'sending' ? '...' : alertTestState === 'ok' ? '✓ Sent' : alertTestState === 'err' ? '✕ Failed' : 'Send LINE test'}
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* Access log (admin only — who unlocked cost/GP) */}
            <div ref={logRef} style={{ position: 'relative' }}>
              <button onClick={() => setLogOpen(o => !o)} className="sb-btn neon-ico" aria-label="Pricing access log" style={{
                background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.muted,
                padding: isMobile ? '5px 8px' : '5px 10px', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              </button>
              {logOpen && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 300, maxHeight: 380, overflowY: 'auto', background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.3)', zIndex: 60, padding: 12 }}>
                  {!canViewAccessLog(logDept) ? (
                    <>
                      <div style={{ fontSize: 12, fontWeight: 800, color: t.muted, marginBottom: 8 }}>Pricing access log</div>
                      <div style={{ fontSize: 11.5, color: t.muted, marginBottom: 10 }}>Enter your department PIN to view who unlocked cost/GP.</div>
                      <form onSubmit={e => {
                        e.preventDefault()
                        const dept = DEPT_PINS[logPin]
                        if (dept && canViewAccessLog(dept)) {
                          setLogDept(dept)
                          sessionStorage.setItem('pu', '1'); sessionStorage.setItem('puDept', dept)
                          setLogPin(''); setLogPinErr(false)
                        } else { setLogPinErr(true); setLogPin('') }
                      }} style={{ display: 'flex', gap: 8 }}>
                        <input type="password" inputMode="numeric" maxLength={10} value={logPin}
                          onChange={e => { setLogPin(e.target.value); setLogPinErr(false) }}
                          placeholder="PIN"
                          style={{ flex: 1, background: t.surface2, border: `1.5px solid ${logPinErr ? '#f85149' : t.border}`, borderRadius: 8, color: t.text, padding: '8px 10px', fontSize: 14, textAlign: 'center', outline: 'none', letterSpacing: 3 }} />
                        <button type="submit" style={{ background: t.accent, border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, fontSize: 12, padding: '8px 14px', cursor: 'pointer' }}>View</button>
                      </form>
                      {logPinErr && <div style={{ fontSize: 11, color: '#f85149', fontWeight: 600, marginTop: 6 }}>Wrong PIN, or not authorized to view the log</div>}
                    </>
                  ) : (() => {
                    const entries = getAccessLog()
                    return (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: t.muted }}>Pricing access log</div>
                          <button onClick={() => { clearAccessLog(); setLogTick(v => v + 1) }} style={{ background: 'none', border: 'none', fontSize: 10.5, color: t.muted, cursor: 'pointer', opacity: 0.7 }}>Clear</button>
                        </div>
                        <div style={{ fontSize: 10, color: t.muted, opacity: 0.75, marginBottom: 8 }}>This device only — not a company-wide log.</div>
                        {entries.length === 0 && <div style={{ fontSize: 12, color: t.muted, padding: '4px 0' }}>No pricing access recorded on this device yet.</div>}
                        {entries.map((e, i) => (
                          <div key={i} style={{ padding: '7px 8px', marginTop: i ? 4 : 0, borderRadius: 8, background: t.surface2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{e.dept}</span>
                              <span style={{ fontSize: 10, color: t.muted, fontFamily: 'ui-monospace,monospace' }}>{new Date(e.time).toLocaleString()}</span>
                            </div>
                            <div style={{ fontSize: 11.5, color: t.muted, marginTop: 2 }}>{e.product}</div>
                          </div>
                        ))}
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
            {/* Dark mode */}
            <button onClick={() => setDark(d => !d)} className="sb-btn neon-ico" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} style={{
              background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.muted,
              padding: isMobile ? '5px 8px' : '5px 10px', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {dark ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
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
         {/* keyed by tab → re-mounts and fades on every page switch (vc-fade is opacity-only, safe for sticky children) */}
         <div key={tab} className="vc-fade">

          {/* PRODUCTS */}
          {tab === 'products' && (
            <>
              {/* Stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                {StatCard({ label: 'Total SKUs', value: stats.total, sub: scopeLabel, color: scopeLabel === 'all products' ? undefined : t.accent })}
                {StatCard({ label: 'Active', value: stats.active, sub: `${stats.total ? Math.round(stats.active / stats.total * 100) : 0}% of total`, color: t.green, active: statusTab === 'ขาย', onClick: () => toggleStatus('ขาย') })}
                {StatCard({ label: 'Pending', value: stats.pending, sub: 'รอขาย', color: t.yellow, active: statusTab === 'รอขาย', onClick: () => toggleStatus('รอขาย') })}
                {StatCard({ label: 'Discontinued', value: stats.discon, sub: 'ยกเลิกขาย', color: t.red, active: statusTab === 'ยกเลิกขาย', onClick: () => toggleStatus('ยกเลิกขาย') })}
              </div>

              {/* Sticky filter section */}
              <div style={{ position: 'sticky', top: 0, zIndex: 10, background: t.bg, paddingBottom: 16, paddingTop: 4 }}>
                {/* Search + Clear all */}
                <div style={{
                  ...glassPanel, borderRadius: 12, padding: '10px 14px', marginBottom: 10,
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
                      <button onClick={clearAll} className="vc-lift" style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        background: t.accent, border: `1.5px solid ${t.accent}`, borderRadius: 8,
                        color: '#000', fontSize: 12.5, fontWeight: 800, cursor: 'pointer',
                        padding: '8px 16px', whiteSpace: 'nowrap', flexShrink: 0,
                        boxShadow: `0 2px 10px ${t.accent}66`,
                      }}>✕ Clear filters</button>
                    )}
                  </div>
                </div>

                {/* Retailer logo pills — desktop only (mobile table has no retailer columns) */}
                {!isMobile && <div style={{
                  ...glassPanel, borderRadius: 12, padding: '10px 14px', marginBottom: 10,
                }}>
                  <div className="rp-row" style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 }}>Customer</span>
                    {RETAILERS.map(r => {
                      const sel = selectedRetailers.includes(r)
                      return (
                        <button key={r} onClick={() => toggleRetailer(r)} title={r}
                          className={`rp-btn${sel ? ' rp-sel' : ''}`}
                          style={{
                            '--g': t.accent, display: 'inline-flex', alignItems: 'center',
                            background: 'transparent', border: 'none', borderRadius: 8,
                            padding: 2, cursor: 'pointer',
                          }}>
                          <RetailerLogo name={r} h={32} maxW={80} dark={dark} fallbackStyle={{ fontSize: 11, fontWeight: 700, color: t.text }} />
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
                  ...glassPanel, borderRadius: 12, padding: '12px 16px',
                  // No inner max-height/scroll here on purpose: the full-width band
                  // layout below scales height predictably with brand count (unlike
                  // the old narrow-column layout, which could grow one column
                  // unboundedly tall). Letting the panel take its natural height and
                  // scroll with the page avoids a nested inner scrollbar.
                }}>
                  {/* Categorized brand pills — CSS multi-column masonry. Two prior
                      layouts both failed: (1) one narrow column PER category, pills
                      wrapping only inside that sliver, forced busy categories
                      (Personal Care, Pet) into many single-pill rows while idle
                      categories left dead space beside them; (2) an equal-width card
                      grid gave every category the same width regardless of brand
                      count, so a busy category still got squeezed tall in its share.
                      `columns` with only a column-WIDTH hint (no count) fixed the
                      height-balance problem — category cards (break-inside: avoid,
                      so one never splits across columns) distribute into however
                      many columns the content needs to balance — but that same
                      auto-balance stops adding columns once the content's happy with
                      fewer, leaving the rest of the panel's width empty rather than
                      spreading into more/narrower columns. Pinning an explicit
                      column-COUNT (4) forces the browser to actually use the
                      available width; column-width stays as a floor so it still
                      degrades gracefully (fewer columns) on a narrower window.
                      Mobile: single column. */}
                  <div style={{ columns: isMobile ? '1' : '260px 4', columnGap: 12, width: '100%' }}>
                    {BRAND_CATEGORIES.filter(c => brandGroups[c]?.length).map(cat => (
                      <div key={cat} style={{
                        breakInside: 'avoid', WebkitColumnBreakInside: 'avoid', marginBottom: 12,
                        display: 'flex', flexDirection: 'column', gap: 8,
                        background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 10, padding: '10px 12px',
                      }}>
                        <span style={{
                          fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: t.muted, whiteSpace: 'nowrap',
                        }}>{cat}</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: '10px 14px', width: '100%' }}>
                          {brandGroups[cat].map(renderBrandPill)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div style={{ ...glassPanel, borderRadius: 12, overflow: 'hidden' }}>
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
                            Brand / Product {SortIcon({ col: 'product' })}
                          </th>
                          <th onClick={() => handleSort('status')} style={{ padding: '10px 8px', textAlign: 'center', color: sortCol === 'status' ? t.accent : t.text, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', borderBottom: `2px solid ${t.border}`, position: 'sticky', top: 0, background: t.surface2, zIndex: 1, width: 82, cursor: 'pointer', userSelect: 'none' }}>
                            Status {SortIcon({ col: 'status' })}
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
                            }}>{label}{key && SortIcon({ col: key })}</th>
                          ))}
                          {visibleRetailers.map(r => (
                            <th key={r} style={{
                              padding: '10px 5px', textAlign: 'center', color: t.text,
                              fontWeight: 700, fontSize: 10.5, whiteSpace: 'nowrap',
                              borderBottom: `2px solid ${t.border}`,
                              position: 'sticky', top: 0, background: t.surface2, zIndex: 1,
                            }}><RetailerLogo name={r} h={32} maxW={84} dark={dark} fallbackStyle={{ fontSize: 10.5 }} /></th>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 14 : 20 }}>
              {/* ── Page header + vendor scope ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: t.text, letterSpacing: '-0.02em' }}>Mission Control</div>
                <div style={{ display: 'inline-flex', gap: 4, marginLeft: isMobile ? 0 : 'auto', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 99, padding: 3 }}>
                  {['ALL', 'Vcan', 'Moola'].map(v => {
                    const on = anaVendor === v
                    const clr = v === 'Vcan' ? t.vcanClr : v === 'Moola' ? t.moolaClr : t.accent
                    return (
                      <button key={v} onClick={() => setAnaVendor(v)} style={{ border: 'none', cursor: 'pointer', borderRadius: 99, padding: isMobile ? '7px 16px' : '6px 18px', minHeight: isMobile ? 38 : 'auto', fontSize: 12.5, fontWeight: 700, background: on ? clr : 'transparent', color: on ? (dark ? '#0d1117' : '#fff') : t.muted, boxShadow: on ? `0 0 14px -4px ${clr}` : 'none', transition: 'background .18s' }}>{v === 'ALL' ? 'All' : v}</button>
                    )
                  })}
                </div>
              </div>

              {/* ── Portfolio overview KPIs ── */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 12 }}>
                {[
                  { label: 'Active SKUs', val: intel.summary.totalActive, dec: 0, sub: 'currently on shelf', c: t.green },
                  { label: 'Active Brands', val: intel.summary.brandCount, dec: 0, sub: 'with ≥1 live SKU', c: t.blue },
                  { label: 'Avg Coverage', val: intel.summary.avgCoverage, dec: 1, sub: `of ${RETAILERS.length} retailers / brand`, c: t.accent },
                  { label: 'Pending Pipeline', val: intel.summary.totalPending, dec: 0, sub: 'awaiting listing', c: t.yellow },
                ].map(({ label, val, dec, sub, c }) => (
                  <div key={label} className="vc-rise vc-lift" style={{ ...glassPanel, borderTop: `3px solid ${c}`, borderRadius: 12, padding: isMobile ? '14px 16px' : '18px 20px',
                    boxShadow: `${glassPanel.boxShadow}, 0 0 22px -10px ${c}, inset 0 22px 44px -34px ${c}` }}>
                    <div style={{ fontSize: 11, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>{label}</div>
                    <div style={{ fontSize: isMobile ? 26 : 32, fontWeight: 800, color: c, lineHeight: 1, textShadow: dark ? `0 0 22px ${c}55` : 'none', fontVariantNumeric: 'tabular-nums' }}><CountUp v={val} dec={dec} /></div>
                    <div style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>{sub}</div>
                  </div>
                ))}
              </div>

              {/* ── Mission-control bento band: donut · channel share · coverage rings ── */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(12, minmax(0,1fr))', gap: 12 }}>
                {/* Portfolio Status donut */}
                <div className="vc-rise vc-lift" style={{ ...glassPanel, borderRadius: 14, padding: isMobile ? 16 : 20, gridColumn: isMobile ? 'auto' : 'span 4' }}>
                  {BentoHead({ title: 'Portfolio Status', desc: 'All SKUs by lifecycle state' })}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 16, flexWrap: 'wrap' }}>
                    <div style={{ width: 132, height: 132, borderRadius: '50%', flexShrink: 0, position: 'relative', display: 'grid', placeItems: 'center',
                      background: `conic-gradient(${t.green} 0deg ${intel.summary.aDeg}deg, ${t.yellow} ${intel.summary.aDeg}deg ${intel.summary.pDeg}deg, ${t.red} ${intel.summary.pDeg}deg 360deg)`,
                      boxShadow: dark ? `0 0 28px -8px ${t.accent}66` : '0 6px 18px -10px rgba(82,62,40,.4)' }}>
                      <div style={{ width: 90, height: 90, borderRadius: '50%', background: t.surface, border: `1px solid ${t.border}`, display: 'grid', placeContent: 'center', textAlign: 'center' }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: t.text, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}><CountUp v={intel.summary.total} /></div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: t.muted, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 3 }}>SKUs</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0, flex: 1 }}>
                      {[['Active', intel.summary.totalActive, t.green], ['Pending', intel.summary.totalPending, t.yellow], ['Discontinued', intel.summary.totalDiscon, t.red]].map(([lbl, n, c]) => (
                        <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, fontWeight: 600 }}>
                          <span style={{ width: 9, height: 9, borderRadius: 3, background: c, boxShadow: `0 0 7px -1px ${c}`, flexShrink: 0 }} />
                          <span style={{ color: t.text }}>{lbl}</span>
                          <span style={{ marginLeft: 'auto', fontWeight: 800, color: c, fontFamily: 'ui-monospace,monospace' }}>{n}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Channel Share bars */}
                <div className="vc-rise vc-lift" style={{ ...glassPanel, borderRadius: 14, padding: isMobile ? 16 : 20, gridColumn: isMobile ? 'auto' : 'span 8' }}>
                  {BentoHead({ title: 'Channel Share', desc: 'Active SKUs per retailer — share of total shelf presence' })}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
                    {intel.retailersByActive.slice(0, 8).map(r => (
                      <div key={r.name} style={{ display: 'grid', gridTemplateColumns: isMobile ? '52px 1fr 62px' : '60px 1fr 74px', alignItems: 'center', gap: 10 }}>
                        <RetailerLogo name={r.name} h={24} maxW={62} dark={dark} fallbackStyle={{ fontSize: 10.5, fontWeight: 700, color: t.text }} />
                        <div style={{ height: 9, borderRadius: 6, background: dark ? 'rgba(0,0,0,.45)' : 'rgba(38,32,25,.07)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.round(r.active / maxRetailerActive * 100)}%`, borderRadius: 6, background: `linear-gradient(90deg, ${t.accent}, ${t.blue})`, boxShadow: dark ? `0 0 9px -1px ${t.accent}` : 'none', transition: 'width .6s ease' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 800, color: t.text, fontFamily: 'ui-monospace,monospace', textAlign: 'right', whiteSpace: 'nowrap' }}>{r.active} <small style={{ color: t.muted, fontWeight: 600 }}>· {r.sharePct}%</small></span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coverage rings */}
                <div className="vc-rise vc-lift" style={{ ...glassPanel, borderRadius: 14, padding: isMobile ? 16 : 20, gridColumn: isMobile ? 'auto' : 'span 12' }}>
                  {BentoHead({ title: 'Coverage Leaders', desc: 'Brands in the most doors — distribution reach across the retailer network' })}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px,1fr))', gap: 14, marginTop: 16 }}>
                    {intel.brands.filter(b => b.active > 0).slice(0, 5).map(b => {
                      const pct = Math.round(b.coverage / RETAILERS.length * 100)
                      const clr = b.company === 'Vcan' ? t.vcanClr : t.moolaClr
                      return (
                        <div key={b.brand} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                          <div style={{ width: 46, height: 46, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', position: 'relative',
                            background: `conic-gradient(${t.accent} ${pct * 3.6}deg, ${dark ? 'rgba(255,255,255,.09)' : 'rgba(38,32,25,.1)'} 0deg)` }}>
                            <div style={{ position: 'absolute', inset: 5, borderRadius: '50%', background: t.surface, border: `1px solid ${t.border}` }} />
                            <span style={{ position: 'relative', fontSize: 10, fontWeight: 800, color: t.text, fontFamily: 'ui-monospace,monospace' }}>{b.coverage}/{RETAILERS.length}</span>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.brand}</div>
                            <div style={{ fontSize: 10.5, fontWeight: 600, fontFamily: 'ui-monospace,monospace' }}><span style={{ color: clr }}>{b.company}</span><span style={{ color: t.muted }}> · {b.active} active</span></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* ── Brand Portfolio bar chart ── */}
              <div style={{ ...glassPanel, borderRadius: 12, padding: isMobile ? 16 : 24 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Brand Portfolio</div>
                <div style={{ color: t.muted, fontSize: 12, marginBottom: 16 }}>Active SKUs per brand — bar color shows the vendor (Vcan / Moola).</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(() => {
                    const live = intel.brands.filter(b => b.active > 0).sort((a, b) => b.active - a.active)
                    const maxA = live[0]?.active || 1
                    return live.map(b => {
                      const clr = b.company === 'Vcan' ? t.vcanClr : t.moolaClr
                      return (
                        <div key={b.brand} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: isMobile ? 88 : 130, flexShrink: 0, display: 'flex', justifyContent: 'flex-end', overflow: 'hidden' }}><BrandPill brand={b.brand} company={b.company} t={t} size="s" /></div>
                          <div style={{ flex: 1, height: 14, background: dark ? 'rgba(0,0,0,.45)' : 'rgba(38,32,25,.07)', borderRadius: 99, overflow: 'visible' }}>
                            <div style={{ height: '100%', width: `${Math.max(4, Math.round(b.active / maxA * 100))}%`, borderRadius: 99, background: `linear-gradient(90deg, ${clr}, ${clr}88)`,
                              boxShadow: dark ? `0 0 6px ${clr}aa, 0 0 16px -2px ${clr}77` : `0 0 10px -2px ${clr}` }} />
                          </div>
                          <span style={{ width: 28, flexShrink: 0, fontSize: 12, fontWeight: 800, color: clr, fontFamily: 'ui-monospace,monospace', textAlign: 'right' }}>{b.active}</span>
                        </div>
                      )
                    })
                  })()}
                </div>
              </div>

              {/* ── Brand Distribution Matrix ── */}
              <div style={{ ...glassPanel, borderRadius: 12, padding: isMobile ? 16 : 24 }}>
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
                <div style={{ color: t.muted, fontSize: 12, marginBottom: 16 }}>Where each active brand is currently on shelf, by retailer — sorted by coverage. Click a dot to see which SKUs are listed.</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 740 }}>
                    <thead>
                      <tr style={{ borderBottom: `2px solid ${t.border}` }}>
                        <th style={{ padding: '9px 12px', textAlign: 'left', color: t.muted, fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, position: 'sticky', left: 0, background: t.surface, zIndex: 1 }}>Brand</th>
                        {RETAILERS.map(r => <th key={r} style={{ padding: '9px 4px', textAlign: 'center', color: t.muted, fontWeight: 700, fontSize: 9.5, whiteSpace: 'nowrap' }}><RetailerLogo name={r} h={28} maxW={70} dark={dark} fallbackStyle={{ fontSize: 9.5 }} /></th>)}
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
                              <td key={r} style={{ padding: '7px 4px', textAlign: 'center', cursor: n > 0 ? 'pointer' : 'default' }}
                                onClick={n > 0 ? (e) => {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  const prods = rawData.filter(p => p.brand === b.brand && p.status === 'ขาย' && p.retailers[r] === 'A')
                                  setMatrixPopover({ brand: b.brand, retailer: r, x: rect.left, y: rect.bottom + 6, products: prods })
                                } : undefined}
                              >
                                <span style={{ display: 'inline-block', width: n > 0 ? 13 : 6, height: n > 0 ? 13 : 6, borderRadius: '50%', background: n > 0 ? t.green : t.dim, boxShadow: n > 0 ? `0 0 7px 2px rgba(63,185,80,0.6)` : 'none', verticalAlign: 'middle' }} />
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
              <div style={{ ...glassPanel, borderRadius: 12, padding: isMobile ? 16 : 24 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Distribution Gaps</div>
                <div style={{ color: t.muted, fontSize: 12, marginBottom: 16 }}>
                  Live brands (≥2 active SKUs) not yet in every core door — measured against {intel.coreRetailers.map(r => RETAILER_SHORT[r]).join(' · ')}
                </div>
                {intel.gaps.length === 0 ? (
                  <div style={{ color: t.muted, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>✓ All live brands are present across every core retailer</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
                    {intel.gaps.map(g => (
                      <div key={g.brand} style={{ padding: '14px 16px', borderRadius: 12,
                        background: dark ? 'rgba(255,255,255,.035)' : 'rgba(255,255,255,.5)',
                        border: `1px solid ${t.border}`, boxShadow: `inset 0 18px 36px -30px ${t.red}99` }}>
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
                              <span key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: inStore ? `${t.green}1e` : `${t.red}0d`, color: inStore ? t.green : t.muted, border: `1px solid ${inStore ? t.green + '44' : t.red + '33'}`, opacity: inStore ? 1 : 0.9 }}>
                                <span>{inStore ? '✓' : '+'}</span><RetailerLogo name={r} h={24} maxW={62} dark={dark} fallbackStyle={{ fontSize: 10.5 }} />
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Promo Activity Heatmap ── */}
              {(() => {
                const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
                const ACT_CLR = { field: '#f97316', media: '#22d3ee', looks: '#f061ff', clearance: '#f43f5e' }
                // heat[retailer][monthIdx] = Set of activity types
                const heat = {}
                Object.entries(PROMO_META).forEach(([retailer, meta]) => {
                  meta.periods.forEach(p => {
                    const mm = p.dateRange?.match(/^\d{1,2}\/(\d{1,2})/)
                    if (!mm) return
                    const mo = parseInt(mm[1]) - 1
                    if (mo < 0 || mo > 11) return
                    promoData.filter(it => it.retailer === retailer).forEach(it => {
                      const pd = it.periods?.[p.name]
                      if (!pd?.activities?.length) return
                      if (!heat[retailer]) heat[retailer] = {}
                      if (!heat[retailer][mo]) heat[retailer][mo] = new Set()
                      pd.activities.forEach(a => heat[retailer][mo].add(a))
                    })
                  })
                })
                const retailers = Object.keys(heat)
                if (!retailers.length) return null
                return (
                  <div style={{ ...glassPanel, borderRadius: 12, padding: isMobile ? 16 : 24 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Promo Activity Calendar</div>
                    <div style={{ color: t.muted, fontSize: 12, marginBottom: 16 }}>Which retailers have field / media / looks activity — by month.</div>
                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                      <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: 520 }}>
                        <thead>
                          <tr>
                            <th style={{ width: 72, textAlign: 'left', padding: '2px 8px 6px 0', color: t.muted, fontWeight: 700 }}>Retailer</th>
                            {MONTHS.map(m => <th key={m} style={{ width: 44, textAlign: 'center', padding: '2px 2px 6px', color: t.muted, fontWeight: 600 }}>{m}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {retailers.sort().map(r => (
                            <tr key={r}>
                              <td style={{ padding: '4px 8px 4px 0', fontWeight: 700, color: t.text, whiteSpace: 'nowrap' }}>{r}</td>
                              {MONTHS.map((_, mi) => {
                                const acts = heat[r]?.[mi] ? [...heat[r][mi]] : []
                                return (
                                  <td key={mi} style={{ padding: 2, textAlign: 'center' }}>
                                    {acts.length > 0
                                      ? <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                                          {acts.map(a => <span key={a} title={a} style={{ display: 'block', width: 8, height: 8, borderRadius: 99, background: ACT_CLR[a] || t.muted, boxShadow: `0 0 4px ${ACT_CLR[a] || t.muted}` }} />)}
                                        </div>
                                      : <span style={{ display: 'block', width: 8, height: 8, borderRadius: 2, background: t.border, margin: 'auto' }} />
                                    }
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
                      {Object.entries(ACT_CLR).map(([a, c]) => (
                        <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: t.muted }}>
                          <span style={{ display: 'block', width: 8, height: 8, borderRadius: 99, background: c, boxShadow: `0 0 4px ${c}` }} />{a}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* ── Retailer Scorecard ── */}
              <div style={{ ...glassPanel, borderRadius: 12, padding: isMobile ? 16 : 24 }}>
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
                                <RetailerLogo name={r.name} h={36} maxW={92} dark={dark} fallbackStyle={{ fontWeight: 700, color: t.text }} />
                                {isCore && <span style={{ fontSize: 9, fontWeight: 700, color: t.accent, border: `1px solid ${t.accent}66`, borderRadius: 4, padding: '1px 5px' }}>CORE</span>}
                              </span>
                            </td>
                            <td style={{ padding: '9px 10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, minWidth: 60, height: 8, background: dark ? 'rgba(0,0,0,.45)' : 'rgba(38,32,25,.07)', borderRadius: 99, overflow: 'visible' }}>
                                  <div style={{ height: '100%', width: `${Math.round(r.active / maxRetailerActive * 100)}%`, background: 'linear-gradient(90deg,#58a6ff,#7c3aed)', borderRadius: 99,
                                    boxShadow: dark ? '0 0 6px #7c3aedaa, 0 0 14px -2px #58a6ff88' : '0 0 8px -1px #7c3aed' }} />
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
              {/* Sticky filter panel — search + customer + brand + legend stay pinned on scroll */}
              <div style={{ position: 'sticky', top: 0, zIndex: 20, background: t.bg, marginLeft: isMobile ? -12 : -24, marginRight: isMobile ? -12 : -24, marginTop: isMobile ? -16 : -24, paddingLeft: isMobile ? 12 : 24, paddingRight: isMobile ? 12 : 24, paddingTop: isMobile ? 16 : 24, paddingBottom: 6, boxShadow: `0 6px 12px -6px ${dark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.12)'}` }}>
              {/* ── Search bar ── */}
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: t.muted, fontSize: 15, pointerEvents: 'none' }}>⌕</span>
                <input value={psSearch} onChange={e => setPsSearch(e.target.value)} placeholder="ค้นหา product, brand, barcode..." style={{ width: '100%', background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, padding: '9px 36px 9px 38px', fontSize: 13, outline: 'none', boxShadow: dark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)' }} />
                {psSearch && <button onClick={() => setPsSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>}
              </div>
              {/* ── Customer (retailer) pills — logos (above brand) ── */}
              <div className="rp-row" style={{ display: 'flex', gap: 9, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: t.muted, fontWeight: 600, flexShrink: 0 }}>Customer:</span>
                <button onClick={() => setPsRetailers([])} style={{ background: psRetailers.length === 0 ? t.accent : t.surface2, color: psRetailers.length === 0 ? '#000' : t.text, border: `1.5px solid ${psRetailers.length === 0 ? t.accent : t.border}`, borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>All</button>
                {RETAILERS.map(r => {
                  const sel = psRetailers.includes(r)
                  return (
                    <button key={r} onClick={() => togglePsRetailer(r)} title={r}
                      className={`rp-btn${sel ? ' rp-sel' : ''}`}
                      style={{
                        '--g': t.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: 'transparent', border: 'none', borderRadius: 8, padding: 2, cursor: 'pointer',
                        minHeight: isMobile ? 40 : 'unset',
                      }}>
                      <RetailerLogo name={r} h={isMobile ? 30 : 26} maxW={isMobile ? 76 : 66} dark={dark} fallbackStyle={{ fontSize: 11, fontWeight: 700, color: t.text }} />
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
                {VENDOR_BRANDS.ALL.map(b => (
                  <BrandPill key={b} brand={b} company={brandCompany[b]} t={t} size="m"
                    selected={selectedBrands.includes(b)} count={brandCounts[b] || 0}
                    onClick={() => toggleBrand(b)} />
                ))}
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
              </div>{/* end sticky filter panel */}
              {/* ── Grid ── */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? '130px' : '160px'}, 1fr))`, gap: isMobile ? 10 : 12 }}>
                {psFiltered.map((p, i) => (
                  <div key={p.barcode + i} onClick={() => setSelectedProduct(p)} style={{ ...glassPanel, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.18s, box-shadow 0.18s' }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)'; e.currentTarget.style.boxShadow = `0 16px 40px rgba(0,0,0,0.28), 0 0 0 2px ${t.accent}66` }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = glassPanel.boxShadow }}
                  >
                    <PackshotImg barcode={p.barcode} side="front" style={{ width: '100%', height: 150, background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }} placeholderSize={40} />
                    <div style={{ padding: '10px 12px' }}>
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
            <PromoSection
              rawData={rawData}
              retailerData={retailerData}
              t={t}
              dark={dark}
              isMobile={isMobile}
              onSelect={setSelectedProduct}
              RetailerLogo={RetailerLogo}
              MonogramTile={BrandPlaque}
            />
          )}

         </div>{/* end vc-fade page wrapper */}
        </main>
      </div>

      {/* ── COMPENSATE CALCULATOR POPUP ── */}
      {calcOpen && (() => {
        const calcProducts = promoRetailer ? enrichedPromoData.filter(p => p.retailer === promoRetailer) : []
        const sel = calcProducts.find(p => p.barcode === calcProductBc) || null
        const rsp = sel?.rspIncVat ?? null
        const gp = sel?.gp ?? null
        const promo = parseFloat(calcPromo)
        const needsPrice = calcType !== 'b2g1'
        // Use the product's own VAT ratio (incVat/exVat ≈ 1.07 for VAT items, 1.0 for
        // non-VAT pet food) so non-VAT products don't get a 7% stripped that isn't there.
        const vatDiv = sel?.rspExVat ? (sel.rspIncVat / sel.rspExVat) : 1.07
        const costAt = (price) => (price / vatDiv) * (1 - gp)
        // Compute compensate per unit + the breakdown rows for the current type/basis
        const compute = () => {
          if (rsp == null) return { error: 'Select a product first' }
          if (calcMode === 'keepgp' && gp == null) return { error: 'This product has no GP — use Full Compensate instead' }
          if (needsPrice && isNaN(promo)) return { error: 'Enter the promotion price to see the result' }
          // effective per-unit promo price
          const eff = calcType === '2for' ? promo / 2 : promo  // (b2g1 ignores this)
          let comp, rows
          if (calcType === 'b2g1') {
            // 1 free unit is the compensate: keep-GP = its cost, full = its RSP
            comp = calcMode === 'keepgp' ? costAt(rsp) : rsp
            rows = calcMode === 'keepgp'
              ? [{ label: 'Cost @ RSP', value: `฿${costAt(rsp).toFixed(2)}` }, { label: 'Free units', value: '1 of 3' }]
              : [{ label: 'RSP', value: `฿${rsp.toFixed(2)}` }, { label: 'Free units', value: '1 of 3' }]
          } else if (calcMode === 'keepgp') {
            comp = costAt(rsp) - costAt(eff)
            rows = [
              { label: 'Cost @ RSP', value: `฿${costAt(rsp).toFixed(2)}` },
              { label: calcType === '2for' ? `Cost @ ฿${eff.toFixed(2)}/u` : 'Cost @ Promo', value: `฿${costAt(eff).toFixed(2)}` },
            ]
          } else {
            comp = rsp - eff
            rows = [
              { label: 'RSP', value: `฿${rsp.toFixed(2)}` },
              { label: calcType === '2for' ? 'Unit price (÷2)' : 'Promo price', value: `฿${eff.toFixed(2)}` },
            ]
          }
          return { comp, rows }
        }
        const res = compute()
        const copyResult = () => {
          if (res.comp == null) return
          navigator.clipboard?.writeText(`฿${res.comp.toFixed(2)}`).then(() => {
            setCalcCopied(true); setTimeout(() => setCalcCopied(false), 1500)
          }).catch(() => {})
        }
        const TYPES = [{ k: 'single', label: 'Single' }, { k: '2for', label: '2 for X' }, { k: 'b2g1', label: 'B2G1' }]
        return (
        <div onClick={() => setCalcOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 20, backdropFilter: 'blur(2px)' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: dark ? 'rgba(22,27,34,.85)' : 'rgba(251,248,243,.88)', backdropFilter: 'blur(22px) saturate(1.4)', WebkitBackdropFilter: 'blur(22px) saturate(1.4)', border: `1px solid ${dark ? t.border : 'rgba(255,255,255,.65)'}`, borderRadius: isMobile ? '16px 16px 0 0' : 14, width: isMobile ? '100%' : 470, maxWidth: '100%', maxHeight: isMobile ? '92dvh' : 'unset', overflowY: 'auto', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${t.border}` }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: t.text, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg className="neon-ico" style={{ color: t.accent, flexShrink: 0 }} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M8 6h8"/><path d="M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01"/>
                  </svg>Compensate Calculator</div>
                <div style={{ fontSize: 11, color: t.muted, marginTop: 2 }}>{promoRetailer ? `Pick a ${promoRetailer} product → enter promo price` : 'Select a customer first'}</div>
              </div>
              <button onClick={() => setCalcOpen(false)} style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: t.muted, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
            </div>
            {!promoRetailer ? (
              <div style={{ padding: '32px 20px', textAlign: 'center', color: t.muted, fontSize: 13 }}>Select a customer on the Promotion Plan page first,<br />then reopen the calculator.</div>
            ) : !promoUnlocked ? (
              // The calculator exposes cost/GP, so it sits behind the same PIN as Cost/GP.
              <div style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 30 }}>🔒</div>
                <div style={{ fontSize: 13, color: t.muted, fontWeight: 600, textAlign: 'center' }}>The calculator uses Cost &amp; GP data.<br />Enter your department PIN to use it.</div>
                <form onSubmit={e => {
                  e.preventDefault()
                  const dept = DEPT_PINS[promoPwInput]
                  if (dept) { setPromoUnlocked(true); setPromoUnlockedDept(dept); sessionStorage.setItem('pu', '1'); sessionStorage.setItem('puDept', dept); logPricingAccess(dept, 'Compensate Calculator'); setPromoPwInput('') }
                  else { setPromoPwError(true); setPromoPwInput('') }
                }} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="password" inputMode="numeric" maxLength={10} value={promoPwInput} onChange={e => { setPromoPwInput(e.target.value); setPromoPwError(false) }} placeholder="PIN" autoFocus={!isMobile}
                    style={{ width: isMobile ? 120 : 100, background: t.surface2, border: `1.5px solid ${promoPwError ? '#f85149' : t.border}`, borderRadius: 8, color: t.text, padding: isMobile ? '10px 14px' : '8px 12px', fontSize: isMobile ? 18 : 14, textAlign: 'center', outline: 'none', letterSpacing: 4 }} />
                  <button type="submit" style={{ background: t.accent, border: 'none', borderRadius: 8, color: '#000', fontWeight: 700, fontSize: 13, padding: isMobile ? '10px 20px' : '8px 16px', cursor: 'pointer', minHeight: isMobile ? 44 : 'unset' }}>Unlock</button>
                </form>
                {promoPwError && <div style={{ fontSize: 11, color: '#f85149', fontWeight: 600 }}>Incorrect PIN</div>}
              </div>
            ) : (
            <>
            {/* Promo type + basis toggles */}
            <div style={{ padding: '14px 20px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {TYPES.map(({ k, label }) => (
                  <button key={k} onClick={() => setCalcType(k)} style={{ flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: calcType === k ? t.accent : t.surface2, color: calcType === k ? '#000' : t.muted, border: `1.5px solid ${calcType === k ? t.accent : t.border}` }}>{label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[{ k: 'keepgp', label: 'Keep GP' }, { k: 'full', label: 'Full Compensate' }].map(({ k, label }) => (
                  <button key={k} onClick={() => setCalcMode(k)} style={{ flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: calcMode === k ? `${t.accent}22` : 'transparent', color: calcMode === k ? t.accent : t.muted, border: `1.5px solid ${calcMode === k ? t.accent : t.border}` }}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ padding: '8px 20px 4px', fontSize: 11, color: t.muted, fontStyle: 'italic' }}>
              {calcType === 'b2g1'
                ? (calcMode === 'keepgp' ? 'Buy 2 Get 1 · Compensate = Cost of 1 free unit' : 'Buy 2 Get 1 · Compensate = RSP of 1 free unit')
                : calcType === '2for'
                ? (calcMode === 'keepgp' ? 'Unit = price÷2 · Compensate = Cost(RSP) − Cost(unit)' : 'Unit = price÷2 · Compensate = RSP − unit')
                : (calcMode === 'keepgp' ? 'Cost = (price÷1.07)×(1−GP) · Compensate = Cost(RSP) − Cost(promo)' : 'Compensate = RSP − Promo price')}
            </div>
            <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Product dropdown */}
              <div>
                <div style={{ fontSize: 10, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Product (RSP/GP from store data)</div>
                <select value={calcProductBc} onChange={e => setCalcProductBc(e.target.value)}
                  style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">— select a product —</option>
                  {calcProducts.map(p => <option key={p.barcode} value={p.barcode}>{p.product} ({p.barcode})</option>)}
                </select>
              </div>
              {/* RSP + GP readouts + promo input */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${1 + (calcMode === 'keepgp' ? 1 : 0) + (needsPrice ? 1 : 0)}, 1fr)`, gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>RSP (fixed)</div>
                  <div style={{ padding: '10px 12px', borderRadius: 8, background: t.surface2, border: `1px solid ${t.border}`, fontSize: 15, fontWeight: 700, color: rsp != null ? t.text : t.dim }}>{rsp != null ? `฿${rsp}` : '—'}</div>
                </div>
                {calcMode === 'keepgp' && (
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>GP (fixed)</div>
                    <div style={{ padding: '10px 12px', borderRadius: 8, background: t.surface2, border: `1px solid ${t.border}`, fontSize: 15, fontWeight: 700, color: gp != null ? t.text : t.dim }}>{gp != null ? `${Math.round(gp * 100)}%` : '—'}</div>
                  </div>
                )}
                {needsPrice && (
                  <div>
                    <div style={{ fontSize: 10, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{calcType === '2for' ? '2-for Price ฿' : 'Promo Price ฿'}</div>
                    <input type="number" inputMode="decimal" value={calcPromo} onChange={e => setCalcPromo(e.target.value)} placeholder={calcType === '2for' ? '100' : '335'}
                      style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, padding: '10px 12px', fontSize: 15, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                )}
              </div>
              {/* Result */}
              {res.error ? (
                <div style={{ fontSize: 12, color: t.dim, fontStyle: 'italic', padding: '6px 0' }}>{res.error}</div>
              ) : (
                <div style={{ padding: '14px 18px', borderRadius: 10, background: res.comp < 0 ? `${t.red}14` : `${t.green}14`, border: `1px solid ${res.comp < 0 ? t.red + '44' : t.green + '44'}`, display: 'grid', gridTemplateColumns: `repeat(${res.rows.length + 1}, 1fr)`, gap: 12, alignItems: 'end' }}>
                  {res.rows.map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 9.5, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: t.muted }}>{value}</div>
                    </div>
                  ))}
                  <div>
                    <div style={{ fontSize: 9.5, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>Compensate / unit</div>
                    <div style={{ fontSize: 21, fontWeight: 800, color: res.comp < 0 ? t.red : t.green }}>฿{res.comp.toFixed(2)}</div>
                  </div>
                </div>
              )}
            </div>
            {/* Footer: copy + clear */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, padding: '0 20px 18px' }}>
              {res.comp != null && (
                <button onClick={copyResult} style={{ background: calcCopied ? t.green : t.accent, border: 'none', borderRadius: 8, color: '#000', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '8px 18px', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {calcCopied ? '✓ Copied' : '⧉ Copy ฿' + res.comp.toFixed(2)}
                </button>
              )}
              <button onClick={clearCalc} className="clr-btn" style={{ background: 'none', border: `1.5px solid ${t.border}`, borderRadius: 8, color: t.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '8px 18px' }}>✕ Clear</button>
            </div>
            </>
            )}
          </div>
        </div>
        )
      })()}

      {/* ── PERIOD ACTIVITY POPOVER (click a period header) ── */}
      {periodPopover && (
        <div onClick={() => setPeriodPopover(null)} style={{ position: 'fixed', inset: 0, zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed',
            left: Math.min(periodPopover.x, window.innerWidth - 290),
            top: Math.min(periodPopover.y, window.innerHeight - 280),
            background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12,
            minWidth: 230, maxWidth: 290, maxHeight: 280, overflowY: 'auto',
            boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.55)' : '0 8px 32px rgba(0,0,0,0.18)', zIndex: 2001,
          }}>
            <div style={{ padding: '11px 16px 9px', borderBottom: `1px solid ${t.border}`, position: 'sticky', top: 0, background: t.surface }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: t.text }}>{periodPopover.period}</div>
              {periodPopover.dateRange && <div style={{ fontSize: 10.5, color: t.muted, marginTop: 2 }}>{periodPopover.dateRange}</div>}
            </div>
            {periodPopover.brands.map(({ brand, activities }) => (
              <div key={brand} style={{ padding: '8px 16px', borderBottom: `1px solid ${t.dim}`, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.text, minWidth: 78 }}>{brand}</span>
                {activities.map(a => { const ac = PROMO_ACTIVITY_DISPLAY[a]; return ac ? (
                  <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, color: ac.color, background: `${ac.color}1e`, border: `1px solid ${ac.color}55`, borderRadius: 6, padding: '2px 8px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: ac.color }} />{ac.label}
                  </span>
                ) : null })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MATRIX POPOVER ── */}
      {matrixPopover && (
        <div onClick={() => setMatrixPopover(null)} style={{ position: 'fixed', inset: 0, zIndex: 2000 }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed',
            left: Math.min(matrixPopover.x, window.innerWidth - 310),
            top: Math.min(matrixPopover.y, window.innerHeight - 300),
            background: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: 12,
            minWidth: 240,
            maxWidth: 310,
            maxHeight: 300,
            overflowY: 'auto',
            boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.55)' : '0 8px 32px rgba(0,0,0,0.18)',
            zIndex: 2001,
          }}>
            <div style={{ padding: '12px 16px 10px', borderBottom: `1px solid ${t.border}`, position: 'sticky', top: 0, background: t.surface, zIndex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: t.text }}>{matrixPopover.brand}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: t.muted, marginTop: 3 }}>
                <RetailerLogo name={matrixPopover.retailer} h={22} maxW={58} dark={dark} fallbackStyle={{ fontSize: 11 }} />
                <span>· {matrixPopover.products.length} active SKU{matrixPopover.products.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
            {matrixPopover.products.map(p => (
              <div key={p.barcode} className="rhover" onClick={() => { setSelectedProduct(p); setMatrixPopover(null) }}
                style={{ padding: '9px 16px', cursor: 'pointer', borderBottom: `1px solid ${t.dim}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: t.text, lineHeight: 1.35 }}>{p.product}</div>
                <div style={{ fontSize: 10, color: t.muted, marginTop: 3, lineHeight: 1.7 }}>
                  <span style={{ fontFamily: 'monospace' }}>Barcode: {p.barcode}</span>
                  {p.packSize && <><br /><span>Pack Size: {p.packSize}</span></>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PRODUCT POPUP ── */}
      {selectedProduct && (
        <ProductPopup
          key={selectedProduct.barcode}
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          t={t}
          dark={dark}
          isMobile={isMobile}
          pricing={retailerData[selectedProduct.barcode] || {}}
          variant={tab === 'packshot' ? 'packshot' : 'products'}
          promoItems={promoData}
          promoMeta={PROMO_META}
        />
      )}
    </div>
  )
}
