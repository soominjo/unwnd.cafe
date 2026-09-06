import type { Sale } from '@/app/pos/types'
import { buildReceiptDocument, type ReceiptBlock, type ReceiptDiscountInput } from './receiptDocument'

const SHOP_NAME = 'unwnd. cafe'

// Rebuilds the exact same ReceiptBlock[] a live checkout would have produced,
// from a saved Sale record — used to reprint/re-download a receipt from sales
// history without duplicating any printing logic. Sales saved before
// subtotal/discounts/per-item notes were persisted fall back gracefully
// (no discount line, no per-item note) rather than erroring.
export function buildReceiptBlocksFromSale(sale: Sale): ReceiptBlock[] {
  const discounts: ReceiptDiscountInput[] = (sale.discounts ?? []).map((d) => ({
    label: d.name,
    amount: d.amount,
  }))

  return buildReceiptDocument({
    shopName: SHOP_NAME,
    timestamp: new Date(sale._createdAt),
    items: sale.items.map((item) => ({
      name: item.name,
      variant: item.variant,
      qty: item.qty,
      lineTotal: item.price * item.qty,
      note: item.note,
    })),
    subtotal: sale.subtotal ?? sale.total,
    discounts,
    total: sale.total,
    paymentAmount: sale.paymentAmount,
    change: sale.change,
    notes: sale.notes,
  })
}
