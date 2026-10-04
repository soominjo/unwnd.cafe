import type { Sale } from '@/app/pos/types'
import type { SalePayload } from '@/app/pos/salePayload'
import { saleRounds } from '@/lib/sales/rounds'
import { buildReceiptDocument, type ReceiptAudience, type ReceiptBlock, type ReceiptDiscountInput } from './receiptDocument'

/**
 * What a staff ticket covers: the whole order, or only the items added to it last (Add items
 * on Sales), so the kitchen makes only those.
 */
export type TicketScope = 'all' | 'latest'

// Rebuilds the exact same ReceiptBlock[] a live checkout would have produced,
// from a saved Sale record — used to reprint/re-download a receipt from sales
// history without duplicating any printing logic. Sales saved before
// subtotal/discounts/per-item notes were persisted fall back gracefully
// (no discount line, no per-item note) rather than erroring.
export function buildReceiptBlocksFromSale(sale: Sale, audience: ReceiptAudience = 'kitchen', scope: TicketScope = 'all'): ReceiptBlock[] {
  const discounts: ReceiptDiscountInput[] = (sale.discounts ?? []).map((d) => ({
    label: d.name,
    amount: d.amount,
  }))
  // A staff ticket of the latest added items, when the order has some.
  const rounds = saleRounds(sale.items)
  const latest = rounds[rounds.length - 1]
  const addedAt = scope === 'latest' && audience === 'kitchen' ? latest?.addedAt ?? null : null
  const items = addedAt ? latest.items : sale.items

  return buildReceiptDocument({
    timestamp: new Date(addedAt ?? sale._createdAt),
    ...(addedAt ? { addedTo: new Date(sale._createdAt) } : {}),
    items: items.map((item) => ({
      name: item.name,
      variant: item.variant,
      qty: item.qty,
      lineTotal: item.price * item.qty,
      note: item.note,
      isAddon: item.isAddon,
    })),
    subtotal: sale.subtotal ?? sale.total,
    discounts,
    total: sale.total,
    paymentAmount: sale.paymentAmount,
    change: sale.change,
    // The POS stores the customer's name in the sale's notes field.
    customerName: sale.notes,
    audience,
  })
}

// The customer receipt (or the staff ticket) for a sale checkout has just saved,
// built from the body POST /api/sales accepted. Mapped the way the route stores
// that body — only a line with a parent is an add-on, change is payment minus
// total — so its lines and totals match a later reprint of the sale. The printed
// time is `savedAt` (the tablet's clock), not the stored _createdAt.
export function buildCheckoutReceiptBlocks(payload: SalePayload, savedAt: Date, audience: ReceiptAudience = 'customer'): ReceiptBlock[] {
  return buildReceiptDocument({
    timestamp: savedAt,
    items: payload.items.map((item) => ({
      name: item.name,
      variant: item.variant,
      qty: item.qty,
      lineTotal: item.price * item.qty,
      note: item.note,
      isAddon: Boolean(item.parentLineId),
    })),
    subtotal: payload.subtotal,
    discounts: (payload.discounts ?? []).map((d) => ({ label: d.name, amount: d.amount })),
    total: payload.total,
    paymentAmount: payload.paymentAmount,
    change: payload.paymentAmount - payload.total,
    customerName: payload.notes,
    audience,
  })
}

/** What the preview after a sale offers to print, each on its own: the customer's receipt and the kitchen ticket. */
export interface SalePrints {
  receipt: ReceiptBlock[]
  /** The staff ticket for the kitchen: items only, no prices. */
  kitchen: ReceiptBlock[]
}

/** "Complete + Print": the receipt and the kitchen ticket of a checkout just saved. */
export function buildCheckoutPrints(payload: SalePayload, savedAt: Date): SalePrints {
  return { receipt: buildCheckoutReceiptBlocks(payload, savedAt), kitchen: buildCheckoutReceiptBlocks(payload, savedAt, 'kitchen') }
}

/**
 * "Save + Print" after Add items: the whole order's receipt, and a kitchen ticket of only the
 * items just added, so the bar makes only those.
 */
export function buildAddedItemsPrints(sale: Sale): SalePrints {
  return { receipt: buildReceiptBlocksFromSale(sale, 'customer'), kitchen: buildReceiptBlocksFromSale(sale, 'kitchen', 'latest') }
}
