import { describe, it, expect } from 'vitest'
import type { OrderItem } from './types'
import {
  DISCOUNT_LABELS,
  attachedAddonsTotal,
  lineDiscountAmount,
  discountRowLabel,
  buildDiscountLines,
  totalDiscount,
  savedDiscountName,
  toggleLineDiscount,
  isReviewEligible,
  allEligibleHaveReview,
  toggleReviewForAll,
} from './discounts'

const item = (over: Partial<OrderItem> & { lineId: string }): OrderItem =>
  ({ name: 'Spanish Latte', variant: 'ice', price: 150, qty: 1, ...over })

const addon = (parentLineId: string, price: number, qty = 1): OrderItem =>
  ({ lineId: `addon__${parentLineId}-${price}`, name: 'Extra Shot', variant: null, price, qty, parentLineId })

describe('attachedAddonsTotal', () => {
  it('sums price × qty of the add-ons attached to the line', () => {
    const items = [item({ lineId: 'a' }), addon('a', 20, 2), addon('b', 15)]
    expect(attachedAddonsTotal(items, 'a')).toBe(40)
  })

  it('is 0 for a line with no add-ons', () => {
    expect(attachedAddonsTotal([item({ lineId: 'a' })], 'a')).toBe(0)
  })
})

describe('lineDiscountAmount', () => {
  it('PWD takes 20% of one unit plus add-ons, ignoring extra quantity', () => {
    // (150 + 20) × 0.20 = 34 — the second latte stays full price
    expect(lineDiscountAmount(item({ lineId: 'a', price: 150, qty: 2 }), 20, 'pwd')).toBe(34)
  })

  it('review takes 10% of the whole line plus add-ons', () => {
    // (150 × 2 + 20) × 0.10 = 32
    expect(lineDiscountAmount(item({ lineId: 'a', price: 150, qty: 2 }), 20, 'review')).toBe(32)
  })

  it('rounds half a peso up', () => {
    // 125 × 0.10 = 12.5 → 13
    expect(lineDiscountAmount(item({ lineId: 'a', price: 125, qty: 1 }), 0, 'review')).toBe(13)
  })
})

describe('discountRowLabel', () => {
  it('splits PWD into Food (no variant) and Drink (hot/ice)', () => {
    expect(discountRowLabel('pwd', item({ lineId: 'a', variant: null }))).toBe('PWD Food −20%')
    expect(discountRowLabel('pwd', item({ lineId: 'a', variant: 'hot' }))).toBe('PWD Drink −20%')
  })

  it('uses one label for the review promo whatever the item', () => {
    expect(discountRowLabel('review', item({ lineId: 'a', variant: null }))).toBe('Google Review −10%')
    expect(discountRowLabel('review', item({ lineId: 'a', variant: 'ice' }))).toBe(DISCOUNT_LABELS.review)
  })
})

describe('buildDiscountLines', () => {
  it('returns one row per discounted line, in order-line order, with add-ons included', () => {
    const items = [
      item({ lineId: 'a', name: 'Latte', variant: 'hot', price: 150, qty: 2, discount: 'review' }),
      addon('a', 20),
      item({ lineId: 'b', name: 'Croissant', variant: null, price: 100, qty: 1 }),
      item({ lineId: 'c', name: 'Mocha', variant: 'ice', price: 170, qty: 1, discount: 'pwd' }),
    ]
    expect(buildDiscountLines(items)).toEqual([
      { lineId: 'a', name: 'Latte', amount: 32, kind: 'review', label: 'Google Review −10%' },
      { lineId: 'c', name: 'Mocha', amount: 34, kind: 'pwd', label: 'PWD Drink −20%' },
    ])
  })

  it('never gives an add-on line a row of its own, even if flagged', () => {
    const items = [item({ lineId: 'a' }), { ...addon('a', 20), discount: 'review' as const }]
    expect(buildDiscountLines(items)).toEqual([])
  })

  it('is empty when nothing is discounted', () => {
    expect(buildDiscountLines([item({ lineId: 'a' })])).toEqual([])
  })
})

