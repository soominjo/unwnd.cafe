import { describe, it, expect } from 'vitest'
import {
  KEPT_ADDING_KEY,
  KEPT_ORDER_KEY,
  findKeptOrder,
  forgetKeptOrder,
  keepOrder,
  readKeptOrder,
  type KeptOrder,
} from './orderDraft'
import type { OpenOrder } from './addToOrder'

// A tablet's storage, in memory; and one that refuses everything, as a private window can.
function memoryStorage() {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  }
}

const refused = () => {
  throw new Error('SecurityError: storage is disabled')
}
const refusingStorage = { getItem: refused, setItem: refused, removeItem: refused }

const NEW_ORDER: KeptOrder = {
  items: [
    { lineId: 'spanish-latte__hot', name: 'Spanish Latte', variant: 'hot', price: 150, qty: 2, categoryId: 'signature', discounts: { pwd: 'solo' } },
    { lineId: 'addon__shot__spanish-latte__hot', name: 'Espresso Shot', variant: null, price: 40, qty: 1, parentLineId: 'spanish-latte__hot' },
    { lineId: 'cookie__fixed', name: 'Cookie', variant: null, price: 90, qty: 1, note: 'warm it up', categoryId: 'snack' },
  ],
  name: 'Ana',
  cardHolderId: 'loyaltyMember.ana',
  rewards: { tenLineId: 'spanish-latte__hot', freeLineId: null },
  orderType: 'take-out',
  lineSuffix: '',
  sending: false,
  addingTo: null,
}

const ADDING: KeptOrder = {
  items: [{ lineId: 'cookie__fixed__a1b2c', name: 'Cookie', variant: null, price: 90, qty: 1, categoryId: 'snack' }],
  name: 'Ana B',
  cardHolderId: null,
  rewards: { tenLineId: null, freeLineId: null },
  orderType: 'dine-in',
  lineSuffix: '__a1b2c',
  sending: false,
  addingTo: { id: 'sale-1', name: 'Ana' },
}

describe('keepOrder and readKeptOrder', () => {
  it('keeps a new order and reads it back as it was', () => {
    const storage = memoryStorage()
    expect(keepOrder(NEW_ORDER, storage)).toBe(true)
    expect(JSON.parse(storage.data.get('unwnd.pos.order')!).v).toBe(1)
    expect(readKeptOrder('new', storage)).toEqual(NEW_ORDER)
  })

  it('keeps lines being added under their own key, apart from a new order', () => {
    const storage = memoryStorage()
    keepOrder(NEW_ORDER, storage)
    expect(keepOrder(ADDING, storage)).toBe(true)
    expect(storage.data.has('unwnd.pos.addingTo')).toBe(true)
    expect(readKeptOrder('adding', storage)).toEqual(ADDING)
    expect(readKeptOrder('new', storage)).toEqual(NEW_ORDER)
  })

  it('removes the kept order once the cart is empty', () => {
    const storage = memoryStorage()
    keepOrder(NEW_ORDER, storage)
    expect(keepOrder({ ...NEW_ORDER, items: [] }, storage)).toBe(true)
    expect(storage.data.has(KEPT_ORDER_KEY)).toBe(false)
    expect(readKeptOrder('new', storage)).toBeNull()
  })

  it('says false when the tablet refuses storage, and reads nothing', () => {
    expect(keepOrder(NEW_ORDER, refusingStorage)).toBe(false)
    expect(keepOrder({ ...NEW_ORDER, items: [] }, refusingStorage)).toBe(false)
    expect(readKeptOrder('new', refusingStorage)).toBeNull()
    expect(() => forgetKeptOrder('new', refusingStorage)).not.toThrow()
  })

  it('forgets one kind without touching the other', () => {
    const storage = memoryStorage()
    keepOrder(NEW_ORDER, storage)
    keepOrder(ADDING, storage)
    forgetKeptOrder('adding', storage)
    expect(readKeptOrder('adding', storage)).toBeNull()
    expect(readKeptOrder('new', storage)).toEqual(NEW_ORDER)
  })

  it('reads nothing when a kept order sits under the other kind’s key', () => {
    const storage = memoryStorage()
    storage.setItem(KEPT_ORDER_KEY, JSON.stringify({ v: 1, ...ADDING }))
    storage.setItem(KEPT_ADDING_KEY, JSON.stringify({ v: 1, ...NEW_ORDER }))
    expect(readKeptOrder('new', storage)).toBeNull()
    expect(readKeptOrder('adding', storage)).toBeNull()
  })

  // Each case changes one thing in a good kept order: the whole order then reads as nothing,
  // so the POS opens with an empty cart rather than a broken one.
  const stored = { v: 1, ...NEW_ORDER }
  const withLine = (patch: Record<string, unknown>) => ({ ...stored, items: [{ ...NEW_ORDER.items[0], ...patch }, ...NEW_ORDER.items.slice(1)] })
  it.each<[string, string]>([
    ['text that is not JSON', '{'],
    ['no order at all', 'null'],
    ['a list instead of an order', '[]'],
    ['another version', JSON.stringify({ ...stored, v: 2 })],
    ['no version', JSON.stringify(NEW_ORDER)],
    ['no items', JSON.stringify({ ...stored, items: [] })],
    ['more than 200 lines', JSON.stringify({ ...stored, items: Array.from({ length: 201 }, (_, i) => ({ ...NEW_ORDER.items[2], lineId: `cookie-${i}` })) })],
    ['a line with no id', JSON.stringify(withLine({ lineId: '' }))],
    ['a line whose name is not text', JSON.stringify(withLine({ name: 5 }))],
    ['a negative price', JSON.stringify(withLine({ price: -1 }))],
    ['a missing price', JSON.stringify(withLine({ price: null }))],
    ['a zero quantity', JSON.stringify(withLine({ qty: 0 }))],
    ['a part quantity', JSON.stringify(withLine({ qty: 1.5 }))],
    ['an unknown variant', JSON.stringify(withLine({ variant: 'warm' }))],
    ['an unknown discount scope', JSON.stringify(withLine({ discounts: { pwd: 'half' } }))],
    ['an unknown discount kind', JSON.stringify(withLine({ discounts: { staff: 'all' } }))],
    ['a note that is not text', JSON.stringify(withLine({ note: 3 }))],
    ['a customer name that is not text', JSON.stringify({ ...stored, name: 5 })],
    ['a card id that is not text', JSON.stringify({ ...stored, cardHolderId: 7 })],
    ['rewards missing', JSON.stringify({ ...stored, rewards: undefined })],
    ['an unknown order type', JSON.stringify({ ...stored, orderType: 'delivery' })],
    ['a line suffix that is not text', JSON.stringify({ ...stored, lineSuffix: null })],
    ['a sending mark that is not true or false', JSON.stringify({ ...stored, sending: 'yes' })],
    ['adding to an order with no id', JSON.stringify({ ...stored, addingTo: { id: '', name: 'Ana' } })],
  ])('reads nothing from a kept order with %s', (_, text) => {
    const storage = memoryStorage()
    storage.setItem(KEPT_ORDER_KEY, text)
    expect(readKeptOrder('new', storage)).toBeNull()
  })

  it('drops fields it does not know', () => {
    const storage = memoryStorage()
    storage.setItem(KEPT_ORDER_KEY, JSON.stringify({ ...withLine({ fromAnOldPos: true }), shownAt: 'today' }))
    expect(readKeptOrder('new', storage)).toEqual(NEW_ORDER)
  })
})

