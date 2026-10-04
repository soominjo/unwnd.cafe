// What a sale's lines and discount rows must look like, for every route that saves them
// (POST /api/sales for a new order, POST /api/sales/[id]/items for lines added to one), and
// the shape a line is stored in.

export interface SaleItemInput {
  lineId:       string
  name:         string
  variant:      string | null
  price:        number
  qty:          number
  note?:        string
  /** Set when this line is an add-on attached to another line, rather than an orderable menu item on its own. */
  parentLineId?: string
  /** The menu category this item was ordered from (e.g. "signature", "espresso") — absent for add-ons. */
  categoryId?:  string
}

export interface SaleDiscountInput {
  lineId: string
  name:   string
  amount: number
}

export const MAX_PRICE = 1_000_000
export const MAX_QTY   = 1_000
/** Lines in one order, counting any added later. */
export const MAX_ITEMS = 50
// Every line can carry both discount kinds, plus the two whole-order rows.
export const MAX_DISCOUNTS = MAX_ITEMS * 2 + 2
/** The customer name, stored as the sale's notes. */
export const MAX_NOTES_LENGTH = 100

/** A peso amount: a finite number from 0 to MAX_PRICE. */
export function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= MAX_PRICE
}

export function isValidSaleItem(item: unknown): item is SaleItemInput {
  if (!item || typeof item !== 'object') return false
  const i = item as Record<string, unknown>
  if (typeof i.lineId !== 'string' || i.lineId.length > 100) return false
  if (typeof i.name !== 'string' || i.name.length === 0 || i.name.length > 200) return false
  if (!isValidAmount(i.price)) return false
  // Whole units only: quantities also count loyalty stamps.
  if (typeof i.qty !== 'number' || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > MAX_QTY) return false
  if (typeof i.variant === 'string' && i.variant.length > 100) return false
  if (i.note !== undefined && (typeof i.note !== 'string' || i.note.length > 200)) return false
  if (i.parentLineId !== undefined && (typeof i.parentLineId !== 'string' || i.parentLineId.length > 100)) return false
  if (i.categoryId !== undefined && (typeof i.categoryId !== 'string' || i.categoryId.length > 100)) return false
  return (typeof i.variant === 'string' || i.variant === null)
}

export function isValidDiscountRows(rows: unknown): rows is SaleDiscountInput[] {
  if (!Array.isArray(rows) || rows.length > MAX_DISCOUNTS) return false
  return rows.every((d: unknown) => {
    if (!d || typeof d !== 'object') return false
    const dd = d as Record<string, unknown>
    if (typeof dd.lineId !== 'string' || dd.lineId.length > 100) return false
    if (typeof dd.name !== 'string' || dd.name.length === 0 || dd.name.length > 200) return false
    return isValidAmount(dd.amount)
  })
}

export function isValidNotes(notes: unknown): notes is string {
  return typeof notes === 'string' && notes.length <= MAX_NOTES_LENGTH
}

/**
 * A line as Sanity stores it, keyed by its line id. Only a line with a parent is an add-on;
 * `addedAt` marks a line added to the order after it was first saved.
 */
export function toSaleItemDoc(item: SaleItemInput, addedAt?: string) {
  return {
    _type:   'saleItem' as const,
    _key:    item.lineId,
    lineId:  item.lineId,
    name:    item.name,
    variant: item.variant ?? null,
    price:   item.price,
    qty:     item.qty,
    ...(item.note ? { note: item.note } : {}),
    ...(item.parentLineId ? { isAddon: true, parentLineId: item.parentLineId } : {}),
    ...(item.categoryId ? { categoryId: item.categoryId } : {}),
    ...(addedAt ? { addedAt } : {}),
  }
}
