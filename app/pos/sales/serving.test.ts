import { describe, it, expect } from 'vitest'
import type { Sale, SaleItem, SalesSummary } from '../types'
import { changeMessage, countsAfter, servedLocally, showsIn, showsReload, undoRequest, withOrder } from './serving'

const OUT = '2026-11-24T11:46:00.000Z' // 7:46 PM in Manila
const NOW = '2026-11-24T11:53:00.000Z' // 7:53 PM

const line = (lineId: string, name: string, servedAt?: string): SaleItem => ({
  lineId,
  name,
  variant: null,
  price: 145,
  qty: 1,
  ...(servedAt ? { servedAt } : {}),
})

type Times = Partial<Record<'latte' | 'americano' | 'nachos' | 'fries', string>>

/** Bea's order (7:40 PM): a Spanish Latte, an Americano, nachos and fries, with the times each went out. */
const bea = (times: Times, extra: Partial<Sale> = {}): Sale => ({
  _id: 'bea',
  _createdAt: '2026-11-24T11:40:00Z',
  total: 580,
  paymentAmount: 580,
  change: 0,
  notes: 'Bea',
  items: [
    line('latte', 'Spanish Latte', times.latte),
    line('americano', 'Americano', times.americano),
    line('nachos', 'Cheesy Beef Nachos', times.nachos),
    line('fries', 'Classic Fries', times.fries),
  ],
  ...extra,
})

const pending = bea({})
const partly = bea({ latte: OUT, americano: OUT, nachos: OUT })
const done = bea({ latte: OUT, americano: OUT, nachos: OUT, fries: NOW }, { isCompleted: true })
const reopened = bea({ latte: OUT, americano: OUT, nachos: OUT }, { isCompleted: false })
/** Completed before items were ticked one by one: no times at all. */
const oldDone = bea({}, { isCompleted: true })

describe('showsIn', () => {
  it('keeps an order under Recent until every item is out', () => {
    expect(showsIn('recent', pending)).toBe(true)
    expect(showsIn('recent', partly)).toBe(true)
    expect(showsIn('recent', done)).toBe(false)
    expect(showsIn('recent', oldDone)).toBe(false)
  })

  it('shows an order under Completed once any item is out', () => {
    expect(showsIn('completed', pending)).toBe(false)
    expect(showsIn('completed', partly)).toBe(true)
    expect(showsIn('completed', done)).toBe(true)
    expect(showsIn('completed', oldDone)).toBe(true)
  })
})

describe('servedLocally', () => {
  it('ticks the line at the time given, and the order stays open while items are left', () => {
    expect(servedLocally(pending, { kind: 'serve', lineIds: ['latte'] }, NOW)).toEqual(bea({ latte: NOW }, { isCompleted: false }))
  })

  it('completes the order on its last tick, keeping the rest of the order', () => {
    expect(servedLocally(partly, { kind: 'serve', lineIds: ['fries'] }, NOW)).toEqual(done)
  })

  it('Complete ticks every line still to serve, and the lines already out keep their times', () => {
    expect(servedLocally(partly, { kind: 'complete' }, NOW)).toEqual(done)
  })

  it('Complete completes an order with no line to tick, such as an add-on sold on its own', () => {
    const shotOnly: Sale = { ...pending, items: [{ lineId: 'addon__shot', name: 'Espresso Shot', variant: null, price: 30, qty: 1, isAddon: true }] }
    expect(servedLocally(shotOnly, { kind: 'complete' }, NOW)).toEqual({ ...shotOnly, isCompleted: true })
  })

  it('reopens a completed order when one of its lines is unticked', () => {
    expect(servedLocally(done, { kind: 'unserve', lineIds: ['fries'] }, NOW)).toEqual(reopened)
  })

  it('gives an old completed order times when one line goes back, so only that line returns to Recent', () => {
    expect(servedLocally(oldDone, { kind: 'unserve', lineIds: ['fries'] }, NOW)).toEqual(
      bea({ latte: NOW, americano: NOW, nachos: NOW }, { isCompleted: false }),
    )
  })
})

describe('undoRequest', () => {
  it('unticks the line a tick served', () => {
    expect(undoRequest(partly, done)).toEqual({ kind: 'unserve', lineIds: ['fries'] })
  })

  it('unticks only the lines Complete served, not those already out', () => {
    const allOut = bea({ latte: OUT, americano: NOW, nachos: NOW, fries: NOW }, { isCompleted: true })
    expect(undoRequest(bea({ latte: OUT }), allOut)).toEqual({ kind: 'unserve', lineIds: ['americano', 'nachos', 'fries'] })
  })

  it('ticks again a line that was unticked', () => {
    expect(undoRequest(done, reopened)).toEqual({ kind: 'serve', lineIds: ['fries'] })
  })

  it('has nothing to undo when nothing changed', () => {
    expect(undoRequest(partly, partly)).toBeNull()
  })
})

