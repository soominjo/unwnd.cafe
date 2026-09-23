import { describe, it, expect } from 'vitest'
import type { OrderItem, OrderDiscounts } from './types'
import {
  attachedAddonsTotal,
  unitsDiscounted,
  lineDiscountAmount,
  orderDiscountAmount,
  discountRowLabel,
  discountBadge,
  hasLineDiscount,
  buildDiscountLines,
  totalDiscount,
  savedDiscountName,
  pickLineDiscount,
  toggleOrderDiscount,
} from './discounts'

const item = (over: Partial<OrderItem> & { lineId: string }): OrderItem =>
  ({ name: 'Spanish Latte', variant: 'ice', price: 150, qty: 1, ...over })

const addon = (parentLineId: string, price: number, qty = 1): OrderItem =>
  ({ lineId: `addon__${parentLineId}-${price}`, name: 'Extra Shot', variant: null, price, qty, parentLineId })

const none: OrderDiscounts = {}

describe('attachedAddonsTotal', () => {
  it('sums price × qty of the add-ons attached to the line', () => {
    const items = [item({ lineId: 'a' }), addon('a', 20, 2), addon('b', 15)]
    expect(attachedAddonsTotal(items, 'a')).toBe(40)
  })

  it('is 0 for a line with no add-ons', () => {
    expect(attachedAddonsTotal([item({ lineId: 'a' })], 'a')).toBe(0)
  })
})

describe('unitsDiscounted', () => {
  it('SOLO covers one unit however many were ordered; ALL covers the whole quantity', () => {
    expect(unitsDiscounted(item({ lineId: 'a', qty: 4 }), 'solo')).toBe(1)
    expect(unitsDiscounted(item({ lineId: 'a', qty: 4 }), 'all')).toBe(4)
  })
})

describe('lineDiscountAmount', () => {
  const four = item({ lineId: 'a', price: 150, qty: 4 })

  it('ALL takes the rate off the whole line plus its add-ons', () => {
    // (150 × 4 + 60) × 0.20 = 132
    expect(lineDiscountAmount(four, 60, 'pwd', 'all')).toBe(132)
    // 660 × 0.10 = 66
    expect(lineDiscountAmount(four, 60, 'review', 'all')).toBe(66)
  })

  it("SOLO takes the rate off one unit's share of that same base, add-ons included", () => {
    // 660 / 4 = 165 → × 0.20 = 33
    expect(lineDiscountAmount(four, 60, 'pwd', 'solo')).toBe(33)
    // 165 × 0.10 = 16.5 → 17
    expect(lineDiscountAmount(four, 60, 'review', 'solo')).toBe(17)
  })

  it('gives SOLO and ALL the same amount when only one was ordered', () => {
    const one = item({ lineId: 'a', price: 125, qty: 1 })
    expect(lineDiscountAmount(one, 0, 'review', 'solo')).toBe(13)
    expect(lineDiscountAmount(one, 0, 'review', 'all')).toBe(13)
  })

  it('never loses a peso to floating point on ALL with an awkward quantity', () => {
    // (10 × 11 + 75) × 0.10 = 18.5 → 19. Dividing by 11 and multiplying back gives 184.999… and would round to 18.
    expect(lineDiscountAmount(item({ lineId: 'a', price: 10, qty: 11 }), 75, 'review', 'all')).toBe(19)
  })
})

describe('orderDiscountAmount', () => {
  it('takes the rate off the whole pre-discount subtotal, rounding half a peso up', () => {
    expect(orderDiscountAmount(620, 'pwd')).toBe(124)
    expect(orderDiscountAmount(625, 'review')).toBe(63)
  })
})

