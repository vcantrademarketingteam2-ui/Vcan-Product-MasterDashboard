import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { BRAND_CATEGORIES, brandCategory, keyBrand } from './brandCategory.js'
import { RETAILERS, COVER_FIT_RETAILERS } from './storeConstants.js'
import './ProductsPage.css'

// Products one-stop page (v4.0.0): every product filter in a left panel, the list beside it
// as packshot cards or a table. All filter state and memos live in App; shared components
// (RetailerLogo, RetailerDot, BrandPlaque, PackshotImg) come in as props, like PromoSection,
// so there is no circular import. Everything here is module scope — never define a component
// inside another component's render (it remounts on every state change and resets scroll).

// Theme object -> CSS variables used by ProductsPage.css (also re-applied on portalled sheets).
const tokens = (t, dark) => ({
  '--bg': t.bg, '--s': t.surface, '--s2': t.surface2, '--bdr': t.border, '--dim': t.dim,
  '--tx': t.text, '--mu': t.muted, '--acc': t.accent, '--gr': t.green, '--ye': t.yellow,
  '--re': t.red, '--bl': t.blue, '--vc': t.vcanClr, '--mo': t.moolaClr, '--hov': t.rowHover,
  '--onacc': dark ? '#1a1408' : '#fff',
})

const STATUS_BUTTONS = [
  { key: 'ALL', label: 'All', long: 'All', dot: '' },
  { key: 'ขาย', label: 'Active', long: 'Active', dot: 'a' },
  { key: 'รอขาย', label: 'Pending', long: 'Pending', dot: 'pp-pd' },
  { key: 'ยกเลิกขาย', label: 'Discon', long: 'Discontinued', dot: 'd' },
]
const statusCount = (stats, key) => (key === 'ALL' ? stats.total : key === 'ขาย' ? stats.active : key === 'รอขาย' ? stats.pending : stats.discon)
const pillOf = (status) => (status === 'ขาย' ? { cls: 'a', label: 'Active' } : status === 'รอขาย' ? { cls: 'p', label: 'Pending' } : { cls: 'd', label: 'Discon' })

const SORT_OPTIONS = [
  ['', 'Master list order'],
  ['product:asc', 'Name A to Z'],
  ['rsp:asc', 'Price low to high'],
  ['rsp:desc', 'Price high to low'],
  ['stores:desc', 'Most stores first'],
]
const SORT_COL_LABEL = { barcode: 'Barcode', rsp: 'Price', status: 'Status', vendor: 'Vendor', brand: 'Brand', product: 'Name', pack: 'Pack', stores: 'Stores' }

const money = (n) => (n ? `฿${n.toLocaleString()}` : '—')

// Where a product is sold: logos of the stores where it is active, plus plain words for the rest.
function storeSummary(p) {
  const active = []
  let pending = 0, discon = 0
  for (const r of RETAILERS) {
    const v = p.retailers[r]
    if (v === 'A') active.push(r)
    else if (v === 'รอขาย' || String(v).toLowerCase() === 'on process') pending++
    else if (v === 'ยกเลิกขาย') discon++
  }
  const text = [pending && `${pending} pending`, discon && `${discon} discontinued`].filter(Boolean).join(' · ')
  return { active, text }
}

const IcoSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
)
const IcoCards = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
)
const IcoList = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
)
const IcoChev = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
)

function SoldAt({ p, RetailerLogo, dark }) {
  const { active, text } = storeSummary(p)
  return (
    <span className="pp-la">
      <span className="pp-lal">Sold at</span>
      <span className="pp-lar">
        {active.length
          ? active.map(r => <RetailerLogo key={r} name={r} h={16} maxW={38} dark={dark} noGlow fallbackStyle={{ fontSize: 10, fontWeight: 700 }} />)
          : <span>No store yet</span>}
      </span>
      {text && <span>{text}</span>}
    </span>
  )
}

function StatusCard({ stats, statusTab, onToggleStatus }) {
  return (
    <div className="pp-stg">
      {STATUS_BUTTONS.map(({ key, long, dot }) => (
        <button key={key} type="button" className={`pp-stb${statusTab === key ? ' pp-on' : ''}`} aria-pressed={statusTab === key} onClick={() => onToggleStatus(key)}>
          {dot && <i className={`pp-dot ${dot}`} />}
          <span>{long}</span>
          <b>{statusCount(stats, key)}</b>
        </button>
      ))}
    </div>
  )
}

