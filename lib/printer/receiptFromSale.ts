import type { Sale } from '@/app/pos/types'
import type { SalePayload } from '@/app/pos/salePayload'
import { buildReceiptDocument, type ReceiptAudience, type ReceiptBlock, type ReceiptDiscountInput } from './receiptDocument'

// Rebuilds the exact same ReceiptBlock[] a live checkout would have produced,
// from a saved Sale record — used to reprint/re-download a receipt from sales
// history without duplicating any printing logic. Sales saved before
// subtotal/discounts/per-item notes were persisted fall back gracefully
// (no discount line, no per-item note) rather than erroring.
export function buildReceiptBlocksFromSale(sale: Sale, audience: ReceiptAudience = 'kitchen'): ReceiptBlock[] {
  const discounts: ReceiptDiscountInput[] = (sale.discounts ?? []).map((d) => ({
    label: d.name,
    amount: d.amount,
  }))

  return buildReceiptDocument({
    timestamp: new Date(sale._createdAt),
    items: sale.items.map((item) => ({
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

// The customer receipt for a sale checkout has just saved ("Complete + Print
// Receipt"), built from the body POST /api/sales accepted. Mapped the way the
// route stores that body — only a line with a parent is an add-on, change is
// payment minus total — so its lines and totals match a later reprint of the
// sale. The printed time is `savedAt` (the tablet's clock), not the stored _createdAt.
export function buildCheckoutReceiptBlocks(payload: SalePayload, savedAt: Date): ReceiptBlock[] {
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
    audience: 'customer',
  })
}
