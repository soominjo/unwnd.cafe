import { describe, it, expect } from 'vitest'
import { resolveLoyaltyOrder, sameLoyaltyChoice, type LoyaltyOrderInput } from './loyaltyOrder'
import { NO_LOYALTY } from './discounts'
import type { CardHolderWithCard } from '@/lib/loyalty'
import type { OrderItem } from './types'

const holder = (id: string, name: string, earned: number, usedTen = 0, usedFree = 0): CardHolderWithCard => ({
  _id: id, name, cardNumber: 12, joinedAt: '2026-10-02T00:00:00Z', card: { earned, usedTen, usedFree }, orderCount: 1,
})
const signature: OrderItem = { lineId: 'white-mocha-americano__hot', name: 'White Mocha Americano', variant: 'hot', price: 130, qty: 1, categoryId: 'signature' }
const latte: OrderItem = { lineId: 'cafe-latte__hot', name: 'Cafe Latte', variant: 'hot', price: 110, qty: 1, categoryId: 'espresso' }
const chocolate: OrderItem = { lineId: 'chocolate__ice', name: 'Chocolate', variant: 'ice', price: 120, qty: 1, categoryId: 'non-coffee' }
const waffle: OrderItem = { lineId: 'classic-waffle__fixed', name: 'Classic Waffle', variant: null, price: 150, qty: 1, categoryId: 'waffle' }
const fries: OrderItem = { lineId: 'fries__fixed', name: 'Fries', variant: null, price: 90, qty: 1, categoryId: 'snack' }
const riceBowl: OrderItem = { lineId: 'chicken-rice__fixed', name: 'Chicken Rice Bowl', variant: null, price: 180, qty: 1, categoryId: 'meal' }
// Kylene is on 5 stamps: this order's Signature drink is her sixth, so her 10% is ready.
const kylene = holder('k', 'Kylene', 5)
// Ana's card is full: her free drink is ready, and a 10% she has not used.
const ana = holder('a', 'Ana', 11)
const asAna = { holders: [ana], linkedHolderId: 'a', customerName: 'Ana' }

const resolve = (over: Partial<LoyaltyOrderInput>) => resolveLoyaltyOrder({
  holders: [kylene, ana], linkedHolderId: 'k', customerName: 'Kylene', items: [signature, latte], picked: NO_LOYALTY, ...over,
})

