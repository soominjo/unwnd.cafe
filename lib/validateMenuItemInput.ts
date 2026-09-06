export const MAX_MENU_ITEM_PRICE = 100_000

export interface MenuItemInput {
  name: string
  subtitle?: string
  category: string
  priceHot?: number | null
  priceIce?: number | null
  priceFixed?: number | null
  addonType?: 'drink' | 'food' | null
  hiddenFromPos?: boolean
  applicableCategories?: string[] | null
}

export function isValidMenuItemInput(body: unknown): body is MenuItemInput {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  if (typeof b.name !== 'string' || b.name.trim().length === 0 || b.name.length > 80) return false
  if (typeof b.category !== 'string' || b.category.trim().length === 0 || b.category.length > 60) return false
  if (b.subtitle !== undefined && b.subtitle !== null) {
    if (typeof b.subtitle !== 'string' || b.subtitle.length > 200) return false
  }
  if (b.addonType !== undefined && b.addonType !== null) {
    if (b.addonType !== 'drink' && b.addonType !== 'food') return false
  }
  if (b.hiddenFromPos !== undefined && typeof b.hiddenFromPos !== 'boolean') return false
  if (b.applicableCategories !== undefined && b.applicableCategories !== null) {
    if (!Array.isArray(b.applicableCategories)) return false
    if (!b.applicableCategories.every((c) => typeof c === 'string' && c.length > 0 && c.length <= 60)) return false
  }
  const validatePrice = (v: unknown) =>
    v === undefined || v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_MENU_ITEM_PRICE)
  return validatePrice(b.priceHot) && validatePrice(b.priceIce) && validatePrice(b.priceFixed)
}