// The pending order "Add items" opened, as /pos?edit= loads it on the server.
const SAVED_ORDER: OpenOrder = {
  id: 'sale-1',
  rev: 'rev-1',
  createdAt: '2026-11-24T02:00:00.000Z',
  name: 'Ana',
  items: [{ lineId: 'spanish-latte__hot', name: 'Spanish Latte', variant: 'hot', price: 150, qty: 1, categoryId: 'signature' }],
  discounts: [],
  total: 150,
  loyaltyMemberId: null,
  loyaltyRewards: [],
  orderType: 'dine-in',
  payments: [],
}

describe('findKeptOrder', () => {
  it('brings nothing back when nothing is kept', () => {
    expect(findKeptOrder(null, null)).toEqual({ kind: 'none' })
    expect(findKeptOrder(SAVED_ORDER, null)).toEqual({ kind: 'none' })
  })

  it('brings a new order back as kept, its sending mark included', () => {
    expect(findKeptOrder(null, { ...NEW_ORDER, sending: true })).toEqual({ kind: 'order', order: { ...NEW_ORDER, sending: true } })
  })

  it('brings no adding lines back on a new order, and no new order while adding', () => {
    expect(findKeptOrder(null, ADDING)).toEqual({ kind: 'none' })
    expect(findKeptOrder(SAVED_ORDER, NEW_ORDER)).toEqual({ kind: 'none' })
  })

  it('brings lines back only for the order they were kept for', () => {
    expect(findKeptOrder({ ...SAVED_ORDER, id: 'sale-2' }, ADDING)).toEqual({ kind: 'none' })
  })

  it('brings lines back for their order without the sending mark: the order itself shows whether they were saved', () => {
    expect(findKeptOrder(SAVED_ORDER, { ...ADDING, sending: true })).toEqual({ kind: 'order', order: { ...ADDING, sending: false } })
  })

  it('reports lines the order already holds as added, not as new lines to save again', () => {
    const saved = { ...SAVED_ORDER, items: [...SAVED_ORDER.items, { lineId: 'cookie__fixed__a1b2c', name: 'Cookie', variant: null, price: 90, qty: 1, addedAt: '2026-11-24T02:10:00.000Z' }] }
    expect(findKeptOrder(saved, ADDING)).toEqual({ kind: 'already-added' })
  })

  it('takes a name changed on another device, a clear included, else keeps the one typed', () => {
    // Kept while the order was named Ana, with "Ana B" typed: Ana B stays (the case above).
    expect(findKeptOrder({ ...SAVED_ORDER, name: 'Bea' }, ADDING)).toEqual({ kind: 'order', order: { ...ADDING, name: 'Bea' } })
    expect(findKeptOrder({ ...SAVED_ORDER, name: '' }, ADDING)).toEqual({ kind: 'order', order: { ...ADDING, name: '' } })
  })
})
