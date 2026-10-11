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

const args = {
  items,
  discountLines,
  subtotal: 400,
  grandTotal: 340,
  orderType: 'dine-in' as const,
  payments: [{ method: 'cash' as const, amount: 340, received: 500 }],
  notes: ' Ana ',
}

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

  it('posts where it is eaten and each payment as checked on the review screen', () => {
    const body = buildSalePayload({ ...args, orderType: 'take-out' })
    expect(body.orderType).toBe('take-out')
    expect(body.payments).toEqual([{ method: 'cash', amount: 340, received: 500 }])
  })

  it('counts what was handed over: cash as received, the e-wallet part exactly', () => {
    const payments = [{ method: 'ewallet' as const, amount: 200 }, { method: 'cash' as const, amount: 140, received: 200 }]
    expect(buildSalePayload({ ...args, payments }).paymentAmount).toBe(400)
  })

  it('sends no payment for a ₱0 order, paid in full by a loyalty free drink', () => {
    const body = buildSalePayload({ ...args, grandTotal: 0, payments: [] })
    expect(body.payments).toEqual([])
    expect(body.paymentAmount).toBe(0)
  })

  it('trims the customer name and omits it when blank', () => {
    expect(buildSalePayload(args).notes).toBe('Ana')
    expect('notes' in buildSalePayload({ ...args, notes: '   ' })).toBe(false)
  })
})

describe('buildSalePayload with a loyalty card', () => {
  it('links the order to the card holder and lists the rewards used', () => {
    const body = buildSalePayload({ ...args, loyalty: { memberId: 'kylene-id', rewards: ['ten'] } })
    expect(body.loyaltyMemberId).toBe('kylene-id')
    expect(body.loyaltyRewards).toEqual(['ten'])
  })

  it('leaves loyalty out entirely when no card holder is linked', () => {
    const body = buildSalePayload({ ...args, loyalty: null })
    expect('loyaltyMemberId' in body).toBe(false)
    expect('loyaltyRewards' in body).toBe(false)
  })

  it('saves the loyalty rows under their receipt names', () => {
    const rows: DiscountLine[] = [
      { lineId: 'a', name: 'Spanish Latte', amount: 30, kind: 'loyalty', scope: 'all', label: 'Loyalty −10% ×2' },
      { lineId: 'b', name: 'Cafe Latte', amount: 120, kind: 'free', scope: 'solo', label: 'Loyalty free drink' },
    ]
    expect(buildSalePayload({ ...args, discountLines: rows }).discounts).toEqual([
      { lineId: 'a', name: 'Loyalty -10% x2 (Spanish Latte)', amount: 30 },
      { lineId: 'b', name: 'Loyalty free drink (Cafe Latte)', amount: 120 },
    ])
  })
})
