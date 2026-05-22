import { useState, useMemo, useEffect } from 'react'
import fallbackData from './data.js'
import vcanLogo from './vcan-logo.png'

const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQtX4UZ3RyNrtCyyMv9ToJZAI0oiKxl02COO0C0ozo-1c-03EXiyeVaTJpZHqjdWLflM7ZEBDTsZjpx/pub?gid=1166843080&single=true&output=csv"

const RETAILERS = ['Tops', 'Villa', 'The Mall', 'Lotus', 'Homepro', 'Big C', 'TWD', 'Boots', 'Foodland', 'Central Department', "Pet'n me", 'Fuji']
const RETAILER_SHORT = {
  'Tops': 'TOPS', 'Villa': 'VILLA', 'The Mall': 'THE MALL', 'Lotus': 'LOTUS',
  'Homepro': 'HOMEPRO', 'Big C': 'BIG C', 'TWD': 'TWD', 'Boots': 'BOOTS',
  'Foodland': 'FOODLAND', 'Central Department': 'CENTRAL', "Pet'n me": "PET'N ME", 'Fuji': 'FUJI'
}

// Proper CSV parser that handles quoted fields (commas inside quotes)
function parseCSVLine(line) {
  const result = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

// Parse CSV text → array of product objects
function parseCSV(text) {
  const lines = text.split('\n').map(l => l.replace(/\r/g, ''))
  const rows = []
  let currentCompany = ''
  let currentBrand = ''

  const VENDORS = ['Vcan', 'Moola']
  const stripQuotes = (s) => (s || '').replace(/^["']+|["']+$/g, '').trim()
  const isBarcode = (s) => /^\d{8,}$/.test(stripQuotes(s))
  const normalizeBrand = (b) => {
    b = b.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
    if (/dove.?men/i.test(b) || /^shampoo$/i.test(b)) return 'Dove Men'
    return b
  }

  for (let i = 0; i < lines.length; i++) {
    if (i < 3) continue
    const row = parseCSVLine(lines[i])
    if (!row.some(c => c.trim())) continue

    const c0 = stripQuotes(row[0])
    const c1 = stripQuotes(row[1])
    const c2 = stripQuotes(row[2])
    const c3 = stripQuotes(row[3])

    // Update company only if col0 is a known vendor
    if (VENDORS.includes(c0)) currentCompany = c0

    // Detect which layout this row uses:
    // Layout A (normal): col0=vendor/empty, col1=brand/empty, col2=barcode, col3=barcode, col4=product
    // Layout B (shifted): col0=brand-part, col1=barcode, col2=barcode, col3=product
    let barcode = '', product = '', packSize = '', rsp = '', status = ''
    let retailerOffset = 8

    if (isBarcode(c2)) {
      // Layout A — normal
      if (c1 && !isBarcode(c1)) currentBrand = normalizeBrand(c1)
      barcode = c2
      product = row[4]?.trim() || ''
      packSize = row[5]?.trim() || ''
      rsp = row[6]?.replace(/[^\d.]/g, '') || ''
      status = row[7]?.trim() || ''
      retailerOffset = 8
    } else if (isBarcode(c1) && isBarcode(c2)) {
      // Layout B — shifted (e.g. Dove Men Shampoo rows)
      if (c0 && !VENDORS.includes(c0)) currentBrand = normalizeBrand(c0)
      barcode = c1
      product = row[3]?.trim() || ''
      packSize = row[4]?.trim() || ''
      rsp = row[5]?.replace(/[^\d.]/g, '') || ''
      status = row[6]?.trim() || ''
      retailerOffset = 7
    } else if (!c0 && !c1 && isBarcode(c2)) {
      // Layout C — continuation row (col0 and col1 empty, brand same as previous)
      barcode = c2
      product = row[4]?.trim() || ''
      packSize = row[5]?.trim() || ''
      rsp = row[6]?.replace(/[^\d.]/g, '') || ''
      status = row[7]?.trim() || ''
      retailerOffset = 8
    } else { //V2
      continue
    }

    if (!barcode || !product || product.toLowerCase().includes('total')) continue
    if (!isBarcode(barcode)) continue

    const retailerStatus = {}
    RETAILERS.forEach((r, j) => {
      retailerStatus[r] = row[retailerOffset + j]?.trim() || ''
    })

    rows.push({
      company: currentCompany,
      brand: currentBrand,
      barcode,
      product,
      packSize,
      rsp: rsp ? parseFloat(rsp) : 0,
      status,
      retailers: retailerStatus,
    })
  }
  return rows
}

export default function App() {
  const [rawData, setRawData] = useState(fallbackData)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [dataSource, setDataSource] = useState('local')

  const [dark, setDark] = useState(true)
  const [tab, setTab] = useState('products')
  const [vendorFilter, setVendorFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [selectedBrands, setSelectedBrands] = useState([])
  const [statusTab, setStatusTab] = useState('ALL')

  useEffect(() => {
    const fetchSheets = async () => {
      try {
        setLoading(true)
        const res = await fetch(SHEET_URL)
        if (!res.ok) throw new Error('Failed to fetch')
        const lastMod = res.headers.get('Last-Modified') || res.headers.get('Date')
        const text = await res.text()
        const parsed = parseCSV(text)
        if (parsed.length > 0) {
          setRawData(parsed)
          setDataSource('sheets')
          if (lastMod) {
            setLastUpdated(new Date(lastMod).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }))
          } else {
            setLastUpdated(new Date().toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }))
          }
        }
      } catch (e) {
        console.warn('Sheets fetch failed:', e)
        setDataSource('local')
        setLastUpdated(new Date().toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }))
      } finally {
        setLoading(false)
      }
    }
    fetchSheets()
  }, [])

  const handleImportCSV = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = parseCSV(ev.target.result)
        if (parsed.length > 0) {
          setRawData(parsed)
          setDataSource('csv')
          setSelectedBrands([])
          setVendorFilter('ALL')
          setStatusTab('ALL')
          setSearch('')
          setLastUpdated(new Date(file.lastModified).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }))
          alert('✅ Import สำเร็จ! พบ ' + parsed.length + ' รายการจาก "' + file.name + '"')
        } else {
          alert('❌ ไม่พบข้อมูลในไฟล์ กรุณาตรวจสอบ format ของ CSV')
        }
      } catch (err) {
        alert('❌ เกิดข้อผิดพลาดในการอ่านไฟล์')
      }
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
    bg: '#1a1a1a', surface: '#232323', surface2: '#2c2c2c', border: '#3a3a3a',
    text: '#f0f0f0', muted: '#888', dim: '#444', accent: '#f0c040',
    green: '#3ecf6e', yellow: '#f5c842', red: '#f25757', blue: '#4f8ef7',
    rowHover: '#2a2a2a', headerBg: '#111',
  } : {
    bg: '#eceef1', surface: '#f5f6f8', surface2: '#e4e6ea', border: '#d0d3d8',
    text: '#1a1a1a', muted: '#666', dim: '#bbb', accent: '#c8960a',
    green: '#1a9e4a', yellow: '#c8960a', red: '#d93636', blue: '#2563eb',
    rowHover: '#dfe1e5', headerBg: '#f0f1f3',
  }

  const visibleBrands = VENDOR_BRANDS[vendorFilter] || VENDOR_BRANDS.ALL
  const handleVendorChange = (v) => { setVendorFilter(v); setSelectedBrands([]) }
  const toggleBrand = (b) => setSelectedBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])
  const clearAll = () => { setSearch(''); setSelectedBrands([]); setStatusTab('ALL'); setVendorFilter('ALL') }
  const hasActiveFilters = search || selectedBrands.length > 0 || statusTab !== 'ALL' || vendorFilter !== 'ALL'

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
    if (search) {
      const q = search.toLowerCase()
      if (!p.product.toLowerCase().includes(q) && !p.brand.toLowerCase().includes(q) && !p.barcode.includes(q)) return false
    }
    return true
  }), [rawData, vendorFilter, selectedBrands, statusTab, search])

  const analyticsData = useMemo(() => {
    const brandMap = {}
    rawData.forEach(p => {
      const b = p.brand.trim()
      if (!brandMap[b]) brandMap[b] = { brand: b, company: p.company, total: 0, active: 0, activeRetailers: {} }
      brandMap[b].total++
      if (p.status === 'ขาย') brandMap[b].active++
      RETAILERS.forEach(r => {
        if (!brandMap[b].activeRetailers[r]) brandMap[b].activeRetailers[r] = 0
        if (p.retailers[r] === 'A') brandMap[b].activeRetailers[r]++
      })
    })
    const brands = Object.values(brandMap).sort((a, b) => b.active - a.active)
    const retailerMap = RETAILERS.map(r => ({
      name: r,
      count: rawData.filter(p => p.retailers[r] === 'A').length,
      pending: rawData.filter(p => p.retailers[r] === 'รอขาย' || p.retailers[r] === 'On Process').length,
    })).sort((a, b) => b.count - a.count)
    return { brands, retailerMap }
  }, [rawData])

  const maxRetailer = Math.max(...analyticsData.retailerMap.map(r => r.count), 1)
  const maxBrandActive = analyticsData.brands[0]?.active || 1

  function StatCard({ icon, label, value, color }) {
    return (
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: '24px 28px', flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
        <div style={{ fontSize: 11, color: t.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 42, fontWeight: 800, color: color || t.text, lineHeight: 1 }}>{value}</div>
      </div>
    )
  }

  function RetailerDot({ value }) {
    if (value === 'A') return <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.green, margin: 'auto', boxShadow: `0 0 6px ${t.green}` }} />
    if (value === 'รอขาย' || value === 'On Process') return <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.yellow, margin: 'auto' }} />
    if (value === 'ยกเลิกขาย') return <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.red, margin: 'auto' }} />
    return <div style={{ width: 6, height: 1, background: t.dim, margin: 'auto' }} />
  }

  // Loading screen
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#1a1a1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <img src={vcanLogo} alt="VCAN" style={{ height: 60, opacity: 0.8 }} />
      <div style={{ color: '#888', fontSize: 14 }}>กำลังดึงข้อมูลจาก Google Sheets...</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%', background: '#f0c040',
            animation: `bounce 1s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>
      <style>{`@keyframes bounce { 0%,100%{opacity:0.2;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, fontSize: 14 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter','DM Sans',sans-serif; }
        input, select, button { font-family: inherit; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 3px; }
        .rhover:hover { background: ${t.rowHover} !important; }
        .bpill { transition: all 0.15s; cursor: pointer; }
        .bpill:hover { background: ${t.accent} !important; color: #000 !important; border-color: ${t.accent} !important; transform: translateY(-1px); }
        .nav-btn { transition: all 0.15s; cursor: pointer; }
        .nav-btn:hover { opacity: 0.85; }
      `}</style>

      {/* HEADER */}
      <header style={{
        background: t.headerBg, borderBottom: `1px solid ${t.border}`,
        padding: '0 32px', height: 64, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 200,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 240 }}>
          <img src={vcanLogo} alt="VCAN" style={{ height: 38, objectFit: 'contain' }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, letterSpacing: 1, textTransform: 'uppercase' }}>Product Master <span style={{ fontSize: 11, color: t.accent, fontWeight: 700, letterSpacing: 0 }}>v1.0</span></div>
            <div style={{ fontSize: 11, color: t.muted, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>⏱ UPDATED: {lastUpdated}</span>
              <span style={{
                fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 600,
                background: dataSource === 'sheets' ? 'rgba(62,207,110,0.15)' : dataSource === 'csv' ? 'rgba(79,142,247,0.15)' : 'rgba(245,200,66,0.15)',
                color: dataSource === 'sheets' ? t.green : dataSource === 'csv' ? t.blue : t.yellow,
                border: `1px solid ${dataSource === 'sheets' ? 'rgba(62,207,110,0.3)' : dataSource === 'csv' ? 'rgba(79,142,247,0.3)' : 'rgba(245,200,66,0.3)'}`,
              }}>
                {dataSource === 'sheets' ? '🟢 Live' : dataSource === 'csv' ? '🔵 CSV' : '🟡 Local'}
              </span>
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex', gap: 0, background: t.surface2, borderRadius: 12, padding: 5,
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
        }}>
          {[['products', '📋 Products'], ['analytics', '📊 Analytics'], ['packshot', '🖼 Packshot']].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className="nav-btn" style={{
              background: tab === key ? (dark ? '#ffffff' : '#1a1a1a') : 'transparent',
              color: tab === key ? (dark ? '#000' : '#fff') : t.muted,
              border: 'none', borderRadius: 8, padding: '9px 24px',
              fontWeight: 700, fontSize: 14,
            }}>{label}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', minWidth: 240, justifyContent: 'flex-end' }}>
          <button onClick={() => setDark(d => !d)} className="nav-btn" style={{
            background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8,
            padding: '8px 14px', color: t.text, fontSize: 13, fontWeight: 500,
          }}>{dark ? '☀️ Light' : '🌙 Dark'}</button>
          <label className="nav-btn" style={{
            background: t.blue, border: 'none', borderRadius: 8,
            padding: '8px 18px', color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            ⬆ Import CSV
            <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
          </label>
        </div>
      </header>

      <main style={{ padding: '28px 32px', maxWidth: 1700, margin: '0 auto' }}>

        {/* PACKSHOT */}
        {tab === 'packshot' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 24 }}>
            <div style={{ background: t.surface, border: `2px dashed ${t.border}`, borderRadius: 24, padding: '80px 120px', textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>🖼</div>
              <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 12, letterSpacing: -1 }}>Packshot Gallery</div>
              <div style={{ display: 'inline-block', background: 'linear-gradient(135deg,#f0c040,#f5874f)', color: '#000', fontWeight: 800, fontSize: 18, padding: '10px 32px', borderRadius: 40, letterSpacing: 1, marginBottom: 20 }}>
                COMING SOON — Version 2.0
              </div>
              <div style={{ color: t.muted, fontSize: 14, maxWidth: 400, lineHeight: 1.8 }}>
                หน้านี้จะแสดงรูป Packshot ของสินค้าทุกตัว<br />
                พร้อมระบบจัดการและดาวน์โหลดรูปภาพ<br />
                <span style={{ color: t.accent, fontWeight: 600 }}>อยู่ระหว่างการพัฒนาในเวอร์ชัน 2.0</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              {['Product Images', 'Brand Assets', 'Download Center', 'Image Manager'].map(f => (
                <div key={f} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: '14px 20px', color: t.muted, fontSize: 13, fontWeight: 500, opacity: 0.6 }}>🔒 {f}</div>
              ))}
            </div>
          </div>
        )}

        {/* ANALYTICS */}
        {tab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 28 }}>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>🏆 Brand Ranking — Active SKUs in Modern Trade</div>
              <div style={{ color: t.muted, fontSize: 12, marginBottom: 24 }}>เรียงตามจำนวน SKU ที่วางขายอยู่จริง เทียบกับ SKU ทั้งหมดของแบรนด์</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {analyticsData.brands.slice(0, 20).map((b, i) => {
                  const pct = Math.round((b.active / b.total) * 100)
                  return (
                    <div key={b.brand} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ width: 28, fontSize: 12, color: t.muted, textAlign: 'right', fontWeight: 700 }}>#{i + 1}</div>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: b.company === 'Vcan' ? '#f0c040' : '#f25757', flexShrink: 0 }} />
                      <div style={{ width: 170, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.brand}</div>
                      <div style={{ flex: 1, height: 10, background: t.surface2, borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 5, width: `${Math.round((b.active / maxBrandActive) * 100)}%`, background: b.company === 'Vcan' ? 'linear-gradient(90deg,#f0c040,#f5874f)' : 'linear-gradient(90deg,#f25757,#c0392b)' }} />
                      </div>
                      <div style={{ width: 110, fontSize: 12, color: t.muted, textAlign: 'right' }}>
                        <span style={{ color: t.green, fontWeight: 700 }}>{b.active}</span> / {b.total} SKU
                      </div>
                      <div style={{ width: 52, textAlign: 'center', fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '2px 8px', background: pct === 100 ? 'rgba(62,207,110,0.15)' : pct >= 70 ? 'rgba(79,142,247,0.12)' : 'rgba(242,87,87,0.12)', color: pct === 100 ? t.green : pct >= 70 ? t.blue : t.red }}>{pct}%</div>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 20, fontSize: 12, color: t.muted }}>
                <span><span style={{ color: '#f0c040' }}>●</span> Vcan</span>
                <span><span style={{ color: '#f25757' }}>●</span> Moola</span>
              </div>
            </div>

            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 28 }}>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>🏪 Retailer Coverage — Active SKUs</div>
              <div style={{ color: t.muted, fontSize: 12, marginBottom: 24 }}>Modern trade ไหนมี SKU วางขายมากที่สุด</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 160 }}>
                {analyticsData.retailerMap.map(({ name, count, pending }) => (
                  <div key={name} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{count}</div>
                    <div style={{ width: '100%' }}>
                      <div style={{ width: '100%', borderRadius: '4px 4px 0 0', height: `${Math.max(4, Math.round((count / maxRetailer) * 110))}px`, background: 'linear-gradient(180deg,#4f8ef7,#7c3aed)' }} />
                      {pending > 0 && <div style={{ width: '100%', height: 4, background: t.yellow, opacity: 0.8 }} />}
                    </div>
                    <div style={{ fontSize: 10, color: t.muted, textAlign: 'center', lineHeight: 1.3 }}>{RETAILER_SHORT[name]}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {['Vcan', 'Moola'].map(vendor => {
                const vd = rawData.filter(p => p.company === vendor)
                if (vd.length === 0) return null
                const va = vd.filter(p => p.status === 'ขาย').length
                const vp = vd.filter(p => p.status === 'รอขาย').length
                const vx = vd.filter(p => p.status === 'ยกเลิกขาย').length
                const vb = [...new Set(vd.map(p => p.brand.trim()))].length
                const clr = vendor === 'Vcan' ? '#f0c040' : '#f25757'
                return (
                  <div key={vendor} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 24 }}>
                    <div style={{ fontWeight: 800, fontSize: 22, color: clr, marginBottom: 16 }}>{vendor}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                      {[
                        { label: 'Total SKUs', val: vd.length, c: t.text },
                        { label: 'Brands', val: vb, c: t.blue },
                        { label: 'Active', val: va, c: t.green },
                        { label: 'Pending', val: vp, c: t.yellow },
                        { label: 'Discontinued', val: vx, c: t.red },
                        { label: 'Active %', val: `${Math.round(va / vd.length * 100)}%`, c: t.green },
                      ].map(({ label, val, c }) => (
                        <div key={label} style={{ background: t.surface2, borderRadius: 10, padding: '12px 16px' }}>
                          <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 24, fontWeight: 800, color: c }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ height: 8, background: t.surface2, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round(va / vd.length * 100)}%`, background: clr, borderRadius: 4 }} />
                    </div>
                    <div style={{ fontSize: 11, color: t.muted, marginTop: 6 }}>{Math.round(va / vd.length * 100)}% of portfolio is active</div>
                  </div>
                )
              })}
            </div>

            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: 28 }}>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>📊 Retailer Penetration by Brand (Top 10)</div>
              <div style={{ color: t.muted, fontSize: 12, marginBottom: 20 }}>แต่ละแบรนด์เข้าถึง modern trade ได้กี่ร้านค้า</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: t.muted, fontWeight: 600 }}>Brand</th>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: t.muted, fontWeight: 600 }}>Vendor</th>
                      {RETAILERS.map(r => <th key={r} style={{ padding: '8px 6px', textAlign: 'center', color: t.muted, fontWeight: 600, fontSize: 10, whiteSpace: 'nowrap' }}>{RETAILER_SHORT[r]}</th>)}
                      <th style={{ padding: '8px 12px', textAlign: 'center', color: t.muted, fontWeight: 600 }}>Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyticsData.brands.slice(0, 10).map((b) => {
                      const covered = RETAILERS.filter(r => b.activeRetailers[r] > 0).length
                      return (
                        <tr key={b.brand} style={{ borderBottom: `1px solid ${t.border}` }} className="rhover">
                          <td style={{ padding: '10px 12px', fontWeight: 700 }}>{b.brand}</td>
                          <td style={{ padding: '10px 12px' }}><span style={{ color: b.company === 'Vcan' ? '#f0c040' : '#f25757', fontWeight: 700, fontSize: 11 }}>{b.company}</span></td>
                          {RETAILERS.map(r => (
                            <td key={r} style={{ padding: '10px 6px', textAlign: 'center' }}>
                              {b.activeRetailers[r] > 0 ? <span style={{ color: t.green, fontWeight: 700 }}>{b.activeRetailers[r]}</span> : <span style={{ color: t.dim }}>—</span>}
                            </td>
                          ))}
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontWeight: 700, fontSize: 12, background: covered >= 8 ? 'rgba(62,207,110,0.15)' : covered >= 5 ? 'rgba(79,142,247,0.12)' : 'rgba(242,87,87,0.1)', color: covered >= 8 ? t.green : covered >= 5 ? t.blue : t.red }}>{covered}/{RETAILERS.length}</span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTS */}
        {tab === 'products' && (
          <>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
              <StatCard icon="📦" label="Total SKUs" value={stats.total} color={t.text} />
              <StatCard icon="✅" label="Active SKUs" value={stats.active} color={t.green} />
              <StatCard icon="⏳" label="Pending" value={stats.pending} color={t.yellow} />
              <StatCard icon="❌" label="Discon" value={stats.discon} color={t.red} />
            </div>

            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, padding: '20px 24px', marginBottom: 16, display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 10, color: t.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Vendor</div>
                <select value={vendorFilter} onChange={e => handleVendorChange(e.target.value)} style={{ background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, padding: '9px 14px', fontSize: 13, cursor: 'pointer', outline: 'none', minWidth: 120 }}>
                  <option value="ALL">All</option>
                  <option value="Vcan">Vcan</option>
                  <option value="Moola">Moola</option>
                </select>
              </div>

              <div style={{ flex: '1 1 280px' }}>
                <div style={{ fontSize: 10, color: t.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Search</div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: t.muted }}>🔍</span>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product or brand..."
                    style={{ width: '100%', background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, padding: '9px 36px', fontSize: 13, outline: 'none' }} />
                  {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 2 }}>
                <span style={{ fontSize: 12, color: t.muted }}>{filtered.length} results</span>
                {hasActiveFilters && (
                  <button onClick={clearAll} style={{ background: 'rgba(242,87,87,0.12)', border: '1px solid rgba(242,87,87,0.3)', borderRadius: 8, padding: '7px 14px', color: t.red, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✕ Clear All</button>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: t.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Brands {vendorFilter !== 'ALL' && `(${vendorFilter})`}</span>
                {selectedBrands.length > 0 && (
                  <>
                    <span style={{ fontSize: 11, color: t.accent, fontWeight: 600 }}>{selectedBrands.length} selected</span>
                    <button onClick={() => setSelectedBrands([])} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: 6, padding: '3px 10px', color: t.muted, fontSize: 11, cursor: 'pointer' }}>Clear brands</button>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {visibleBrands.map(b => {
                  const isSelected = selectedBrands.includes(b)
                  return (
                    <button key={b} className="bpill" onClick={() => toggleBrand(b)} style={{
                      background: isSelected ? t.accent : t.surface, color: isSelected ? '#000' : t.text,
                      border: `1px solid ${isSelected ? t.accent : t.border}`, borderRadius: 8,
                      padding: '8px 16px', fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                      boxShadow: isSelected ? `0 0 12px ${t.accent}44` : 'none',
                    }}>{b}</button>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 16, marginTop: 8 }}>
              {[
                { key: 'ALL', label: '● ALL LIST', color: t.blue },
                { key: 'ขาย', label: '● ACTIVE', color: t.green },
                { key: 'รอขาย', label: '● PENDING', color: t.yellow },
                { key: 'ยกเลิกขาย', label: '● DISCON', color: t.red },
              ].map(({ key, label, color }) => (
                <button key={key} onClick={() => setStatusTab(key)} style={{
                  background: statusTab === key ? t.surface : 'transparent',
                  border: `1px solid ${statusTab === key ? t.border : 'transparent'}`,
                  borderRadius: 8, padding: '7px 18px', color: statusTab === key ? color : t.muted,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.5, transition: 'all 0.15s',
                }}>{label}</button>
              ))}
            </div>

            <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}>
                      {[{ label: 'VENDOR', w: 80 }, { label: 'BRAND', w: 130 }, { label: 'PRODUCT DESCRIPTION', w: 320 }, ...RETAILERS.map(r => ({ label: RETAILER_SHORT[r], w: 70, center: true }))].map(({ label, w, center }) => (
                        <th key={label} style={{ padding: '10px 12px', textAlign: center ? 'center' : 'left', fontSize: 13, fontWeight: 700, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap', width: w, minWidth: w }}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p, i) => (
                      <tr key={p.barcode + i} className="rhover" style={{ borderBottom: `1px solid ${t.border}`, background: i % 2 === 0 ? 'transparent' : `${t.surface2}66` }}>
                        <td style={{ padding: '10px 12px', fontWeight: 800, fontSize: 12, color: p.company === 'Vcan' ? '#f0c040' : '#f25757' }}>{p.company}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>{p.brand}</td>
                        <td style={{ padding: '10px 12px', maxWidth: 320 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.product}>{p.product}</div>
                          <div style={{ fontSize: 10, color: t.muted, marginTop: 2, fontFamily: 'monospace' }}>{p.barcode}</div>
                        </td>
                        {RETAILERS.map(r => (
                          <td key={r} style={{ padding: '10px 8px', textAlign: 'center' }}>
                            <RetailerDot value={p.retailers[r]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={3 + RETAILERS.length} style={{ padding: 48, textAlign: 'center', color: t.muted }}>No products found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 20, fontSize: 11, color: t.muted, alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>Legend:</span>
              <span><span style={{ color: t.green }}>●</span> Active (A)</span>
              <span><span style={{ color: t.yellow }}>●</span> Pending / On Process</span>
              <span><span style={{ color: t.red }}>●</span> Discontinued</span>
              <span>— Not listed</span>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