function CustomerTiles({ selectedRetailers, onToggleRetailer, retailerCounts, RetailerLogo, dark }) {
  return (
    <div className="pp-rtiles">
      {RETAILERS.map(r => {
        const on = selectedRetailers.includes(r)
        return (
          <button key={r} type="button" title={r} className={`pp-tile${on ? ' pp-on' : ''}`} aria-pressed={on} onClick={() => onToggleRetailer(r)}>
            <span className="pp-tlg">
              <RetailerLogo name={r} h={44} maxW="100%" dark={dark} noGlow cover={COVER_FIT_RETAILERS.has(r)} fallbackStyle={{ fontSize: 11, fontWeight: 700 }} />
            </span>
            <span className="pp-ct"><b>{retailerCounts[r] || 0}</b> listed</span>
          </button>
        )
      })}
    </div>
  )
}

function VendorSwitch({ vendorFilter, onVendorChange }) {
  return (
    <div className="pp-seg">
      {[['ALL', 'All'], ['Vcan', 'Vcan'], ['Moola', 'Moola']].map(([v, l]) => (
        <button key={v} type="button" className={vendorFilter === v ? 'pp-on' : ''} aria-pressed={vendorFilter === v} onClick={() => onVendorChange(v)}>{l}</button>
      ))}
    </div>
  )
}

function BrandBoxes({ visibleBrands, selectedBrands, onToggleBrand, brandCompany, brandCounts, BrandPlaque, t }) {
  const groups = useMemo(() => {
    const g = {}
    visibleBrands.forEach(b => { (g[brandCategory(b)] = g[brandCategory(b)] || []).push(b) })
    return BRAND_CATEGORIES.filter(c => g[c]?.length).map(c => [c, g[c]])
  }, [visibleBrands])
  return groups.map(([cat, brands]) => (
    <div key={cat} className="pp-bcat">
      <div className="pp-bch"><b>{cat}</b><i>{brands.length} {brands.length === 1 ? 'brand' : 'brands'}</i></div>
      <div className="pp-rtiles">
        {brands.map(b => {
          const on = selectedBrands.includes(b)
          const n = brandCounts[b] || 0
          const name = keyBrand(b)
          return (
            <button key={b} type="button" title={name} className={`pp-tile${on ? ' pp-on' : ''}`} aria-pressed={on} onClick={() => onToggleBrand(b)}>
              <BrandPlaque brand={name} company={brandCompany[b]} t={t} fixed={{ w: 76, h: 34 }} />
              <span className="pp-bnm">{name}</span>
              <span className="pp-ct"><b>{n}</b> {n === 1 ? 'item' : 'items'}</span>
            </button>
          )
        })}
      </div>
    </div>
  ))
}

function ProductCard({ p, t, dark, onSelect, RetailerLogo, PackshotImg }) {
  const pill = pillOf(p.status)
  return (
    <button type="button" className="pp-pcard" onClick={() => onSelect(p)}>
      <span className="pp-im">
        <PackshotImg barcode={p.barcode} side="front" placeholder="No photo yet" style={{ width: '100%', height: '100%', background: '#fff' }} />
      </span>
      <span className="pp-bn" style={{ color: p.company === 'Vcan' ? t.vcanClr : t.moolaClr }}>{p.brand}</span>
      <span className="pp-nm" title={p.product}>{p.product}</span>
      <span className="pp-ft"><strong>{money(p.rsp)}</strong><span className={`pp-pill ${pill.cls}`}><i />{pill.label}</span></span>
      <SoldAt p={p} RetailerLogo={RetailerLogo} dark={dark} />
    </button>
  )
}

function ProductRow({ p, t, dark, onSelect, extRetailers, RetailerLogo, RetailerDot, PackshotImg }) {
  const pill = pillOf(p.status)
  return (
    <tr onClick={() => onSelect(p)}>
      <td className="px">
        <div className="pp-pc">
          <span className="pp-th"><PackshotImg barcode={p.barcode} side="front" placeholder={p.brand.slice(0, 2).toUpperCase()} style={{ width: '100%', height: '100%', background: '#fff' }} /></span>
          <div>
            <div className="pp-pn" title={p.product}>{p.product}</div>
            <div className="pp-pm"><b style={{ color: p.company === 'Vcan' ? t.vcanClr : t.moolaClr }}>{p.brand}</b> · <span className="pp-mono">{p.barcode}</span></div>
          </div>
        </div>
      </td>
      <td>{p.packSize || '—'}</td>
      <td className="r">{money(p.rsp)}</td>
      <td><span className={`pp-pill ${pill.cls}`}><i />{pill.label}</span></td>
      {extRetailers.map(r => <td key={r} className="rcd"><RetailerDot value={p.retailers[r]} t={t} /></td>)}
      <td className="sa"><SoldAt p={p} RetailerLogo={RetailerLogo} dark={dark} /></td>
    </tr>
  )
}

