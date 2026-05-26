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

function parseCSVLine(line) {
  const result = []
  let cur = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) { result.push(cur.trim()); cur = '' }
    else cur += ch
  }
  result.push(cur.trim())
  return result
}

function parseCSV(text) {
  const lines = text.split('\n').map(l => l.replace(/\r/g, ''))
  const rows = []
  let currentCompany = '', currentBrand = ''
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
    const c0 = stripQuotes(row[0]), c1 = stripQuotes(row[1]), c2 = stripQuotes(row[2])
    if (VENDORS.includes(c0)) currentCompany = c0
    let barcode = '', product = '', packSize = '', rsp = '', status = '', retailerOffset = 8
    if (isBarcode(c2)) {
      if (c1 && !isBarcode(c1)) currentBrand = normalizeBrand(c1)
      barcode = c2; product = row[4]?.trim() || ''; packSize = row[5]?.trim() || ''
      rsp = row[6]?.replace(/[^\d.]/g, '') || ''; status = row[7]?.trim() || ''; retailerOffset = 8
    } else if (isBarcode(c1) && isBarcode(c2)) {
      if (c0 && !VENDORS.includes(c0)) currentBrand = normalizeBrand(c0)
      barcode = c1; product = row[3]?.trim() || ''; packSize = row[4]?.trim() || ''
      rsp = row[5]?.replace(/[^\d.]/g, '') || ''; status = row[6]?.trim() || ''; retailerOffset = 7
    } else if (!c0 && !c1 && isBarcode(c2)) {
      barcode = c2; product = row[4]?.trim() || ''; packSize = row[5]?.trim() || ''
      rsp = row[6]?.replace(/[^\d.]/g, '') || ''; status = row[7]?.trim() || ''; retailerOffset = 8
    } else continue
    if (!barcode || !product || product.trim().toLowerCase() === 'total') continue
    if (!isBarcode(barcode)) continue
    const retailerStatus = {}
    RETAILERS.forEach((r, j) => { retailerStatus[r] = row[retailerOffset + j]?.trim() || '' })
    rows.push({ company: currentCompany, brand: currentBrand, barcode, product, packSize, rsp: rsp ? parseFloat(rsp) : 0, status, retailers: retailerStatus })
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
  const [sidebarOpen, setSidebarOpen] = useState(true)

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
          setLastUpdated(new Date(lastMod || Date.now()).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }))
        }
      } catch (e) {
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
          setRawData(parsed); setDataSource('csv'); setSelectedBrands([])
          setVendorFilter('ALL'); setStatusTab('ALL'); setSearch('')
          setLastUpdated(new Date(file.lastModified).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }))
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

  // Navy blue dark mode
  const t = dark ? {
    bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
    text: '#e6edf3', muted: '#7d8590', dim: '#30363d', accent: '#f0c040',
    green: '#3fb950', yellow: '#d29922', red: '#f85149', blue: '#58a6ff',
    orange: '#e3b341', rowHover: '#1c2128', sidebarBg: '#010409', headerBg: '#010409',
  } : {
    bg: '#f0f2f5', surface: '#ffffff', surface2: '#eaedf0', border: '#d0d7de',
    text: '#1f2328', muted: '#656d76', dim: '#d0d7de', accent: '#c8960a',
    green: '#1a7f37', yellow: '#9a6700', red: '#cf222e', blue: '#0969da',
    orange: '#953800', rowHover: '#f6f8fa', sidebarBg: '#ffffff', headerBg: '#ffffff',
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

  // Half-moon dot component
  function RetailerDot({ value }) {
    if (value === 'A') return (
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.green, margin: 'auto', boxShadow: `0 0 5px ${t.green}88` }} />
    )
    // รอขาย = yellow half-moon
    if (value === 'รอขาย') return (
      <div style={{
        width: 10, height: 10, borderRadius: '50%', margin: 'auto',
        background: `linear-gradient(to left, ${t.yellow} 50%, transparent 50%)`,
        border: `1.5px solid ${t.yellow}`,
      }} />
    )
    // On Process = blue half-moon
    if (value === 'On Process') return (
      <div style={{
        width: 10, height: 10, borderRadius: '50%', margin: 'auto',
        background: `linear-gradient(to left, ${t.blue} 50%, transparent 50%)`,
        border: `1.5px solid ${t.blue}`,
      }} />
    )
    if (value === 'ยกเลิกขาย') return (
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.red, margin: 'auto' }} />
    )
    return <div style={{ width: 6, height: 1, background: t.dim, margin: 'auto' }} />
  }

  function StatCard({ label, value, sub, color }) {
    return (
      <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: '20px 24px', flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: 11, color: t.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: color || t.text, lineHeight: 1, marginBottom: 4 }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: t.muted }}>{sub}</div>}
      </div>
    )
  }

  const NAV_ITEMS = [
    { key: 'products', icon: '▦', label: 'Products' },
    { key: 'analytics', icon: '◈', label: 'Analytics' },
    { key: 'packshot', icon: '⊡', label: 'Packshot' },
    { key: 'promotion', icon: '☰', label: 'Promotion Plan' },
  ]

  const SIDEBAR_W = sidebarOpen ? 220 : 56

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <img src={vcanLogo} alt="VCAN" style={{ height: 56, opacity: 0.85 }} />
      <div style={{ color: '#7d8590', fontSize: 13 }}>กำลังดึงข้อมูลจาก Google Sheets...</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#f0c040', animation: `bounce 1s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes bounce{0%,100%{opacity:0.2;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: t.bg, color: t.text, fontSize: 14 }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Inter','DM Sans',sans-serif;}
        input,select,button{font-family:inherit;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${t.border};border-radius:3px;}
        .rhover:hover{background:${t.rowHover}!important;}
        .bpill{transition:all 0.15s;cursor:pointer;}
        .bpill:hover{background:${t.accent}!important;color:#000!important;border-color:${t.accent}!important;}
        .nav-item{transition:all 0.15s;cursor:pointer;border-radius:8px;}
        .nav-item:hover{background:${t.surface2}!important;}
        .sb-btn{transition:background 0.15s;cursor:pointer;}
        .sb-btn:hover{background:${t.surface2}!important;}
      `}</style>

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: SIDEBAR_W, minHeight: '100vh', background: t.sidebarBg,
        borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
        transition: 'width 0.2s ease', flexShrink: 0, zIndex: 100,
      }}>
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: sidebarOpen ? '18px 16px 16px' : '18px 0 16px', justifyContent: sidebarOpen ? 'flex-start' : 'center', borderBottom: `1px solid ${t.border}` }}>
          {sidebarOpen && <img src={vcanLogo} alt="VCAN" style={{ height: 30, objectFit: 'contain' }} />}
          {sidebarOpen && (
            <div>
              <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: 0.5 }}>Product Master</div>
              <div style={{ fontSize: 10, color: t.accent, fontWeight: 700 }}>v2.0</div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(o => !o)} className="sb-btn" style={{
            marginLeft: sidebarOpen ? 'auto' : 0, background: 'none', border: 'none',
            color: t.muted, fontSize: 16, padding: '4px 6px', borderRadius: 6,
            display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ display: 'block', width: 16, height: 2, background: t.muted, borderRadius: 2 }} />
            <span style={{ display: 'block', width: 16, height: 2, background: t.muted, borderRadius: 2 }} />
            <span style={{ display: 'block', width: 16, height: 2, background: t.muted, borderRadius: 2 }} />
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(({ key, icon, label }) => {
            const active = tab === key
            return (
              <button key={key} onClick={() => setTab(key)} className="nav-item" style={{
                background: active ? t.surface2 : 'none', border: 'none',
                color: active ? t.text : t.muted, display: 'flex', alignItems: 'center',
                gap: 10, padding: sidebarOpen ? '9px 12px' : '9px 0', justifyContent: sidebarOpen ? 'flex-start' : 'center',
                fontWeight: active ? 700 : 500, fontSize: 13, width: '100%',
                borderLeft: active ? `2px solid ${t.accent}` : '2px solid transparent',
              }}>
                <span style={{ fontSize: 15, flexShrink: 0, width: 20, textAlign: 'center' }}>{icon}</span>
                {sidebarOpen && <span>{label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Filters — only when sidebar open */}
        {sidebarOpen && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px' }}>
            {/* Vendor */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, padding: '0 6px', marginBottom: 6 }}>Vendor</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {['ALL', 'Vcan', 'Moola'].map(v => (
                  <button key={v} onClick={() => handleVendorChange(v)} className="sb-btn" style={{
                    flex: 1, background: vendorFilter === v ? t.accent : t.surface2,
                    color: vendorFilter === v ? '#000' : t.muted,
                    border: 'none', borderRadius: 6, padding: '6px 4px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}>{v}</button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, padding: '0 6px', marginBottom: 6 }}>Status</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {[
                  { key: 'ALL', label: 'All Statuses', color: t.text },
                  { key: 'ขาย', label: 'Active', color: t.green },
                  { key: 'รอขาย', label: 'Pending', color: t.yellow },
                  { key: 'ยกเลิกขาย', label: 'Discontinued', color: t.red },
                ].map(({ key, label, color }) => (
                  <button key={key} onClick={() => setStatusTab(key)} className="nav-item" style={{
                    background: statusTab === key ? t.surface2 : 'none', border: 'none',
                    color: statusTab === key ? color : t.muted, display: 'flex', alignItems: 'center',
                    gap: 8, padding: '7px 10px', fontWeight: statusTab === key ? 700 : 400,
                    fontSize: 12, width: '100%', borderRadius: 6,
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Brands */}
            <div>
              <div style={{ fontSize: 10, color: t.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, padding: '0 6px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Brands</span>
                {selectedBrands.length > 0 && (
                  <button onClick={() => setSelectedBrands([])} style={{ background: 'none', border: 'none', color: t.accent, fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>Clear</button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {visibleBrands.map(b => {
                  const sel = selectedBrands.includes(b)
                  return (
                    <button key={b} className="nav-item" onClick={() => toggleBrand(b)} style={{
                      background: sel ? `${t.accent}22` : 'none', border: 'none',
                      color: sel ? t.accent : t.muted, padding: '6px 10px',
                      fontSize: 11, fontWeight: sel ? 700 : 400, width: '100%',
                      textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{b}</button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Bottom: theme + data source */}
        <div style={{ borderTop: `1px solid ${t.border}`, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button onClick={() => setDark(d => !d)} className="sb-btn" style={{
            background: 'none', border: 'none', color: t.muted, fontSize: 13,
            padding: '6px 8px', borderRadius: 6, display: 'flex', alignItems: 'center',
            gap: 8, width: '100%', justifyContent: sidebarOpen ? 'flex-start' : 'center',
          }}>
            <span>{dark ? '☀' : '🌙'}</span>
            {sidebarOpen && <span style={{ fontSize: 11 }}>{dark ? 'Light mode' : 'Dark mode'}</span>}
          </button>
          {sidebarOpen && (
            <div style={{ fontSize: 10, color: t.muted, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: dataSource === 'sheets' ? t.green : dataSource === 'csv' ? t.blue : t.yellow,
              }} />
              <span>{dataSource === 'sheets' ? 'Live' : dataSource === 'csv' ? 'CSV' : 'Local'}</span>
              {lastUpdated && <span style={{ opacity: 0.6 }}>· {lastUpdated}</span>}
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{
          background: t.headerBg, borderBottom: `1px solid ${t.border}`,
          padding: '0 24px', height: 56, display: 'flex', alignItems: 'center',
          gap: 12, position: 'sticky', top: 0, zIndex: 50,
        }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: t.muted, fontSize: 13 }}>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search products, brands, barcodes..."
              style={{ width: '100%', background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, color: t.text, padding: '8px 12px 8px 30px', fontSize: 13, outline: 'none' }} />
            {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: t.muted, cursor: 'pointer', fontSize: 16 }}>×</button>}
          </div>
          {hasActiveFilters && (
            <button onClick={clearAll} style={{ background: 'none', border: `1px solid ${t.border}`, borderRadius: 8, padding: '7px 12px', color: t.muted, fontSize: 12, cursor: 'pointer' }}>✕ Clear filters</button>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{
              background: t.blue, border: 'none', borderRadius: 8,
              padding: '7px 16px', color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              ↑ Import CSV
              <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} />
            </label>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>

          {/* PRODUCTS */}
          {tab === 'products' && (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <StatCard label="Total SKUs" value={stats.total} sub={`of ${stats.total} total`} />
                <StatCard label="Active" value={stats.active} sub={`${stats.total ? Math.round(stats.active / stats.total * 100) : 0}% active`} color={t.green} />
                <StatCard label="Vcan" value={rawData.filter(p => p.company === 'Vcan').length} sub="Yellow vendor" color="#f0c040" />
                <StatCard label="Moola" value={rawData.filter(p => p.company === 'Moola').length} sub="Red vendor" color="#f25757" />
              </div>

              <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, color: t.muted }}>Showing <strong style={{ color: t.text }}>{filtered.length}</strong> products</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: t.surface2, borderBottom: `1px solid ${t.border}` }}>
                        <th style={{ padding: '9px 10px', textAlign: 'left', color: t.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>#</th>
                        <th style={{ padding: '9px 10px', textAlign: 'left', color: t.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>Brand</th>
                        <th style={{ padding: '9px 10px', textAlign: 'left', color: t.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>Barcode</th>
                        <th style={{ padding: '9px 10px', textAlign: 'left', color: t.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Product</th>
                        <th style={{ padding: '9px 8px', textAlign: 'center', color: t.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pack</th>
                        <th style={{ padding: '9px 8px', textAlign: 'center', color: t.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>RSP</th>
                        <th style={{ padding: '9px 8px', textAlign: 'center', color: t.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</th>
                        {RETAILERS.map(r => (
                          <th key={r} style={{ padding: '9px 6px', textAlign: 'center', color: t.muted, fontWeight: 600, fontSize: 10, whiteSpace: 'nowrap' }}>{RETAILER_SHORT[r]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((p, i) => (
                        <tr key={p.barcode + i} className="rhover" style={{ borderBottom: `1px solid ${t.border}` }}>
                          <td style={{ padding: '8px 10px', color: t.muted, fontSize: 11 }}>{i + 1}</td>
                          <td style={{ padding: '8px 10px', fontWeight: 700, whiteSpace: 'nowrap', color: p.company === 'Vcan' ? '#f0c040' : '#f25757' }}>{p.brand}</td>
                          <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: t.muted, whiteSpace: 'nowrap' }}>{p.barcode}</td>
                          <td style={{ padding: '8px 10px', maxWidth: 280 }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.product}>{p.product}</div>
                          </td>
                          <td style={{ padding: '8px 8px', textAlign: 'center', color: t.muted }}>{p.packSize}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>{p.rsp ? `฿${p.rsp}` : '—'}</td>
                          <td style={{ padding: '8px 8px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
                              background: p.status === 'ขาย' ? `${t.green}22` : p.status === 'รอขาย' ? `${t.yellow}22` : `${t.red}22`,
                              color: p.status === 'ขาย' ? t.green : p.status === 'รอขาย' ? t.yellow : t.red,
                            }}>
                              {p.status === 'ขาย' ? 'Active' : p.status === 'รอขาย' ? 'Pending' : 'Discon'}
                            </span>
                          </td>
                          {RETAILERS.map(r => (
                            <td key={r} style={{ padding: '8px 6px', textAlign: 'center' }}>
                              <RetailerDot value={p.retailers[r]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                      {filtered.length === 0 && (
                        <tr><td colSpan={7 + RETAILERS.length} style={{ padding: 48, textAlign: 'center', color: t.muted }}>No products match your filters</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 11, color: t.muted, alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>Legend:</span>
                <span><span style={{ color: t.green }}>●</span> Active</span>
                <span>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: `linear-gradient(to left,${t.yellow} 50%,transparent 50%)`, border: `1.5px solid ${t.yellow}`, verticalAlign: 'middle', marginRight: 4 }} />
                  Pending (รอขาย)
                </span>
                <span>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: `linear-gradient(to left,${t.blue} 50%,transparent 50%)`, border: `1.5px solid ${t.blue}`, verticalAlign: 'middle', marginRight: 4 }} />
                  On Process
                </span>
                <span><span style={{ color: t.red }}>●</span> Discontinued</span>
                <span>— Not listed</span>
              </div>
            </>
          )}

          {/* ANALYTICS */}
          {tab === 'analytics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🏆 Brand Ranking — Active SKUs</div>
                <div style={{ color: t.muted, fontSize: 12, marginBottom: 20 }}>เรียงตามจำนวน SKU ที่วางขายอยู่จริง</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {analyticsData.brands.slice(0, 20).map((b, i) => {
                    const pct = Math.round((b.active / b.total) * 100)
                    return (
                      <div key={b.brand} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 24, fontSize: 11, color: t.muted, textAlign: 'right', fontWeight: 700 }}>#{i + 1}</div>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: b.company === 'Vcan' ? '#f0c040' : '#f25757', flexShrink: 0 }} />
                        <div style={{ width: 160, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.brand}</div>
                        <div style={{ flex: 1, height: 8, background: t.surface2, borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 4, width: `${Math.round((b.active / maxBrandActive) * 100)}%`, background: b.company === 'Vcan' ? 'linear-gradient(90deg,#f0c040,#f5874f)' : 'linear-gradient(90deg,#f25757,#c0392b)' }} />
                        </div>
                        <div style={{ width: 90, fontSize: 11, color: t.muted, textAlign: 'right' }}>
                          <span style={{ color: t.green, fontWeight: 700 }}>{b.active}</span> / {b.total} SKU
                        </div>
                        <div style={{ width: 44, textAlign: 'center', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '2px 6px', background: pct === 100 ? `${t.green}22` : pct >= 70 ? `${t.blue}22` : `${t.red}22`, color: pct === 100 ? t.green : pct >= 70 ? t.blue : t.red }}>{pct}%</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🏪 Retailer Coverage</div>
                <div style={{ color: t.muted, fontSize: 12, marginBottom: 20 }}>Active SKUs per retailer</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 140 }}>
                  {analyticsData.retailerMap.map(({ name, count, pending }) => (
                    <div key={name} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 700 }}>{count}</div>
                      <div style={{ width: '100%' }}>
                        <div style={{ width: '100%', borderRadius: '3px 3px 0 0', height: `${Math.max(4, Math.round((count / maxRetailer) * 100))}px`, background: 'linear-gradient(180deg,#58a6ff,#7c3aed)' }} />
                        {pending > 0 && <div style={{ width: '100%', height: 3, background: t.yellow, opacity: 0.7 }} />}
                      </div>
                      <div style={{ fontSize: 9, color: t.muted, textAlign: 'center', lineHeight: 1.3 }}>{RETAILER_SHORT[name]}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {['Vcan', 'Moola'].map(vendor => {
                  const vd = rawData.filter(p => p.company === vendor)
                  if (vd.length === 0) return null
                  const va = vd.filter(p => p.status === 'ขาย').length
                  const vp = vd.filter(p => p.status === 'รอขาย').length
                  const vx = vd.filter(p => p.status === 'ยกเลิกขาย').length
                  const vb = [...new Set(vd.map(p => p.brand.trim()))].length
                  const clr = vendor === 'Vcan' ? '#f0c040' : '#f25757'
                  return (
                    <div key={vendor} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 20 }}>
                      <div style={{ fontWeight: 800, fontSize: 20, color: clr, marginBottom: 14 }}>{vendor}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                        {[
                          { label: 'Total SKUs', val: vd.length, c: t.text },
                          { label: 'Brands', val: vb, c: t.blue },
                          { label: 'Active', val: va, c: t.green },
                          { label: 'Pending', val: vp, c: t.yellow },
                          { label: 'Discontinued', val: vx, c: t.red },
                          { label: 'Active %', val: `${Math.round(va / vd.length * 100)}%`, c: t.green },
                        ].map(({ label, val, c }) => (
                          <div key={label} style={{ background: t.surface2, borderRadius: 8, padding: '10px 14px' }}>
                            <div style={{ fontSize: 10, color: t.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: c }}>{val}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ height: 6, background: t.surface2, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.round(va / vd.length * 100)}%`, background: clr, borderRadius: 3 }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>📊 Retailer Penetration by Brand (Top 10)</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${t.border}` }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: t.muted, fontWeight: 600 }}>Brand</th>
                        <th style={{ padding: '8px 10px', textAlign: 'left', color: t.muted, fontWeight: 600 }}>Vendor</th>
                        {RETAILERS.map(r => <th key={r} style={{ padding: '8px 6px', textAlign: 'center', color: t.muted, fontWeight: 600, fontSize: 10, whiteSpace: 'nowrap' }}>{RETAILER_SHORT[r]}</th>)}
                        <th style={{ padding: '8px 10px', textAlign: 'center', color: t.muted, fontWeight: 600 }}>Coverage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsData.brands.slice(0, 10).map((b) => {
                        const covered = RETAILERS.filter(r => b.activeRetailers[r] > 0).length
                        return (
                          <tr key={b.brand} style={{ borderBottom: `1px solid ${t.border}` }} className="rhover">
                            <td style={{ padding: '9px 10px', fontWeight: 700 }}>{b.brand}</td>
                            <td style={{ padding: '9px 10px' }}><span style={{ color: b.company === 'Vcan' ? '#f0c040' : '#f25757', fontWeight: 700, fontSize: 11 }}>{b.company}</span></td>
                            {RETAILERS.map(r => (
                              <td key={r} style={{ padding: '9px 6px', textAlign: 'center' }}>
                                {b.activeRetailers[r] > 0 ? <span style={{ color: t.green, fontWeight: 700 }}>{b.activeRetailers[r]}</span> : <span style={{ color: t.dim }}>—</span>}
                              </td>
                            ))}
                            <td style={{ padding: '9px 10px', textAlign: 'center' }}>
                              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontWeight: 700, fontSize: 11, background: covered >= 8 ? `${t.green}22` : covered >= 5 ? `${t.blue}22` : `${t.red}22`, color: covered >= 8 ? t.green : covered >= 5 ? t.blue : t.red }}>{covered}/{RETAILERS.length}</span>
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

          {/* PACKSHOT */}
          {tab === 'packshot' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 20 }}>
              <div style={{ background: t.surface, border: `2px dashed ${t.border}`, borderRadius: 20, padding: '60px 100px', textAlign: 'center' }}>
                <div style={{ fontSize: 56, marginBottom: 16 }}>🖼</div>
                <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>Packshot Gallery</div>
                <div style={{ display: 'inline-block', background: 'linear-gradient(135deg,#f0c040,#f5874f)', color: '#000', fontWeight: 800, fontSize: 14, padding: '8px 24px', borderRadius: 40, marginBottom: 16 }}>
                  COMING SOON — Version 2.0
                </div>
                <div style={{ color: t.muted, fontSize: 13, lineHeight: 1.8 }}>
                  หน้านี้จะแสดงรูป Packshot ของสินค้าทุกตัว<br />
                  <span style={{ color: t.accent, fontWeight: 600 }}>อยู่ระหว่างการพัฒนา</span>
                </div>
              </div>
            </div>
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
    </div>
  )
}