describe('changeMessage', () => {
  it('names the item that moved to Completed', () => {
    expect(changeMessage(pending, bea({ latte: NOW }, { isCompleted: false }))).toBe('Spanish Latte moved to Completed')
  })

  it('says the order is complete when its last item goes out', () => {
    expect(changeMessage(partly, done)).toBe('Bea’s order is complete')
  })

  it('says which order by its time when it has no name', () => {
    expect(changeMessage({ ...partly, notes: undefined }, { ...done, notes: undefined })).toBe('The 7:40 PM order is complete')
  })

  it('names the item that moved back to Recent', () => {
    expect(changeMessage(done, reopened)).toBe('Classic Fries moved back to Recent')
  })

  it('counts the items when several moved', () => {
    expect(changeMessage(done, bea({ latte: OUT, americano: OUT }, { isCompleted: false }))).toBe('2 items moved back to Recent')
  })
})

describe('withOrder', () => {
  const at = (_id: string, _createdAt: string): Sale => ({ ...pending, _id, _createdAt })
  const a = at('a', '2026-11-24T12:00:00Z')
  const b = at('b', '2026-11-24T11:00:00Z')
  const c = at('c', '2026-11-24T10:00:00Z')

  it('puts the order’s new version in its place', () => {
    const renamed = { ...b, notes: 'Ben' }
    expect(withOrder([a, b, c], renamed, false)).toEqual([a, renamed, c])
  })

  it('leaves a missing order out unless asked to put it back', () => {
    expect(withOrder([a, c], b, false)).toEqual([a, c])
  })

  it('puts a missing order back by time, newest first', () => {
    expect(withOrder([a, c], b, true)).toEqual([a, b, c])
    expect(withOrder([b, c], a, true)).toEqual([a, b, c])
    expect(withOrder([a, b], c, true)).toEqual([a, b, c])
  })
})

describe('showsReload', () => {
  it('shows the list the skeleton waits for, even while a tick is on its way', () => {
    expect(showsReload({ waiting: true, busy: true, changed: true })).toBe(true)
  })

  it('drops a quiet reload while a tick is on its way: the reload after the tick shows instead', () => {
    expect(showsReload({ waiting: false, busy: true, changed: false })).toBe(false)
  })

  it('drops a quiet reload begun before a tick was shown: it may not have the tick', () => {
    expect(showsReload({ waiting: false, busy: false, changed: true })).toBe(false)
  })

  it('shows a quiet reload once every tick is in', () => {
    expect(showsReload({ waiting: false, busy: false, changed: false })).toBe(true)
  })
})

describe('countsAfter', () => {
  const nothing = { amount: 0, orders: 0 }
  const summary: SalesSummary = {
    totalRevenue: 1290,
    orderCount: 4,
    avgOrderValue: 322.5,
    topItems: [],
    topItemCategories: [],
    topCustomers: [],
    pendingCount: 3,
    completedCount: 2,
    partlyServedCount: 1,
    paymentTally: { cash: { amount: 1290, orders: 4 }, ewallet: nothing, card: nothing, notRecorded: nothing },
    orderTypes: { dineIn: 3, takeOut: 1, notRecorded: 0 },
  }

  it('adds an order to Completed on its first tick, as partly served, and keeps it in Recent', () => {
    expect(countsAfter(summary, pending, bea({ latte: NOW }))).toEqual({ ...summary, pendingCount: 3, completedCount: 3, partlyServedCount: 2 })
  })

  it('takes the order off Recent on its last tick', () => {
    expect(countsAfter(summary, partly, done)).toEqual({ ...summary, pendingCount: 2, completedCount: 2, partlyServedCount: 0 })
  })

  it('moves an order with nothing out straight to Completed on Complete', () => {
    const allNow = bea({ latte: NOW, americano: NOW, nachos: NOW, fries: NOW }, { isCompleted: true })
    expect(countsAfter(summary, pending, allNow)).toEqual({ ...summary, pendingCount: 2, completedCount: 3, partlyServedCount: 1 })
  })

  it('puts a reopened order back in Recent, still under Completed as partly served', () => {
    expect(countsAfter(summary, done, reopened)).toEqual({ ...summary, pendingCount: 4, completedCount: 2, partlyServedCount: 2 })
  })

  it('takes an order off Completed when its only item out goes back', () => {
    expect(countsAfter(summary, bea({ latte: NOW }), pending)).toEqual({ ...summary, pendingCount: 3, completedCount: 1, partlyServedCount: 0 })
  })

  it('reads a missing partly served count as 0', () => {
    expect(countsAfter({ ...summary, partlyServedCount: undefined }, pending, bea({ latte: NOW })).partlyServedCount).toBe(1)
  })
})
