import { describe, it, expect } from 'vitest'
import type { OrderItem } from './types'
import {
  attachedAddonsTotal,
  unitsDiscounted,
  lineDiscountBase,
  lineDiscountAmount,
  discountRowLabel,
  discountBadge,
  lineBadges,
  hasLineDiscount,
  buildDiscountLines,
  totalDiscount,
  savedDiscountName,
  pickLineDiscount,
  withoutGoogleReview,
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

describe('lineDiscountBase', () => {
  const four = item({ lineId: 'a', price: 150, qty: 4 })

  it('is the whole line plus add-ons for ALL and one unit’s share for SOLO', () => {
    expect(lineDiscountBase(four, 60, 'all')).toBe(660)
    expect(lineDiscountBase(four, 60, 'solo')).toBe(165)
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

  it('offers short badge names for the cramped order panel', () => {
    expect(discountBadge('pwd', item({ lineId: 'a', qty: 4 }), 'solo', 'short')).toBe('PWD/S −20% ×1')
    expect(discountBadge('review', item({ lineId: 'a', qty: 4 }), 'all', 'short')).toBe('GR −10% ×4')
    expect(discountBadge('review', item({ lineId: 'a', qty: 1 }), 'all', 'short')).toBe('GR −10%')
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
    expect(buildDiscountLines(items)).toEqual([
      { lineId: 'a', name: 'Latte', amount: 32, kind: 'pwd', scope: 'solo', label: 'PWD Drink −20% ×1' },
      { lineId: 'a', name: 'Latte', amount: 32, kind: 'review', scope: 'all', label: 'Google Review −10% ×2' },
      { lineId: 'c', name: 'Mocha', amount: 34, kind: 'pwd', scope: 'all', label: 'PWD Drink −20%' },
    ])
  })

  it('never gives an add-on line a row of its own, even if flagged', () => {
    const flagged = [item({ lineId: 'a' }), { ...addon('a', 20), discounts: { review: 'all' as const } }]
    expect(buildDiscountLines(flagged)).toEqual([])
  })

  it('is empty when nothing is discounted', () => {
    expect(buildDiscountLines([item({ lineId: 'a' })])).toEqual([])
  })
})

describe('totalDiscount', () => {
  it('sums the row amounts', () => {
    expect(totalDiscount([
      { lineId: 'a', name: 'Latte', amount: 32, kind: 'review', scope: 'all', label: 'Google Review −10%' },
      { lineId: 'c', name: 'Mocha', amount: 34, kind: 'pwd', scope: 'all', label: 'PWD Drink −20%' },
    ])).toBe(66)
  })
})

describe('savedDiscountName', () => {
  it('keeps the receipt convention: ASCII hyphen and x, the item in parentheses', () => {
    expect(savedDiscountName({ lineId: 'a', name: 'Latte', amount: 32, kind: 'pwd', scope: 'solo', label: 'PWD Drink −20% ×1' }))
      .toBe('PWD Drink -20% x1 (Latte)')
    expect(savedDiscountName({ lineId: 'b', name: 'Croissant', amount: 10, kind: 'review', scope: 'all', label: 'Google Review −10%' }))
      .toBe('Google Review -10% (Croissant)')
  })
})

describe('pickLineDiscount', () => {
  const items = [item({ lineId: 'a' }), item({ lineId: 'b', discounts: { pwd: 'solo' } })]

  it('sets the kind at the chosen scope without touching the original array or other lines', () => {
    const next = pickLineDiscount(items, 'a', 'review', 'all')
    expect(next[0].discounts).toEqual({ review: 'all' })
    expect(items[0].discounts).toBeUndefined()
    expect(next[1]).toBe(items[1])
  })

  it('switches scope when the kind is already on the line at the other scope', () => {
    expect(pickLineDiscount(items, 'b', 'pwd', 'all')[1].discounts).toEqual({ pwd: 'all' })
  })

  it('stacks PWD and review on one line, and clears just the kind whose active chip is tapped again', () => {
    const both = pickLineDiscount(items, 'b', 'review', 'solo')
    expect(both[1].discounts).toEqual({ pwd: 'solo', review: 'solo' })
    expect(pickLineDiscount(both, 'b', 'pwd', 'solo')[1].discounts).toEqual({ review: 'solo' })
  })

  it('leaves the line without a discounts field once its last kind is cleared', () => {
    expect(pickLineDiscount(items, 'b', 'pwd', 'solo')[1].discounts).toBeUndefined()
  })

  it('does nothing for an unknown line', () => {
    expect(pickLineDiscount(items, 'zzz', 'pwd', 'all')).toBe(items)
  })
})

describe('loyalty rewards', () => {
  const latte = item({ lineId: 'latte', name: 'Spanish Latte', variant: 'hot', price: 130, qty: 2, categoryId: 'espresso' })
  const mocha = item({ lineId: 'mocha', name: 'Tiramisu', variant: 'ice', price: 160, qty: 1, categoryId: 'signature' })
  const shot = addon('mocha', 30)
  const off = { tenLineId: null, freeLineId: null }

  it('takes 10% off one unit of the chosen classic drink, with its add-ons paid', () => {
    const milk = addon('latte', 20)
    expect(buildDiscountLines([latte, milk, mocha, shot], { tenLineId: 'latte', freeLineId: null })).toEqual([
      // 10% of one ₱130 latte; the other latte, the milk and the Tiramisu are paid in full
      { lineId: 'latte', name: 'Spanish Latte', amount: 13, kind: 'loyalty', scope: 'solo', label: 'Loyalty −10% ×1' },
    ])
    expect(buildDiscountLines([{ ...latte, qty: 1 }], { tenLineId: 'latte', freeLineId: null })[0].label).toBe('Loyalty −10%')
  })

  it('never puts the 10% on a Signature or Matcha Series drink', () => {
    expect(buildDiscountLines([mocha], { tenLineId: 'mocha', freeLineId: null })).toEqual([])
  })

  it('is the order’s one 10%: no Google Review anywhere while it is on, and PWD/Senior stays', () => {
    const both = { ...latte, discounts: { pwd: 'solo' as const, review: 'all' as const } }
    const reviewed = { ...mocha, discounts: { review: 'solo' as const } }
    expect(buildDiscountLines([both, reviewed], { tenLineId: 'latte', freeLineId: null }).map(r => r.kind)).toEqual(['pwd', 'loyalty'])
    expect(buildDiscountLines([both, reviewed], off).map(r => r.kind)).toEqual(['pwd', 'review', 'review'])
  })

  it('puts the 10% and the free drink on two different units of one line', () => {
    expect(buildDiscountLines([latte], { tenLineId: 'latte', freeLineId: 'latte' }).map(r => [r.kind, r.amount])).toEqual([
      ['free', 130],
      ['loyalty', 13],
    ])
  })

  it('makes one unit of an Espresso or Non-Coffee line free, with other discounts on the units still paid', () => {
    const pwdLatte = { ...latte, discounts: { pwd: 'all' as const } }
    expect(buildDiscountLines([pwdLatte], { tenLineId: null, freeLineId: 'latte' })).toEqual([
      { lineId: 'latte', name: 'Spanish Latte', amount: 130, kind: 'free', scope: 'solo', label: 'Loyalty free drink' },
      // PWD 20% of the one latte still paid
      { lineId: 'latte', name: 'Spanish Latte', amount: 26, kind: 'pwd', scope: 'all', label: 'PWD Drink −20% ×1' },
    ])
  })

  it('never makes a Signature or Matcha Series drink free', () => {
    expect(buildDiscountLines([mocha], { tenLineId: null, freeLineId: 'mocha' })).toEqual([])
  })

  it('badges each line from its rows, so a badge never counts the free unit or a replaced Google Review', () => {
    const both = { ...latte, discounts: { pwd: 'all' as const, review: 'all' as const } }
    const rows = buildDiscountLines([both], { tenLineId: 'latte', freeLineId: 'latte' })
    expect(lineBadges(rows, both)).toEqual([
      { kind: 'free', text: 'Free drink · loyalty' },
      { kind: 'pwd', text: 'PWD/Senior −20% ×1' },
      { kind: 'loyalty', text: 'Loyalty −10% ×1' },
    ])
    expect(lineBadges(rows, both, 'short').map(b => b.text)).toEqual(['Free drink · loyalty', 'PWD/S −20% ×1', 'Loyalty −10% ×1'])
  })

  it('badges a line with no loyalty reward as before', () => {
    const pwd = { ...latte, discounts: { pwd: 'all' as const } }
    expect(lineBadges(buildDiscountLines([pwd]), pwd).map(b => b.text)).toEqual(['PWD/Senior −20% ×2'])
    expect(lineBadges(buildDiscountLines([mocha]), mocha)).toEqual([])
  })

  it('leaves out a discount that comes to ₱0 on an order with no loyalty too', () => {
    const freebie = item({ lineId: 'water', name: 'Water', price: 0, discounts: { pwd: 'all' } })
    expect(buildDiscountLines([freebie])).toEqual([])
  })

  it('gives a single drink that is free no 10% as well, as no unit of it is left to pay', () => {
    const one = { ...latte, qty: 1 }
    expect(buildDiscountLines([one], { tenLineId: 'latte', freeLineId: 'latte' }).map(r => r.kind)).toEqual(['free'])
  })

  it('takes the free unit out of the base, add-ons still paid', () => {
    expect(lineDiscountBase(latte, 20, 'all', 1)).toBe(150)
    expect(lineDiscountBase(latte, 20, 'solo', 1)).toBe(140)
    expect(lineDiscountBase({ ...latte, qty: 1 }, 20, 'solo', 1)).toBe(20)
  })

  it('takes Google Review off every line when the loyalty 10% is turned on', () => {
    const lines = [
      { ...latte, discounts: { pwd: 'solo' as const, review: 'all' as const } },
      { ...mocha, discounts: { review: 'solo' as const } },
      shot,
    ]
    const next = withoutGoogleReview(lines)
    expect(next.map(i => i.discounts)).toEqual([{ pwd: 'solo' }, undefined, undefined])
    expect(lines[1].discounts).toEqual({ review: 'solo' })
  })
})
