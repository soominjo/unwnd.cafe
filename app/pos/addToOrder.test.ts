import { describe, it, expect } from 'vitest'
import type { DiscountLine, OrderItem, Sale } from './types'
import { blockedRewards, buildAddItemsBody, nameAfterRefresh, newLineSuffix, openOrderFromSale, reviewLockedBy, savedState, type OpenOrder } from './addToOrder'

const sale: Sale = {
  _id: 'sale-214',
  _rev: 'rev-9',
  _createdAt: '2026-10-03T06:14:00Z',
  total: 278,
  paymentAmount: 278,
  change: 0,
  subtotal: 290,
  notes: ' Kylene ',
  items: [
    { lineId: 'cereal-cream-latte__ice', name: 'Cereal Cream Latte', variant: 'ice', price: 170, qty: 1, categoryId: 'signature' },
    { lineId: 'cafe-latte__hot', name: 'Cafe Latte', variant: 'hot', price: 120, qty: 1, categoryId: 'espresso' },
  ],
  discounts: [{ lineId: 'cafe-latte__hot', name: 'Loyalty -10% (Cafe Latte)', amount: 12 }],
  loyaltyMemberId: 'kylene',
  loyaltyRewards: ['ten'],
  orderType: 'take-out',
  payments: [{ _key: 'pay-0', method: 'cash', amount: 278, received: 300 }],
}

const order: OpenOrder = {
  id: 'sale-214',
  rev: 'rev-9',
  createdAt: '2026-10-03T06:14:00Z',
  name: 'Kylene',
  items: sale.items,
  discounts: sale.discounts!,
  total: 278,
  loyaltyMemberId: 'kylene',
  loyaltyRewards: ['ten'],
  orderType: 'take-out',
  payments: [{ _key: 'pay-0', method: 'cash', amount: 278, received: 300 }],
}

describe('openOrderFromSale', () => {
  it('keeps what adding needs: the revision, the saved lines and rows, the name, the card, the type and the payments', () => {
    expect(openOrderFromSale(sale)).toEqual(order)
  })

  it('reads an order with no name, card, rows, type or payments as empty ones', () => {
    const plain = openOrderFromSale({
      ...sale, notes: undefined, discounts: undefined, loyaltyMemberId: undefined, loyaltyRewards: undefined, orderType: undefined, payments: undefined,
    })
    expect(plain).toMatchObject({ name: '', discounts: [], loyaltyMemberId: null, loyaltyRewards: [], orderType: null, payments: [] })
  })
})

describe('newLineSuffix', () => {
  it('is __a and four base-36 characters, so an added line never shares a saved line’s id', () => {
    const rolls = [0, 0.5, 0.999, 0.1]
    expect(newLineSuffix(() => rolls.shift()!)).toBe('__a0iz3')
    const suffix = newLineSuffix()
    expect(suffix).toMatch(/^__a[0-9a-z]{4}$/)
    // The ✕ on Sales only accepts line ids of these characters.
    expect(`cafe-latte__hot${suffix}`).toMatch(/^[a-zA-Z0-9_-]+$/)
  })
})

describe('blockedRewards and reviewLockedBy', () => {
  it('keeps each reward to once per order, and the one 10% from going on beside Google Review', () => {
    expect(blockedRewards(order)).toEqual(['ten'])
    expect(blockedRewards({ ...order, loyaltyRewards: ['free'] })).toEqual(['free'])
    const review = { ...order, loyaltyRewards: [], discounts: [{ lineId: 'cafe-latte__hot', name: 'Google Review -10% (Cafe Latte)', amount: 12 }] }
    expect(blockedRewards(review)).toEqual(['ten'])
    expect(blockedRewards({ ...order, loyaltyRewards: [], discounts: [] })).toEqual([])
  })

  it('locks Google Review on the new lines only when the order used the loyalty 10%', () => {
    expect(reviewLockedBy(order)).toBe(true)
    expect(reviewLockedBy({ ...order, loyaltyRewards: ['free'] })).toBe(false)
  })
})