describe('resolveLoyaltyOrder', () => {
  it('links the card holder only while the name field shows their name, whatever the capitals', () => {
    expect(resolve({ customerName: '  KYLENE ' }).holder?._id).toBe('k')
    expect(resolve({ customerName: 'Kylenex' }).holder).toBeNull()
    expect(resolve({ holders: null }).holder).toBeNull()
  })

  it('counts this order’s stamps on the card, so a reward can be used on the order that earns it', () => {
    // The Signature drink is a stamp and the Cafe Latte half of one: 5 + 1½.
    const order = resolve({})
    expect(order.orderStamps).toBe(1.5)
    expect(order.card?.onCard).toBe(6.5)
    expect(order.card?.tenReady).toBe(1)
  })

  it('offers the 10% on each classic drink with a unit still to pay, never on Signature or Matcha', () => {
    expect(resolve({ items: [signature, latte, chocolate] }).tenLines.map(l => l.lineId)).toEqual([latte.lineId, chocolate.lineId])
    // A single Cafe Latte made free leaves no unit of it for the 10%; a second one does.
    const free = { tenLineId: null, freeLineId: latte.lineId }
    expect(resolve({ ...asAna, items: [latte], picked: free }).tenLines).toEqual([])
    expect(resolve({ ...asAna, items: [{ ...latte, qty: 2 }], picked: free }).tenLines.map(l => l.lineId)).toEqual([latte.lineId])
  })

  it('applies the picked rewards that are ready, and lists them for the sale', () => {
    const order = resolve({ ...asAna, items: [{ ...latte, qty: 2 }], picked: { tenLineId: latte.lineId, freeLineId: latte.lineId } })
    expect(order.applied).toEqual({ tenLineId: latte.lineId, freeLineId: latte.lineId })
    expect(order.rewards).toEqual(['ten', 'free'])
  })

  it('drops the 10% once the order no longer reaches it, and it stays off when the order does again', () => {
    const picked = { tenLineId: latte.lineId, freeLineId: null }
    expect(resolve({ picked }).applied.tenLineId).toBe(latte.lineId)
    // The Signature drink comes off: the card is back on 5 stamps.
    const dropped = resolve({ items: [latte], picked })
    expect(dropped.applied.tenLineId).toBeNull()
    expect(sameLoyaltyChoice(dropped.applied, picked)).toBe(false)
    // POSClient then keeps only what applies, so adding the drink back needs a new tap.
    expect(resolve({ items: [latte, signature], picked: dropped.applied }).applied.tenLineId).toBeNull()
  })

  it('drops the 10% once its drink leaves the order, so the same drink added again pays in full', () => {
    const picked = { tenLineId: latte.lineId, freeLineId: null }
    const removed = resolve({ items: [signature, chocolate], picked })
    expect(removed.applied.tenLineId).toBeNull()
    expect(resolve({ items: [signature, chocolate, latte], picked: removed.applied }).applied.tenLineId).toBeNull()
  })

  it('drops the free drink once its line leaves the order, so the same drink added again is paid', () => {
    const picked = { tenLineId: null, freeLineId: latte.lineId }
    expect(resolve({ ...asAna, items: [latte], picked }).applied.freeLineId).toBe(latte.lineId)
    const removed = resolve({ ...asAna, items: [signature], picked })
    expect(removed.applied.freeLineId).toBeNull()
    expect(resolve({ ...asAna, items: [signature, latte], picked: removed.applied }).applied.freeLineId).toBeNull()
  })

  it('counts no stamp for the free drink: Ana’s free Cafe Latte adds nothing to her full card', () => {
    const free = { tenLineId: null, freeLineId: latte.lineId }
    const order = resolve({ ...asAna, items: [latte], picked: free })
    expect(order.applied.freeLineId).toBe(latte.lineId)
    expect(order.orderStamps).toBe(0)
    expect(order.card?.onCard).toBe(0)
    // A second Cafe Latte is paid, so it still earns its half.
    expect(resolve({ ...asAna, items: [{ ...latte, qty: 2 }], picked: free }).orderStamps).toBe(0.5)
  })

  it('offers the free drink on each classic drink while the card has it ready, never on a Signature or a Waffle', () => {
    expect(resolve({ ...asAna, items: [signature, latte, waffle, chocolate] }).freeLines.map(l => l.lineId)).toEqual([latte.lineId, chocolate.lineId])
    // Kylene's card is not full, and Ana's free drink was used on this order already.
    expect(resolve({}).freeLines).toEqual([])
    expect(resolve({ ...asAna, blocked: ['free'] }).freeLines).toEqual([])
  })

  it('needs the free drink ready without its own stamp, so a drink can’t earn itself free', () => {
    // Ben is on 10½: a Cafe Latte fills his card, but it can't be the free drink it earns.
    const asBen = { holders: [holder('b', 'Ben', 10.5)], linkedHolderId: 'b', customerName: 'Ben' }
    const free = { tenLineId: null, freeLineId: latte.lineId }
    const one = resolve({ ...asBen, items: [latte], picked: free })
    expect(one.freeLines).toEqual([])
    expect(one.applied.freeLineId).toBeNull()
    expect(one).toMatchObject({ orderStamps: 0.5, card: { freeReady: 1 } })
    // With a Chocolate too, the paid drink's half fills the card, so either can be the free one.
    const two = resolve({ ...asBen, items: [latte, chocolate], picked: free })
    expect(two.freeLines.map(l => l.lineId)).toEqual([latte.lineId, chocolate.lineId])
    expect(two).toMatchObject({ applied: { freeLineId: latte.lineId }, orderStamps: 0.5 })
  })

  it('counts the 10% without the free drink’s stamp too', () => {
    // Cara's first card is full with its 10% used, and she is on 5 of the next: two Cafe Lattes make 6…
    const asCara = { holders: [holder('c', 'Cara', 16, 1)], linkedHolderId: 'c', customerName: 'Cara' }
    const twoLattes = [{ ...latte, qty: 2 }]
    expect(resolve({ ...asCara, items: twoLattes }).card?.tenReady).toBe(1)
    // …but with one of them free she is on 5½, short of the 10%.
    const both = { tenLineId: latte.lineId, freeLineId: latte.lineId }
    expect(resolve({ ...asCara, items: twoLattes, picked: both }).applied).toEqual({ tenLineId: null, freeLineId: latte.lineId })
  })

  it('lets the free drink win a single drink picked for both, keeping the 10% for another drink', () => {
    const order = resolve({ ...asAna, items: [latte], picked: { tenLineId: latte.lineId, freeLineId: latte.lineId } })
    expect(order.applied).toEqual({ tenLineId: null, freeLineId: latte.lineId })
    expect(order.rewards).toEqual(['free'])
  })

  it('applies no reward the order used already, while items are added to it', () => {
    const both = { tenLineId: latte.lineId, freeLineId: latte.lineId }
    const twoLattes = [{ ...latte, qty: 2 }]
    expect(resolve({ ...asAna, items: twoLattes, picked: both, blocked: ['ten'] })).toMatchObject({ applied: { tenLineId: null, freeLineId: latte.lineId }, rewards: ['free'] })
    expect(resolve({ ...asAna, items: twoLattes, picked: both, blocked: ['free'] })).toMatchObject({ applied: { tenLineId: latte.lineId, freeLineId: null }, rewards: ['ten'] })
  })

  it('offers the 10% on a Waffle or Snack too, never on a Meal, and keeps the free drink for a classic drink', () => {
    expect(resolve({ items: [signature, waffle, fries, riceBowl] }).tenLines.map(l => l.lineId)).toEqual([waffle.lineId, fries.lineId])
    const order = resolve({ ...asAna, items: [waffle], picked: { tenLineId: waffle.lineId, freeLineId: waffle.lineId } })
    expect(order.applied).toEqual({ tenLineId: waffle.lineId, freeLineId: null })
    expect(order.rewards).toEqual(['ten'])
  })

  it('applies nothing without a linked card, and never a reward on a Signature line', () => {
    expect(resolve({ linkedHolderId: null, picked: { tenLineId: latte.lineId, freeLineId: latte.lineId } }).applied).toEqual(NO_LOYALTY)
    expect(resolve({ ...asAna, picked: { tenLineId: signature.lineId, freeLineId: signature.lineId } }).applied).toEqual(NO_LOYALTY)
  })
})