describe('labels', () => {
  it('keeps the PWD Food/Drink row split and adds the unit count only when more than one was ordered', () => {
    expect(discountRowLabel('pwd', item({ lineId: 'a', variant: null, qty: 1 }), 'all')).toBe('PWD Food −20%')
    expect(discountRowLabel('pwd', item({ lineId: 'a', variant: 'hot', qty: 4 }), 'solo')).toBe('PWD Drink −20% ×1')
    expect(discountRowLabel('review', item({ lineId: 'a', qty: 4 }), 'all')).toBe('Google Review −10% ×4')
  })

  it('badges use the customer-facing names with the same unit count', () => {
    expect(discountBadge('pwd', item({ lineId: 'a', qty: 4 }), 'solo')).toBe('PWD/Senior −20% ×1')
    expect(discountBadge('review', item({ lineId: 'a', qty: 1 }), 'all')).toBe('Google Review −10%')
  })
})

describe('hasLineDiscount', () => {
  it('is true only when the line carries at least one kind', () => {
    expect(hasLineDiscount(item({ lineId: 'a' }))).toBe(false)
    expect(hasLineDiscount(item({ lineId: 'a', discounts: {} }))).toBe(false)
    expect(hasLineDiscount(item({ lineId: 'a', discounts: { review: 'solo' } }))).toBe(true)
  })
})

describe('buildDiscountLines', () => {
  const items = [
    item({ lineId: 'a', name: 'Latte', variant: 'hot', price: 150, qty: 2, discounts: { pwd: 'solo', review: 'all' } }),
    addon('a', 20),
    item({ lineId: 'b', name: 'Croissant', variant: null, price: 100, qty: 1 }),
    item({ lineId: 'c', name: 'Mocha', variant: 'ice', price: 170, qty: 1, discounts: { pwd: 'all' } }),
  ]

  it('emits one row per discount on each line, PWD before review, in order-line order', () => {
    // Latte line base 300 + 20 = 320: solo share 160 → 32; review on all 320 → 32. Mocha 170 → 34.
    expect(buildDiscountLines(items, none)).toEqual([
      { lineId: 'a', name: 'Latte', amount: 32, kind: 'pwd', scope: 'solo', label: 'PWD Drink −20% ×1' },
      { lineId: 'a', name: 'Latte', amount: 32, kind: 'review', scope: 'all', label: 'Google Review −10% ×2' },
      { lineId: 'c', name: 'Mocha', amount: 34, kind: 'pwd', scope: 'all', label: 'PWD Drink −20%' },
    ])
  })

  it('appends whole-order rows after the line rows, each computed on the full subtotal', () => {
    // subtotal = 300 + 20 + 100 + 170 = 590
    const plain = items.map(i => ({ ...i, discounts: undefined }))
    expect(buildDiscountLines(plain, { pwd: true, review: true })).toEqual([
      { lineId: 'order:pwd', name: 'Total items', amount: 118, kind: 'pwd', scope: 'order', label: 'PWD/Senior −20%' },
      { lineId: 'order:review', name: 'Total items', amount: 59, kind: 'review', scope: 'order', label: 'Google Review −10%' },
    ])
  })

  it('puts line rows before the whole-order rows when both exist', () => {
    const rows = buildDiscountLines(items, { review: true })
    expect(rows.map(r => r.lineId)).toEqual(['a', 'a', 'c', 'order:review'])
  })

  it('never gives an add-on line a row of its own, even if flagged', () => {
    const flagged = [item({ lineId: 'a' }), { ...addon('a', 20), discounts: { review: 'all' as const } }]
    expect(buildDiscountLines(flagged, none)).toEqual([])
  })

  it('is empty when nothing is discounted', () => {
    expect(buildDiscountLines([item({ lineId: 'a' })], none)).toEqual([])
  })

  it('emits no whole-order rows for an empty order, even with a Total button still on', () => {
    expect(buildDiscountLines([], { pwd: true, review: true })).toEqual([])
  })
})

describe('totalDiscount', () => {
  it('sums the row amounts', () => {
    expect(totalDiscount([
      { lineId: 'a', name: 'Latte', amount: 32, kind: 'review', scope: 'all', label: 'Google Review −10%' },
      { lineId: 'order:pwd', name: 'Total items', amount: 118, kind: 'pwd', scope: 'order', label: 'PWD/Senior −20%' },
    ])).toBe(150)
  })
})

