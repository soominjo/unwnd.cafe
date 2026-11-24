import { describe, it, expect } from 'vitest'
import {
  KEPT_ADDING_KEY,
  canKeepOrders,
  KEPT_ORDER_KEY,
  findKeptOrder,
  forgetKeptLines,
  forgetKeptOrder,
  keepOrder,
  keptOrderOf,
  noticeOnScreen,
  readKeptOrder,
  type KeptOrder,
  type PosCart,
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

  it('forgets lines kept for that order, and leaves lines kept for another order', () => {
    const storage = memoryStorage()
    keepOrder(ADDING, storage)
    forgetKeptLines('sale-2', storage)
    expect(readKeptOrder('adding', storage)).toEqual(ADDING)
    forgetKeptLines('sale-1', storage)
    expect(readKeptOrder('adding', storage)).toBeNull()
    expect(() => forgetKeptLines('sale-1', refusingStorage)).not.toThrow()
  })

  it('says whether the tablet can keep an order, and leaves nothing behind asking', () => {
    const storage = memoryStorage()
    expect(canKeepOrders(storage)).toBe(true)
    expect(storage.data.size).toBe(0)
    expect(canKeepOrders(refusingStorage)).toBe(false)
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

const SAVED_WITH_COOKIE: OpenOrder = {
  ...SAVED_ORDER,
  items: [...SAVED_ORDER.items, { lineId: 'cookie__fixed__a1b2c', name: 'Cookie', variant: null, price: 90, qty: 1, addedAt: '2026-11-24T02:10:00.000Z' }],
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
    expect(findKeptOrder(SAVED_WITH_COOKIE, ADDING)).toEqual({ kind: 'already-added' })
  })

  it('reports lines saved at other amounts as such: the cart changed after a save whose reply was lost', () => {
    const twoCookies: KeptOrder = { ...ADDING, items: [{ ...ADDING.items[0], qty: 2 }] }
    expect(findKeptOrder(SAVED_WITH_COOKIE, twoCookies)).toEqual({ kind: 'added-other-amounts' })
  })

  it('reports lines of which only some were saved as other amounts', () => {
    const cookieAndBrownie: KeptOrder = { ...ADDING, items: [...ADDING.items, { lineId: 'brownie__fixed__a1b2c', name: 'Brownie', variant: null, price: 95, qty: 1, categoryId: 'snack' }] }
    expect(findKeptOrder(SAVED_WITH_COOKIE, cookieAndBrownie)).toEqual({ kind: 'added-other-amounts' })
  })

  it('tells a discount put on after the save from one saved with the lines', () => {
    const pwdCookie: KeptOrder = { ...ADDING, items: [{ ...ADDING.items[0], discounts: { pwd: 'solo' } }] }
    expect(findKeptOrder(SAVED_WITH_COOKIE, pwdCookie)).toEqual({ kind: 'added-other-amounts' })
    const savedWithRow: OpenOrder = { ...SAVED_WITH_COOKIE, discounts: [{ lineId: 'cookie__fixed__a1b2c', name: 'PWD Food -20% (Cookie)', amount: 18 }] }
    expect(findKeptOrder(savedWithRow, pwdCookie)).toEqual({ kind: 'already-added' })
  })

  it('takes a name changed on another device, a clear included, else keeps the one typed', () => {
    // Kept while the order was named Ana, with "Ana B" typed: Ana B stays (the case above).
    expect(findKeptOrder({ ...SAVED_ORDER, name: 'Bea' }, ADDING)).toEqual({ kind: 'order', order: { ...ADDING, name: 'Bea' } })
    expect(findKeptOrder({ ...SAVED_ORDER, name: '' }, ADDING)).toEqual({ kind: 'order', order: { ...ADDING, name: '' } })
  })
})

describe('noticeOnScreen', () => {
  it('drops "may be saved already" once the cart it was about is empty', () => {
    expect(noticeOnScreen('maybe-saved', [])).toBeNull()
  })

  it('keeps it while that order is on screen', () => {
    expect(noticeOnScreen('maybe-saved', NEW_ORDER.items)).toBe('maybe-saved')
  })

  it('keeps the notices about added items, which come with an empty cart', () => {
    expect(noticeOnScreen('already-added', [])).toBe('already-added')
    expect(noticeOnScreen('added-other-amounts', [])).toBe('added-other-amounts')
    expect(noticeOnScreen(null, [])).toBeNull()
  })
})

describe('keptOrderOf', () => {
  // The POS as it shows a new order: what keptOrderOf turns into the order kept on the tablet.
  const onScreen: PosCart = {
    openOrder: null,
    addedAndPrinting: false,
    items: NEW_ORDER.items,
    name: 'Ana',
    cardHolderId: 'loyaltyMember.ana',
    rewards: { tenLineId: 'spanish-latte__hot', freeLineId: null },
    orderType: 'take-out',
    lineSuffix: '',
    saving: false,
    notice: null,
  }

  it('keeps a new order as it is on screen', () => {
    expect(keptOrderOf(onScreen)).toEqual(NEW_ORDER)
  })

  it('keeps lines being added under their order, with no card: the order keeps its own', () => {
    const adding: PosCart = { ...onScreen, openOrder: SAVED_ORDER, items: ADDING.items, name: 'Ana B', rewards: { tenLineId: null, freeLineId: null }, orderType: 'dine-in', lineSuffix: '__a1b2c' }
    expect(keptOrderOf(adding)).toEqual(ADDING)
  })

  it('keeps nothing of added lines once they are saved and their receipt is up', () => {
    expect(keptOrderOf({ ...onScreen, openOrder: SAVED_ORDER, addedAndPrinting: true }).items).toEqual([])
    expect(keptOrderOf({ ...onScreen, addedAndPrinting: true }).items).toEqual(NEW_ORDER.items)
  })

  it('marks the order sending while it saves, and while "may be saved already" is up', () => {
    expect(keptOrderOf({ ...onScreen, saving: true }).sending).toBe(true)
    expect(keptOrderOf({ ...onScreen, notice: 'maybe-saved' }).sending).toBe(true)
    expect(keptOrderOf({ ...onScreen, notice: 'already-added' }).sending).toBe(false)
    expect(keptOrderOf(onScreen).sending).toBe(false)
  })
})