describe('buildAddItemsBody', () => {
  const latte: OrderItem = { lineId: 'cafe-latte__hot__ak3j9', name: 'Cafe Latte', variant: 'hot', price: 120, qty: 2, categoryId: 'espresso', discounts: { pwd: 'solo' } }
  const pwd: DiscountLine = { lineId: latte.lineId, name: 'Cafe Latte', amount: 24, kind: 'pwd', scope: 'solo', label: 'PWD Drink −20% ×1' }

  it('sends the new lines and their rows under the revision opened, with how the new lines were paid', () => {
    // 2 × 120 − 24 = 216 for the new lines, paid in cash from ₱300.
    const payments = [{ method: 'cash' as const, amount: 216, received: 300 }]
    expect(buildAddItemsBody({ order, items: [latte], discountLines: [pwd], payments, name: 'Kylene', rewards: [] })).toEqual({
      rev: 'rev-9',
      items: [latte],
      discounts: [{ lineId: 'cafe-latte__hot__ak3j9', name: 'PWD Drink -20% x1 (Cafe Latte)', amount: 24 }],
      payments: [{ method: 'cash', amount: 216, received: 300 }],
    })
  })

  it('names an order that had no name, and sends the rewards used on the new lines', () => {
    const payments = [{ method: 'ewallet' as const, amount: 120 }]
    const body = buildAddItemsBody({ order: { ...order, name: '', loyaltyMemberId: null }, items: [latte], discountLines: [], payments, name: '  Juan ', rewards: ['free'] })
    expect(body).toEqual({ rev: 'rev-9', items: [latte], notes: 'Juan', loyaltyRewards: ['free'], payments: [{ method: 'ewallet', amount: 120 }] })
  })

  it('renames or clears the name only when the field changed, and never on a loyalty card’s order', () => {
    const juans = { ...order, name: 'Juan', loyaltyMemberId: null }
    const args = { items: [latte], discountLines: [], payments: [], rewards: [] }
    expect(buildAddItemsBody({ ...args, order: juans, name: 'Juan ' })).not.toHaveProperty('notes')
    expect(buildAddItemsBody({ ...args, order: juans, name: 'Juanito' })).toMatchObject({ notes: 'Juanito' })
    expect(buildAddItemsBody({ ...args, order: juans, name: '  ' })).toMatchObject({ notes: '' })
    expect(buildAddItemsBody({ ...args, order, name: 'Someone else' })).not.toHaveProperty('notes')
  })
})

describe('nameAfterRefresh', () => {
  // The order is read again after another device changed it: (name it had, name field, name it has now).
  it('takes a name the other device cleared, so a save from here does not put the old one back', () => {
    expect(nameAfterRefresh('Juan', 'Juan', '')).toBe('')
  })

  it('takes a name the other device gave or changed', () => {
    expect(nameAfterRefresh('', 'Bob', 'Alice')).toBe('Alice')
    expect(nameAfterRefresh('Juan', 'Juan', 'Juanito')).toBe('Juanito')
  })

  it('keeps what the cashier typed when the other device left the name alone', () => {
    expect(nameAfterRefresh('Juan', 'Juana', 'Juan')).toBe('Juana')
    expect(nameAfterRefresh('', 'Juan', '')).toBe('Juan')
  })
})

describe('savedState', () => {
  // What was sent: a Tiramisu, and an Americano with PWD/Senior on it.
  const tiramisu = { lineId: 'tiramisu__ice__ak3j9', name: 'Tiramisu', variant: 'ice', price: 160, qty: 1 }
  const americano = { lineId: 'americano__hot__ak3j9', name: 'Americano', variant: 'hot', price: 100, qty: 1 }
  const pwd = { lineId: 'americano__hot__ak3j9', name: 'PWD Drink -20% (Americano)', amount: 20 }
  const sent = { items: [tiramisu, americano], discounts: [pwd] }
  const withSaved = (items: Sale['items'], discounts = [...sale.discounts!, pwd]) => ({ ...sale, items: [...sale.items, ...items], discounts })

  it('is saved when an earlier save put these very lines and rows on the order (only its reply was lost)', () => {
    expect(savedState(withSaved([tiramisu, americano]), sent)).toBe('saved')
  })

  it('is partly saved when an earlier save went through with other amounts, lines or rows', () => {
    expect(savedState(withSaved([{ ...tiramisu, qty: 2 }, americano]), sent)).toBe('partly')
    expect(savedState(withSaved([tiramisu]), sent)).toBe('partly')
    expect(savedState(withSaved([tiramisu, americano], sale.discounts), sent)).toBe('partly')
  })

  it('is not saved when none of the lines are on the order', () => {
    expect(savedState(sale, sent)).toBe('not')
  })
})
