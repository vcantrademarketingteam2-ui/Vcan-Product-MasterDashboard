// Department PINs — values come from .env (VITE_ prefix = compiled into bundle)
// Shared by App.jsx (Product Popup pricing + import) and PromoSection.jsx (Calendar/Timeline GP).
export const DEPT_PINS = {
  [import.meta.env.VITE_PIN_SALES          ?? '2745']: 'Sales/Trade Marketing',
  [import.meta.env.VITE_PIN_DATA           ?? '4343']: 'Data',
  [import.meta.env.VITE_PIN_SALES_REGIONAL ?? '2001']: 'Sales (Regional)',
}

// Retailers each dept is blocked from seeing cost/GP for. Depts not listed here see everything.
const DEPT_RETAILER_DENY = {
  'Sales (Regional)': ['Tops', 'Villa', 'TWD', 'Boots'],
}

export function canSeeRetailer(dept, retailer) {
  return !DEPT_RETAILER_DENY[dept]?.includes(retailer)
}

// Depts allowed to view the "who unlocked pricing" log
const LOG_ADMIN_DEPTS = ['Sales/Trade Marketing']

export function canViewAccessLog(dept) {
  return LOG_ADMIN_DEPTS.includes(dept)
}

// ponytail: browser localStorage only — records access on THIS device, not company-wide.
// Upgrade path: move to a Worker + KV binding if cross-device visibility is needed.
export function logPricingAccess(dept, label) {
  try {
    const logs = JSON.parse(localStorage.getItem('pricingLog') || '[]')
    logs.unshift({ dept, product: label, time: new Date().toISOString() })
    localStorage.setItem('pricingLog', JSON.stringify(logs.slice(0, 200)))
  } catch {}
}

export function getAccessLog() {
  try { return JSON.parse(localStorage.getItem('pricingLog') || '[]') }
  catch { return [] }
}

export function clearAccessLog() {
  try { localStorage.removeItem('pricingLog') } catch {}
}