describe('savedDiscountName', () => {
  it('keeps the receipt convention: ASCII hyphen and x, the item or "Total items" in parentheses', () => {
    expect(savedDiscountName({ lineId: 'a', name: 'Latte', amount: 32, kind: 'pwd', scope: 'solo', label: 'PWD Drink −20% ×1' }))
      .toBe('PWD Drink -20% x1 (Latte)')
    expect(savedDiscountName({ lineId: 'order:review', name: 'Total items', amount: 59, kind: 'review', scope: 'order', label: 'Google Review −10%' }))
      .toBe('Google Review -10% (Total items)')
  })
})

describe('pickLineDiscount', () => {
  const sel = { items: [item({ lineId: 'a' }), item({ lineId: 'b', discounts: { pwd: 'solo' } })], order: none }

  it('sets the kind at the chosen scope without touching the original arrays or other lines', () => {
    const next = pickLineDiscount(sel, 'a', 'review', 'all')
    expect(next.items[0].discounts).toEqual({ review: 'all' })
    expect(sel.items[0].discounts).toBeUndefined()
    expect(next.items[1]).toBe(sel.items[1])
  })

  it('switches scope when the kind is already on the line at the other scope', () => {
    expect(pickLineDiscount(sel, 'b', 'pwd', 'all').items[1].discounts).toEqual({ pwd: 'all' })
  })

  it('stacks PWD and review on one line, and clears just the kind whose active chip is tapped again', () => {
    const both = pickLineDiscount(sel, 'b', 'review', 'solo')
    expect(both.items[1].discounts).toEqual({ pwd: 'solo', review: 'solo' })
    expect(pickLineDiscount(both, 'b', 'pwd', 'solo').items[1].discounts).toEqual({ review: 'solo' })
  })

  it('leaves the line without a discounts field once its last kind is cleared', () => {
    expect(pickLineDiscount(sel, 'b', 'pwd', 'solo').items[1].discounts).toBeUndefined()
  })

  it('takes the same kind off the whole-order total — a kind applies per line or to the total, not both', () => {
    const withOrder = { ...sel, order: { pwd: true, review: true } as OrderDiscounts }
    expect(pickLineDiscount(withOrder, 'a', 'pwd', 'all').order).toEqual({ review: true })
  })

  it('leaves the whole-order toggles alone when only clearing a line kind', () => {
    const withOrder = { ...sel, order: { review: true } as OrderDiscounts }
    expect(pickLineDiscount(withOrder, 'b', 'pwd', 'solo').order).toEqual({ review: true })
  })

  it('does nothing for an unknown line', () => {
    expect(pickLineDiscount(sel, 'zzz', 'pwd', 'all')).toBe(sel)
  })
})

describe('toggleOrderDiscount', () => {
  const sel = {
    items: [item({ lineId: 'a', discounts: { pwd: 'solo', review: 'all' } }), item({ lineId: 'b', discounts: { pwd: 'all' } })],
    order: none,
  }

  it('turns a kind on for the whole order and clears that kind from every line', () => {
    const next = toggleOrderDiscount(sel, 'pwd')
    expect(next.order).toEqual({ pwd: true })
    expect(next.items.map(i => i.discounts)).toEqual([{ review: 'all' }, undefined])
    expect(sel.items[0].discounts).toEqual({ pwd: 'solo', review: 'all' })
  })

  it('turns it off again without touching the lines', () => {
    const on = toggleOrderDiscount(sel, 'pwd')
    const off = toggleOrderDiscount(on, 'pwd')
    expect(off.order).toEqual({})
    expect(off.items).toBe(on.items)
  })

  it('lets PWD and review both be on for the order at once', () => {
    expect(toggleOrderDiscount(toggleOrderDiscount(sel, 'pwd'), 'review').order).toEqual({ pwd: true, review: true })
  })
})
