import { describe, it, expect, vi } from 'vitest'
import type { Sale, SaleItem, SalesSummary } from '../types'
import type { ServeRequest, ServeResult } from './sendServe'
import { createServing, type SalesList, type UndoOffer } from './useServing'

const OUT = '2026-11-24T11:46:00.000Z'
const NOW = '2026-11-24T11:53:00.000Z'

const line = (lineId: string, name: string, servedAt?: string): SaleItem => ({
  lineId,
  name,
  variant: null,
  price: 145,
  qty: 1,
  ...(servedAt ? { servedAt } : {}),
})

/** Bea's order: the latte, Americano and nachos went out at `out`; the fries at `fries`. */
const bea = (out?: string, fries?: string, extra: Partial<Sale> = {}): Sale => ({
  _id: 'bea',
  _createdAt: '2026-11-24T11:40:00Z',
  total: 580,
  paymentAmount: 580,
  change: 0,
  notes: 'Bea',
  items: [line('latte', 'Spanish Latte', out), line('americano', 'Americano', out), line('nachos', 'Cheesy Beef Nachos', out), line('fries', 'Classic Fries', fries)],
  ...extra,
})

const nothing = { amount: 0, orders: 0 }
const summary: SalesSummary = {
  totalRevenue: 580,
  orderCount: 1,
  avgOrderValue: 580,
  topItems: [],
  topItemCategories: [],
  topCustomers: [],
  pendingCount: 1,
  completedCount: 1,
  partlyServedCount: 1,
  paymentTally: { cash: { amount: 580, orders: 1 }, ewallet: nothing, card: nothing, notRecorded: nothing },
  orderTypes: { dineIn: 1, takeOut: 0, notRecorded: 0 },
}

/** The list on screen: what the controller reads and writes. */
function screen(initial: SalesList) {
  let list = initial
  return {
    read: () => list,
    write: (next: SalesList) => {
      list = next
    },
    now: () => list,
  }
}

/** A reply the test settles when it wants. */
function reply() {
  let settle: (result: ServeResult) => void = () => {}
  const promise = new Promise<ServeResult>(resolve => {
    settle = resolve
  })
  return { promise, settle }
}

const settled = () => new Promise(resolve => setTimeout(resolve, 0))

function setup(initial: SalesList, send: (id: string, request: ServeRequest) => Promise<ServeResult>) {
  const list = screen(initial)
  const onError = vi.fn()
  const onSettled = vi.fn()
  const offers: Array<UndoOffer | null> = []
  const serving = createServing({
    read: list.read,
    write: list.write,
    onError,
    onSettled,
    onUndoChange: offer => offers.push(offer),
    send,
    now: () => NOW,
  })
  return { serving, list, onError, onSettled, offers, lastOffer: () => offers[offers.length - 1] }
}

const ok = async (): Promise<ServeResult> => ({ error: null })

