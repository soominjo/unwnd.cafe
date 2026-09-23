import type { DiscountLine, LineDiscount, OrderItem } from './types'
import { savedDiscountName } from './discounts'

/** The body `POST /api/sales` accepts — mirrors `SaleInput` in app/api/sales/route.ts. */
export interface SalePayload {
  total: number
  paymentAmount: number
  items: OrderItem[]
  subtotal: number
  discounts?: LineDiscount[]
  notes?: string
}

interface SalePayloadArgs {
  items: OrderItem[]
  discountLines: DiscountLine[]
  /** Pre-discount total. */
  subtotal: number
  /** What the customer owes after discounts. */
  grandTotal: number
  /** null when the cashier never entered a payment — treated as paying the exact total. */
  payment: number | null
  /** The customer-name field; the POS stores it as the sale's notes. */
  notes: string
}

// Discount names are pre-formatted here so the persisted record and any later
// reprint from sales history show the identical label. The API ignores the
// client-only `discounts` field on each item.
export function buildSalePayload({ items, discountLines, subtotal, grandTotal, payment, notes }: SalePayloadArgs): SalePayload {
  const discounts: LineDiscount[] = discountLines.map(d => ({ lineId: d.lineId, name: savedDiscountName(d), amount: d.amount }))
  const trimmedNotes = notes.trim()
  return {
    total: grandTotal,
    paymentAmount: payment ?? grandTotal,
    items,
    subtotal,
    ...(discounts.length > 0 ? { discounts } : {}),
    ...(trimmedNotes ? { notes: trimmedNotes } : {}),
  }
}
