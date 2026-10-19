// Brand-filter grouping, shared by App.jsx (Products/Packshot) and PromoSection.
// Patterns match by brand keyword so SKU variants ("Malizia Bath Foam 1L", "VITAKRAFT CAT",
// "PEARS SOAP") inherit the base brand's category. Anything unmatched lands in "Other" —
// brand lists are data-derived, so the grouping must never silently drop a brand.
export const BRAND_CATEGORIES = ['Laundry', 'Homecare', 'Personal Care', 'Intimate', 'Pet', 'Kitchen Ware', 'Other']
// Order matters: brandCategory returns the FIRST matching category, so the more
// specific rules (Intimate, exact-match Laundry L'Arbre Vert) come before the
// broad Personal Care fallbacks (/malizia/, /l'arbre/).
const BRAND_CAT_RULES = [
  ['Pet',           [/vitakraft/i]],
  ['Kitchen Ware',  [/\bwmf\b/i]],
  ['Intimate',      [/malizia\s*intimate/i, /tena/i]],
  ['Laundry',       [/perwoll/i, /purex/i, /vernel/i, /vnew/i, /^l['’]?arbre vert\s*$/i]],
  ['Homecare',      [/sofix/i, /somat/i, /pril/i, /combat/i, /general\s*fresh/i, /brilly/i, /tempo/i, /renuzit/i]],
  ['Personal Care', [/dove/i, /dial/i, /pears/i, /pepsodent/i, /jack/i, /malizia/i, /l['’]?arbre/i, /sundae/i]],
]
// SKU-level overrides for brands whose range spans categories: [brand, product, category].
// A matching SKU gets the split filter key "<brand>|<category>", so the brand pill shows
// up in each category tab with its own count and selects only that category's SKUs.
const SKU_CAT_RULES = [
  [/^l['’]?arbre vert\s*$/i, /dish|rinse/i, 'Homecare'],
]

export function brandKey(brand, product = '') {
  const b = (brand || '').trim()
  const hit = SKU_CAT_RULES.find(([bp, pp]) => bp.test(b) && pp.test(product || ''))
  return hit ? `${b}|${hit[2]}` : b
}
export const keyBrand = k => k.split('|')[0]

export function brandCategory(k) {
  const [b, cat] = k.split('|')
  if (cat) return cat
  for (const [c, pats] of BRAND_CAT_RULES) if (pats.some(p => p.test(b))) return c
  return 'Other'
}