describe('createServing', () => {
  it('shows a tick at once, with the tab counts to match, and sends it', async () => {
    const send = vi.fn(ok)
    const { serving, list } = setup({ orders: [bea(OUT)], summary }, send)
    serving.serveLine('bea', 'fries')
    // Bea's last item went out: completed, so no longer pending nor partly served.
    expect(list.now()).toEqual({
      orders: [bea(OUT, NOW, { isCompleted: true })],
      summary: { ...summary, pendingCount: 0, completedCount: 1, partlyServedCount: 0 },
    })
    await settled()
    expect(send).toHaveBeenCalledWith('bea', { kind: 'serve', lineIds: ['fries'] })
  })

  it('offers to undo a tick, naming what moved', () => {
    const { serving, lastOffer } = setup({ orders: [bea()], summary }, vi.fn(ok))
    serving.serveLine('bea', 'latte')
    expect(lastOffer()).toMatchObject({ orderId: 'bea', message: 'Spanish Latte moved to Completed', request: { kind: 'unserve', lineIds: ['latte'] } })
    serving.unserveLine('bea', 'latte')
    expect(lastOffer()).toMatchObject({ message: 'Spanish Latte moved back to Recent', request: { kind: 'serve', lineIds: ['latte'] } })
  })

  it('completes the order with Complete, and offers to undo only what it ticked', async () => {
    const send = vi.fn(ok)
    const { serving, list, lastOffer } = setup({ orders: [bea(OUT)], summary }, send)
    serving.complete('bea')
    expect(list.now().orders).toEqual([bea(OUT, NOW, { isCompleted: true })])
    expect(lastOffer()).toMatchObject({ message: 'Bea’s order is complete', request: { kind: 'unserve', lineIds: ['fries'] } })
    await settled()
    expect(send).toHaveBeenCalledWith('bea', { kind: 'complete' })
  })

  it('puts the order back and says why when the server refuses the change', async () => {
    const clash = 'This order changed on another device. Refresh, then try again.'
    const { serving, list, onError, lastOffer, onSettled } = setup({ orders: [bea(OUT)], summary }, async () => ({ error: clash }))
    serving.serveLine('bea', 'fries')
    await settled()
    expect(list.now()).toEqual({ orders: [bea(OUT)], summary })
    expect(onError).toHaveBeenCalledWith(clash)
    // Nothing to undo: the tick never happened.
    expect(lastOffer()).toBeNull()
    expect(onSettled).toHaveBeenCalledTimes(1)
  })

  it('counts taking back a refused change as a change, so a reload begun before it is dropped', async () => {
    const { serving } = setup({ orders: [bea(OUT)], summary }, async () => ({ error: 'Failed to update order.' }))
    serving.serveLine('bea', 'fries')
    const shown = serving.version()
    await settled()
    expect(serving.version()).toBeGreaterThan(shown)
  })

  it('leaves a list from elsewhere as it is when a change made before is refused', async () => {
    const pending = reply()
    const { serving, list } = setup({ orders: [bea(OUT)], summary }, () => pending.promise)
    serving.serveLine('bea', 'fries')
    // Another period was opened meanwhile: its list and counts came from the server, without Bea.
    const elsewhere: SalesList = { orders: [{ ...bea(OUT), _id: 'cy', notes: 'Cy' }], summary: { ...summary, pendingCount: 7 } }
    list.write(elsewhere)
    pending.settle({ error: 'Network error. Could not mark the item served.' })
    await settled()
    expect(list.now()).toEqual(elsewhere)
  })

  it('sends an order’s taps one at a time, and drops those made on top of one that failed', async () => {
    const first = reply()
    const send = vi.fn(() => (send.mock.calls.length === 1 ? first.promise : ok()))
    const { serving, list } = setup({ orders: [bea()], summary }, send)
    serving.serveLine('bea', 'latte')
    serving.serveLine('bea', 'fries')
    // Both show at once.
    const both = [line('latte', 'Spanish Latte', NOW), line('americano', 'Americano'), line('nachos', 'Cheesy Beef Nachos'), line('fries', 'Classic Fries', NOW)]
    expect(list.now().orders).toEqual([{ ...bea(), items: both, isCompleted: false }])
    await settled()
    expect(send).toHaveBeenCalledTimes(1)
    first.settle({ error: 'Network error. Could not mark the item served.' })
    await settled()
    expect(send).toHaveBeenCalledTimes(1)
    expect(list.now()).toEqual({ orders: [bea()], summary })
  })

  it('undoes onto an order a reload took off the list, putting it back on screen', async () => {
    const send = vi.fn(ok)
    const { serving, list, lastOffer } = setup({ orders: [bea(OUT)], summary }, send)
    serving.serveLine('bea', 'fries')
    const offer = lastOffer()
    await settled()
    // The quiet reload of Recent orders no longer has the completed order.
    const reloaded = { ...summary, pendingCount: 0, completedCount: 1, partlyServedCount: 0 }
    list.write({ orders: [], summary: reloaded })
    serving.undo(offer as UndoOffer)
    expect(list.now()).toEqual({ orders: [bea(OUT, undefined, { isCompleted: false })], summary: { ...reloaded, pendingCount: 1, partlyServedCount: 1 } })
    await settled()
    expect(send).toHaveBeenLastCalledWith('bea', { kind: 'unserve', lineIds: ['fries'] })
  })

  it('does nothing for a tap that changes nothing, such as a line already out', async () => {
    const send = vi.fn(ok)
    const { serving, list, offers } = setup({ orders: [bea(OUT)], summary }, send)
    serving.serveLine('bea', 'latte')
    serving.serveLine('gone', 'latte')
    await settled()
    expect(list.now()).toEqual({ orders: [bea(OUT)], summary })
    expect(send).not.toHaveBeenCalled()
    expect(offers).toEqual([])
  })

  it('is busy while a change is on its way, and counts every change shown', async () => {
    const pending = reply()
    const { serving, onSettled } = setup({ orders: [bea()], summary }, () => pending.promise)
    const before = serving.version()
    expect(serving.busy()).toBe(false)
    serving.serveLine('bea', 'latte')
    expect(serving.busy()).toBe(true)
    expect(serving.version()).toBe(before + 1)
    pending.settle({ error: null })
    await settled()
    expect(serving.busy()).toBe(false)
    expect(onSettled).toHaveBeenCalledTimes(1)
  })
})