function ProductTable({ rows, t, dark, onSelect, extRetailers, sortCol, sortDir, onHeaderSort, RetailerLogo, RetailerDot, PackshotImg }) {
  const th = (col, label, cls = '') => (
    <th className={`${cls} srt`} onClick={() => onHeaderSort(col)}>{label}{sortCol === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</th>
  )
  return (
    <table className="pp-tb">
      <thead>
        <tr>
          {th('product', 'Product', 'l')}{th('pack', 'Pack')}{th('rsp', 'RSP', 'r')}{th('status', 'Status')}
          {extRetailers.map(r => (
            <th key={r} className="rc"><RetailerLogo name={r} h={24} maxW={44} dark={dark} noGlow fallbackStyle={{ fontSize: 10 }} /></th>
          ))}
          <th className="l">Sold at</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(p => (
          <ProductRow key={p.barcode} p={p} t={t} dark={dark} onSelect={onSelect} extRetailers={extRetailers}
            RetailerLogo={RetailerLogo} RetailerDot={RetailerDot} PackshotImg={PackshotImg} />
        ))}
        {rows.length === 0 && <tr><td colSpan={5 + extRetailers.length} className="pp-empty">No product matches these filters.</td></tr>}
      </tbody>
    </table>
  )
}

function SearchBox({ search, setSearch }) {
  return (
    <label className="pp-search">
      <IcoSearch />
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a product: name, brand or barcode" autoComplete="off" />
    </label>
  )
}

function Legend() {
  return (
    <span className="pp-lgd">
      <span><i className="pp-dot a" />Active</span>
      <span><i className="pp-dot pp-pd" />Pending</span>
      <span><i className="pp-dot o" />On process</span>
      <span><i className="pp-dot d" />Discon</span>
    </span>
  )
}

