import { describe, it, expect } from 'vitest'
import type { OrderItem, DiscountLine } from './types'
import { buildSalePayload } from './salePayload'

const items: OrderItem[] = [
  { lineId: 'a', name: 'Spanish Latte', variant: 'ice', price: 150, qty: 2, discount: 'review' },
  { lineId: 'b', name: 'Croissant', variant: null, price: 100, qty: 1, discount: 'pwd' },
]

const discountLines: DiscountLine[] = [
  { lineId: 'a', name: 'Spanish Latte', amount: 30, kind: 'review', label: 'Google Review −10%' },
  { lineId: 'b', name: 'Croissant', amount: 20, kind: 'pwd', label: 'PWD Food −20%' },
]

const args = { items, discountLines, subtotal: 400, grandTotal: 350, payment: 500, notes: ' Ana ' }

describe('buildSalePayload', () => {
  it('posts the discounted total, the pre-discount subtotal and the items as-is', () => {
    const body = buildSalePayload(args)
    expect(body.total).toBe(350)
    expect(body.subtotal).toBe(400)
    expect(body.paymentAmount).toBe(500)
    expect(body.items).toBe(items)
  })

  it('pre-formats each discount with its persisted (receipt) name, one row per line', () => {
    const body = buildSalePayload(args)
    expect(body.discounts).toEqual([
      { lineId: 'a', name: 'Google Review -10% (Spanish Latte)', amount: 30 },
      { lineId: 'b', name: 'PWD Food -20% (Croissant)', amount: 20 },
    ])
    expect(new Set(body.discounts!.map(d => d.lineId)).size).toBe(body.discounts!.length)
  })

  it('omits discounts entirely when there are none', () => {
    expect('discounts' in buildSalePayload({ ...args, discountLines: [] })).toBe(false)
  })

  it('treats a missing payment as paying the exact total', () => {
    expect(buildSalePayload({ ...args, payment: null }).paymentAmount).toBe(350)
  })

  it('trims the customer name and omits it when blank', () => {
    expect(buildSalePayload(args).notes).toBe('Ana')
    expect('notes' in buildSalePayload({ ...args, notes: '   ' })).toBe(false)
  })
})