describe('totalDiscount', () => {
  it('sums the row amounts', () => {
    expect(totalDiscount([
      { lineId: 'a', name: 'Latte', amount: 32, kind: 'review', label: 'Google Review −10%' },
      { lineId: 'c', name: 'Mocha', amount: 34, kind: 'pwd', label: 'PWD Drink −20%' },
    ])).toBe(66)
  })
})

describe('savedDiscountName', () => {
  it('keeps the receipt convention: ASCII hyphen, item name in parentheses', () => {
    expect(savedDiscountName({ lineId: 'a', name: 'Spanish Latte', amount: 32, kind: 'review', label: 'Google Review −10%' }))
      .toBe('Google Review -10% (Spanish Latte)')
    expect(savedDiscountName({ lineId: 'c', name: 'Mocha', amount: 34, kind: 'pwd', label: 'PWD Drink −20%' }))
      .toBe('PWD Drink -20% (Mocha)')
  })
})

describe('toggleLineDiscount', () => {
  const items = [item({ lineId: 'a' }), item({ lineId: 'b', discount: 'pwd' })]

  it('puts the kind on a line that had none, without touching the original array', () => {
    const next = toggleLineDiscount(items, 'a', 'review')
    expect(next[0].discount).toBe('review')
    expect(items[0].discount).toBeUndefined()
    expect(next).not.toBe(items)
  })

  it('clears the discount when the line already has that kind', () => {
    expect(toggleLineDiscount(items, 'b', 'pwd')[1].discount).toBeUndefined()
  })

  it('replaces PWD with review rather than stacking them', () => {
    expect(toggleLineDiscount(items, 'b', 'review')[1].discount).toBe('review')
  })

  it('leaves every other line as it was', () => {
    expect(toggleLineDiscount(items, 'a', 'review')[1]).toBe(items[1])
  })
})

describe('isReviewEligible', () => {
  it('accepts an orderable line with no discount or with the review discount', () => {
    expect(isReviewEligible(item({ lineId: 'a' }))).toBe(true)
    expect(isReviewEligible(item({ lineId: 'a', discount: 'review' }))).toBe(true)
  })

  it('rejects a PWD line and any add-on line', () => {
    expect(isReviewEligible(item({ lineId: 'a', discount: 'pwd' }))).toBe(false)
    expect(isReviewEligible(addon('a', 20))).toBe(false)
  })
})

describe('allEligibleHaveReview', () => {
  it('is false with no eligible lines at all', () => {
    expect(allEligibleHaveReview([])).toBe(false)
    expect(allEligibleHaveReview([item({ lineId: 'a', discount: 'pwd' })])).toBe(false)
  })

  it('is true only when every eligible line has the review discount', () => {
    expect(allEligibleHaveReview([
      item({ lineId: 'a', discount: 'review' }),
      item({ lineId: 'b', discount: 'pwd' }),
      addon('a', 20),
    ])).toBe(true)
    expect(allEligibleHaveReview([item({ lineId: 'a', discount: 'review' }), item({ lineId: 'b' })])).toBe(false)
  })
})

describe('toggleReviewForAll', () => {
  const items = [
    item({ lineId: 'a' }),
    item({ lineId: 'b', discount: 'pwd' }),
    addon('a', 20),
    item({ lineId: 'c', discount: 'review' }),
  ]

  it('gives every eligible line the review discount and leaves PWD and add-on lines alone', () => {
    expect(toggleReviewForAll(items).map(i => i.discount)).toEqual(['review', 'pwd', undefined, 'review'])
  })

  it('clears the review discount from all of them once they all have it, keeping PWD lines', () => {
    const allOn = toggleReviewForAll(items)
    expect(toggleReviewForAll(allOn).map(i => i.discount)).toEqual([undefined, 'pwd', undefined, undefined])
  })
})
