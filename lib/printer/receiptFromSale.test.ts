import { describe, it, expect } from 'vitest'
import type { Sale } from '@/app/pos/types'
import type { SalePayload } from '@/app/pos/salePayload'
import { buildCheckoutReceiptBlocks, buildReceiptBlocksFromSale } from './receiptFromSale'

// What checkout posts: two lattes with an attached shot and a PWD SOLO discount,
// a croissant, and an oat milk added on its own (no parent line).
// Subtotal 300 + 30 + 80 + 40 = 450; PWD SOLO (330 / 2) × 0.20 = 33; total 417.
const payload: SalePayload = {
  total: 417,
  paymentAmount: 500,
  subtotal: 450,
  items: [
    { lineId: 'latte__ice', name: 'Spanish Latte', variant: 'ice', price: 150, qty: 2, note: 'Less sweet', categoryId: 'signature', discounts: { pwd: 'solo' } },
    { lineId: 'addon__shot__latte__ice', name: 'Espresso Shot', variant: null, price: 30, qty: 1, parentLineId: 'latte__ice' },
    { lineId: 'croissant__fixed', name: 'Croissant', variant: null, price: 80, qty: 1, categoryId: 'pastry' },
    { lineId: 'addon__oat', name: 'Oat Milk', variant: null, price: 40, qty: 1 },
  ],
  discounts: [{ lineId: 'latte__ice', name: 'PWD Drink -20% x1 (Spanish Latte)', amount: 33 }],
  notes: 'Ana',
}

// The record POST /api/sales stores for that body (see app/api/sales/route.ts):
// only a line with a parent is flagged as an add-on, and change is payment − total.
const stored: Sale = {
  _id: 'sale-1',
  _createdAt: '2026-10-01T14:41:00.000Z',
  total: 417,
  paymentAmount: 500,
  change: 83,
  subtotal: 450,
  notes: 'Ana',
  discounts: [{ lineId: 'latte__ice', name: 'PWD Drink -20% x1 (Spanish Latte)', amount: 33 }],
  items: [
    { lineId: 'latte__ice', name: 'Spanish Latte', variant: 'ice', price: 150, qty: 2, note: 'Less sweet', categoryId: 'signature' },
    { lineId: 'addon__shot__latte__ice', name: 'Espresso Shot', variant: null, price: 30, qty: 1, isAddon: true, parentLineId: 'latte__ice' },
    { lineId: 'croissant__fixed', name: 'Croissant', variant: null, price: 80, qty: 1, categoryId: 'pastry' },
    { lineId: 'addon__oat', name: 'Oat Milk', variant: null, price: 40, qty: 1 },
  ],
}

const savedAt = new Date(stored._createdAt)

describe('buildReceiptBlocksFromSale', () => {
  it('reprints a sale saved with a whole-order "(Total items)" row exactly as stored', () => {
    // The POS no longer offers whole-order discounts, but sales saved while it did keep this row.
    const legacy: Sale = { ...stored, discounts: [{ lineId: 'order:pwd', name: 'PWD/Senior -20% (Total items)', amount: 90 }] }
    expect(buildReceiptBlocksFromSale(legacy, 'customer')).toContainEqual(
      { kind: 'total', label: 'PWD/Senior -20% (Total items)', value: 90, isDiscount: true },
    )
  })
})

describe('buildCheckoutReceiptBlocks', () => {
  it('matches what Sales history’s "Print" rebuilds from the stored sale, given the same time', () => {
    expect(buildCheckoutReceiptBlocks(payload, savedAt)).toEqual(buildReceiptBlocksFromSale(stored, 'customer'))
  })

  it('is the full customer copy: logo, priced lines, discount, payment and change', () => {
    const blocks = buildCheckoutReceiptBlocks(payload, savedAt)
    expect(blocks[0]).toEqual({ kind: 'logo', fallbackText: 'unwnd. cafe' })
    expect(blocks).toContainEqual({ kind: 'detail', label: 'Name', value: 'Ana' })
    expect(blocks).toContainEqual({ kind: 'item', name: 'Spanish Latte', variant: 'ice', qty: 2, lineTotal: 300 })
    expect(blocks).toContainEqual({ kind: 'total', label: 'PWD Drink -20% x1 (Spanish Latte)', value: 33, isDiscount: true })
    expect(blocks).toContainEqual({ kind: 'total', label: 'Change', value: 83 })
  })

  it('counts the attached shot out of Items but the standalone oat milk in', () => {
    // 2 lattes + 1 croissant + 1 oat milk; the shot rides on a latte.
    expect(buildCheckoutReceiptBlocks(payload, savedAt)).toContainEqual({ kind: 'detail', label: 'Items', value: '4' })
  })
})
