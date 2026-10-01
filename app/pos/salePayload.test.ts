import { describe, it, expect } from 'vitest'
import type { OrderItem, DiscountLine } from './types'
import { buildSalePayload } from './salePayload'

const items: OrderItem[] = [
  { lineId: 'a', name: 'Spanish Latte', variant: 'ice', price: 150, qty: 2, discounts: { pwd: 'solo', review: 'all' } },
  { lineId: 'b', name: 'Croissant', variant: null, price: 100, qty: 1 },
]

// A stacked line: both kinds on the latte.
const discountLines: DiscountLine[] = [
  { lineId: 'a', name: 'Spanish Latte', amount: 30, kind: 'pwd', scope: 'solo', label: 'PWD Drink −20% ×1' },
  { lineId: 'a', name: 'Spanish Latte', amount: 30, kind: 'review', scope: 'all', label: 'Google Review −10% ×2' },
]

const args = { items, discountLines, subtotal: 400, grandTotal: 340, payment: 500, notes: ' Ana ' }

describe('buildSalePayload', () => {
  it('posts the discounted total, the pre-discount subtotal and the items as-is', () => {
    const body = buildSalePayload(args)
    expect(body.total).toBe(340)
    expect(body.subtotal).toBe(400)
    expect(body.paymentAmount).toBe(500)
    expect(body.items).toBe(items)
  })

  it('pre-formats every discount row with its persisted (receipt) name, keeping stacked rows on one line', () => {
    expect(buildSalePayload(args).discounts).toEqual([
      { lineId: 'a', name: 'PWD Drink -20% x1 (Spanish Latte)', amount: 30 },
      { lineId: 'a', name: 'Google Review -10% x2 (Spanish Latte)', amount: 30 },
    ])
  })

  it('omits discounts entirely when there are none', () => {
    expect('discounts' in buildSalePayload({ ...args, discountLines: [] })).toBe(false)
  })

  it('treats a missing payment as paying the exact total', () => {
    expect(buildSalePayload({ ...args, payment: null }).paymentAmount).toBe(340)
  })

  it('trims the customer name and omits it when blank', () => {
    expect(buildSalePayload(args).notes).toBe('Ana')
    expect('notes' in buildSalePayload({ ...args, notes: '   ' })).toBe(false)
  })
})