function SortSelect({ sortCol, sortDir, onSort }) {
  const key = sortCol ? `${sortCol}:${sortDir}` : ''
  const known = SORT_OPTIONS.some(([v]) => v === key)
  return (
    <label className="pp-sel">Sort
      <select value={key} onChange={e => { const [c, d] = e.target.value.split(':'); onSort(c || null, d || 'asc') }}>
        {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        {!known && <option value={key}>By {SORT_COL_LABEL[sortCol] || sortCol}</option>}
      </select>
    </label>
  )
}

// Bottom sheet, portalled to <body>: a backdrop-filter ancestor would capture position:fixed
// (see PromoSection.jsx). A portal loses inherited colour / font, so they are set explicitly.
function Sheet({ title, heading = true, onClose, t, dark, children }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  return createPortal(
    <div className="pp-sheet-bg" onClick={onClose} style={{ ...tokens(t, dark), color: t.text, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, zoom: 1.05 }}>
      <div className="pp-sheet" role="dialog" aria-label={title} onClick={e => e.stopPropagation()}>
        {heading && <div className="pp-sheet-h"><span>{title}</span></div>}
        <div className="pp-sheet-b">{children}</div>
        <div className="pp-sheet-f"><button type="button" className="pp-btn pp-solid" onClick={onClose}>Done</button></div>
      </div>
    </div>,
    document.body
  )
}

export default function ProductsPage({
  t, dark, isMobile, glassPanel, rows, totalCount, stats,
  search, setSearch, vendorFilter, onVendorChange, statusTab, onToggleStatus,
  selectedRetailers, onToggleRetailer, retailerCounts,
  selectedBrands, onToggleBrand, visibleBrands, brandCompany, brandCounts,
  hasActiveFilters, onClearAll, sortCol, sortDir, onSort, onHeaderSort, onSelect,
  RetailerLogo, RetailerDot, BrandPlaque, PackshotImg,
}) {
  const [view, setView] = useState('cards')     // 'cards' | 'table' (desktop only)
  const [sheet, setSheet] = useState(null)      // phone: 'brand' | 'customer' | null
  const extRetailers = useMemo(() => RETAILERS.filter(r => selectedRetailers.includes(r)), [selectedRetailers])
  const table = !isMobile && view === 'table'

  const customerTiles = (
    <CustomerTiles selectedRetailers={selectedRetailers} onToggleRetailer={onToggleRetailer} retailerCounts={retailerCounts} RetailerLogo={RetailerLogo} dark={dark} />
  )
  const brandCard = (
    <>
      <div className="pp-ch"><h2>Brand</h2><VendorSwitch vendorFilter={vendorFilter} onVendorChange={onVendorChange} /></div>
      <BrandBoxes visibleBrands={visibleBrands} selectedBrands={selectedBrands} onToggleBrand={onToggleBrand}
        brandCompany={brandCompany} brandCounts={brandCounts} BrandPlaque={BrandPlaque} t={t} />
    </>
  )
  const chips = (
    <>
      {selectedBrands.map(b => <button key={`b-${b}`} type="button" className="pp-chip" onClick={() => onToggleBrand(b)} title="Remove">{keyBrand(b)}<span>×</span></button>)}
      {extRetailers.map(r => <button key={`r-${r}`} type="button" className="pp-chip" onClick={() => onToggleRetailer(r)} title="Remove">{r}<span>×</span></button>)}
    </>
  )
  const showing = <span>Showing <b>{rows.length}</b> of {totalCount} products</span>
  const cards = (
    <div className="pp-cards">
      {rows.map(p => <ProductCard key={p.barcode} p={p} t={t} dark={dark} onSelect={onSelect} RetailerLogo={RetailerLogo} PackshotImg={PackshotImg} />)}
      {rows.length === 0 && <div className="pp-empty">No product matches these filters.</div>}
    </div>
  )

  if (isMobile) {
    return (
      <div className="pp-ph" style={tokens(t, dark)}>
        <SearchBox search={search} setSearch={setSearch} />
        <div className="pp-st4">
          {STATUS_BUTTONS.map(({ key, label, dot }) => (
            <button key={key} type="button" className={statusTab === key ? 'pp-on' : ''} aria-pressed={statusTab === key} onClick={() => onToggleStatus(key)}>
              <span>{dot && <i className={`pp-dot ${dot}`} />}{label}</span>
              <b>{statusCount(stats, key)}</b>
            </button>
          ))}
        </div>
        <div className="pp-phrow">
          <button type="button" className={`pp-btn${selectedBrands.length ? ' pp-on' : ''}`} onClick={() => setSheet('brand')}>
            Brand <span className={`pp-n${selectedBrands.length ? '' : ' pp-z'}`}>{selectedBrands.length}</span><IcoChev />
          </button>
          <button type="button" className={`pp-btn${selectedRetailers.length ? ' pp-on' : ''}`} onClick={() => setSheet('customer')}>
            Customer <span className={`pp-n${selectedRetailers.length ? '' : ' pp-z'}`}>{selectedRetailers.length}</span><IcoChev />
          </button>
          <button type="button" className="pp-btn" disabled={!hasActiveFilters} onClick={onClearAll}>Clear all</button>
        </div>
        <div className="pp-sum">{showing}{chips}<span className="pp-sp" /><SortSelect sortCol={sortCol} sortDir={sortDir} onSort={onSort} /></div>
        {cards}
        {sheet === 'brand' && <Sheet title="Brand" heading={false} onClose={() => setSheet(null)} t={t} dark={dark}>{brandCard}</Sheet>}
        {sheet === 'customer' && (
          <Sheet title="Customer" onClose={() => setSheet(null)} t={t} dark={dark}>
            <p className="pp-hint">Tap a store to filter. Tap again to remove it.</p>
            {customerTiles}
          </Sheet>
        )}
      </div>
    )
  }

  return (
    <div className="pp-root" style={tokens(t, dark)}>
      <aside className="pp-doors">
        <section className="pp-card" style={glassPanel}>
          <div className="pp-ch"><h2>Status</h2></div>
          <StatusCard stats={stats} statusTab={statusTab} onToggleStatus={onToggleStatus} />
        </section>
        <section className="pp-card" style={glassPanel}>
          <div className="pp-ch" style={{ marginBottom: 2 }}><h2>Customer</h2></div>
          <p className="pp-hint">Tap a store to filter. Tap again to remove it.</p>
          {customerTiles}
        </section>
        <section className="pp-card" style={glassPanel}>{brandCard}</section>
      </aside>
      <div className="pp-col">
        <div className="pp-tools">
          <SearchBox search={search} setSearch={setSearch} />
          <button type="button" className="pp-btn" disabled={!hasActiveFilters} onClick={onClearAll}>Clear all</button>
        </div>
        <div className="pp-sum">
          {showing}{chips}<span className="pp-sp" />
          {table && extRetailers.length > 0 && <Legend />}
          <SortSelect sortCol={sortCol} sortDir={sortDir} onSort={onSort} />
          <div className="pp-seg">
            <button type="button" className={view === 'cards' ? 'pp-on' : ''} aria-pressed={view === 'cards'} onClick={() => setView('cards')}><IcoCards />Cards</button>
            <button type="button" className={view === 'table' ? 'pp-on' : ''} aria-pressed={view === 'table'} onClick={() => setView('table')}><IcoList />Table</button>
          </div>
        </div>
        <div className="pp-tw">
          {table
            ? <ProductTable rows={rows} t={t} dark={dark} onSelect={onSelect} extRetailers={extRetailers} sortCol={sortCol} sortDir={sortDir}
                onHeaderSort={onHeaderSort} RetailerLogo={RetailerLogo} RetailerDot={RetailerDot} PackshotImg={PackshotImg} />
            : cards}
        </div>
      </div>
    </div>
  )
}
