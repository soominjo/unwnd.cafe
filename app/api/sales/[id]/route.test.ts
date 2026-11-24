import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { fakeSanityClient, type FakeDoc } from '@/lib/testing/fakeSanityClient'

const { requirePosAuth, sanity } = vi.hoisted(() => ({
  requirePosAuth: vi.fn(),
  sanity: { client: null as unknown },
}))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/sanity/lib/writeClient', () => ({ getWriteClient: () => sanity.client }))

import { DELETE, PATCH } from './route'

const line = (lineId: string, name: string, price: number, qty: number, extra: Record<string, unknown> = {}) =>
  ({ _type: 'saleItem', _key: lineId, lineId, name, variant: 'hot', price, qty, ...extra })

const row = (lineId: string, name: string, amount: number, index = 0) => ({ _type: 'saleDiscount', _key: `${lineId}-${index}`, lineId, name, amount })

const lattes = line('cafe-latte__hot', 'Cafe Latte', 120, 2, { categoryId: 'espresso' })
const shot = line('addon__shot__cafe-latte__hot', 'Espresso Shot', 30, 1, { variant: null, isAddon: true, parentLineId: 'cafe-latte__hot' })
const tiramisu = line('tiramisu__hot', 'Tiramisu', 160, 1, { categoryId: 'signature' })
const latte = line('cafe-latte__hot', 'Cafe Latte', 120, 1, { categoryId: 'espresso' })

// Two Cafe Lattes with an attached shot, and a Tiramisu: 240 + 30 + 160 = 430, paid with 500.
const plain: FakeDoc = {
  _id: 'sale-plain', _type: 'sale', total: 430, subtotal: 430, paymentAmount: 500, change: 70, notes: 'Ana',
  items: [lattes, shot, tiramisu],
}
// Two Spanish Lattes with PWD/Senior on one (24 off) and a Croissant: 320 − 24 = 296, paid with 300.
const discounted: FakeDoc = {
  _id: 'sale-pwd', _type: 'sale', total: 296, subtotal: 320, paymentAmount: 300, change: 4,
  items: [line('spanish-latte__hot', 'Spanish Latte', 120, 2, { categoryId: 'espresso' }), line('croissant__fixed', 'Croissant', 80, 1, { variant: null })],
  discounts: [row('spanish-latte__hot', 'PWD Drink -20% x1 (Spanish Latte)', 24)],
}
// A loyalty card holder: a Tiramisu, and a Cafe Latte made the free drink. 280 − 120 = 160.
const loyal: FakeDoc = {
  _id: 'sale-loyal', _type: 'sale', total: 160, subtotal: 280, paymentAmount: 160, change: 0, notes: 'Kylene',
  loyaltyMemberId: 'kylene', loyaltyRewards: ['free'],
  items: [tiramisu, latte],
  discounts: [row('cafe-latte__hot', 'Loyalty free drink (Cafe Latte)', 120)],
}
// The 10% on one of two Cafe Lattes, and a Tiramisu: 400 − 12 = 388, paid exactly.
const tenOff: FakeDoc = {
  _id: 'sale-ten', _type: 'sale', total: 388, subtotal: 400, paymentAmount: 388, change: 0, notes: 'Kylene',
  loyaltyMemberId: 'kylene', loyaltyRewards: ['ten'],
  items: [tiramisu, lattes],
  discounts: [row('cafe-latte__hot', 'Loyalty -10% x1 (Cafe Latte)', 12)],
}
const member: FakeDoc = { _id: 'kylene', _type: 'loyaltyMember', name: 'Kylene', cardNumber: 12 }

let store: ReturnType<typeof fakeSanityClient>
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const del = (id: string) => DELETE(new NextRequest(`http://pos.test/api/sales/${id}`, { method: 'DELETE' }), params(id))
const patch = (id: string, body: unknown) =>
  PATCH(new NextRequest(`http://pos.test/api/sales/${id}`, { method: 'PATCH', body: JSON.stringify(body) }), params(id))

beforeEach(() => {
  vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token')
  requirePosAuth.mockReset().mockResolvedValue(null)
  store = fakeSanityClient([plain, discounted, loyal, tenOff, member])
  sanity.client = store.client
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('DELETE /api/sales/[id]', () => {
  it('deletes the order', async () => {
    expect((await del('sale-plain')).status).toBe(200)
    expect(store.doc('sale-plain')).toBeUndefined()
  })

  it('deletes orders only: a loyalty card holder with that id stays', async () => {
    expect((await del('kylene')).status).toBe(404)
    expect(store.doc('kylene')).toBeDefined()
  })

  it('refuses an id that is not a document id, and a POS that signed out', async () => {
    expect((await del('drafts.sale-plain')).status).toBe(400)
    requirePosAuth.mockResolvedValue(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    expect((await del('sale-plain')).status).toBe(401)
    expect(store.doc('sale-plain')).toBeDefined()
  })
})

describe('PATCH /api/sales/[id] { markCompleted }', () => {
  it('marks a pending order completed', async () => {
    expect((await patch('sale-plain', { markCompleted: true })).status).toBe(200)
    expect(store.doc('sale-plain')?.isCompleted).toBe(true)
  })

  it('completes orders only', async () => {
    expect((await patch('kylene', { markCompleted: true })).status).toBe(404)
    expect(store.doc('kylene')?.isCompleted).toBeUndefined()
  })
})

describe('PATCH /api/sales/[id] { notes }', () => {
  it('names an order, trimmed, renames it, or clears the name when it is empty', async () => {
    expect(await (await patch('sale-pwd', { notes: '  Juan  ' })).json()).toEqual({ success: true, notes: 'Juan' })
    expect(store.doc('sale-pwd')?.notes).toBe('Juan')
    await patch('sale-pwd', { notes: 'Juanito' })
    expect(store.doc('sale-pwd')?.notes).toBe('Juanito')
    await patch('sale-pwd', { notes: '   ' })
    expect(store.doc('sale-pwd')).not.toHaveProperty('notes')
  })

  it('keeps a loyalty card holder’s name on their order', async () => {
    const res = await patch('sale-loyal', { notes: 'Someone else' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('An order on a loyalty card keeps the card holder’s name.')
    expect(store.doc('sale-loyal')?.notes).toBe('Kylene')
  })

  it('refuses a name that is not one, and names orders only', async () => {
    expect((await patch('sale-pwd', { notes: 'x'.repeat(101) })).status).toBe(400)
    expect((await patch('sale-pwd', { notes: 42 })).status).toBe(400)
    expect((await patch('kylene', { notes: 'Juan' })).status).toBe(404)
    expect(store.doc('sale-pwd')).not.toHaveProperty('notes')
  })

  it('takes a name of exactly 100 characters, and changes nothing but the name', async () => {
    const before = store.doc('sale-plain')
    expect((await patch('sale-plain', { notes: 'x'.repeat(100) })).status).toBe(200)
    expect(store.doc('sale-plain')).toEqual({ ...before, notes: 'x'.repeat(100), _rev: expect.any(String) })
  })

  it('answers 500 and logs why when the name can’t be saved', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    sanity.client = { ...store.client, getDocument: () => Promise.reject(new Error('Sanity is down')) }
    const res = await patch('sale-plain', { notes: 'Juan' })
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Failed to rename the order.')
    expect(error).toHaveBeenCalledWith('Order could not be renamed', { id: 'sale-plain' }, expect.any(Error))
  })
})

describe('PATCH /api/sales/[id], the body', () => {
  it('answers 400 to a body that is not an object', async () => {
    const before = store.doc('sale-plain')
    for (const body of [null, 42, 'Juan']) {
      const res = await patch('sale-plain', body)
      expect(res.status).toBe(400)
    }
    expect(store.doc('sale-plain')).toEqual(before)
  })
})

describe('PATCH /api/sales/[id] { removeLineId }', () => {
  it('takes the line off and works out the total and change from the lines left', async () => {
    const res = await patch('sale-plain', { removeLineId: 'tiramisu__hot' })
    expect(await res.json()).toEqual({ success: true, orderDeleted: false })
    const doc = store.doc('sale-plain')
    expect(doc?.items).toEqual([lattes, shot])
    expect(doc?.total).toBe(270)
    expect(doc?.change).toBe(230)
  })

  it('keeps the discounts of the lines left: the total is the subtotal less those rows', async () => {
    await patch('sale-pwd', { removeLineId: 'croissant__fixed' })
    expect(store.doc('sale-pwd')).toMatchObject({ subtotal: 240, total: 216, change: 84, discounts: discounted.discounts })
  })

  it('takes the line’s own discount rows off with it', async () => {
    await patch('sale-pwd', { removeLineId: 'spanish-latte__hot' })
    expect(store.doc('sale-pwd')).toMatchObject({ subtotal: 80, total: 80, change: 220, discounts: [] })
  })

  it('gives a loyalty reward back when its drink comes off, and keeps it while the drink stays', async () => {
    await patch('sale-loyal', { removeLineId: 'cafe-latte__hot' })
    expect(store.doc('sale-loyal')).toMatchObject({ subtotal: 160, total: 160, change: 0, discounts: [], loyaltyRewards: [] })

    await patch('sale-ten', { removeLineId: 'cafe-latte__hot' })
    expect(store.doc('sale-ten')).toMatchObject({ subtotal: 160, total: 160, discounts: [], loyaltyRewards: [] })

    store = fakeSanityClient([loyal])
    sanity.client = store.client
    await patch('sale-loyal', { removeLineId: 'tiramisu__hot' })
    expect(store.doc('sale-loyal')).toMatchObject({ subtotal: 120, total: 0, change: 160, loyaltyRewards: ['free'] })
  })

  it('deletes the order when its last line comes off', async () => {
    store.touch('sale-plain', { items: [line('tiramisu__hot', 'Tiramisu', 160, 1)] })
    expect(await (await patch('sale-plain', { removeLineId: 'tiramisu__hot' })).json()).toEqual({ success: true, orderDeleted: true })
    expect(store.doc('sale-plain')).toBeUndefined()
  })

  it('drops discount rows left behind by lines taken off before, but keeps a whole-order row', async () => {
    store.touch('sale-pwd', {
      discounts: [
        ...(discounted.discounts as unknown[]),
        row('gone-line__hot', 'PWD Drink -20% (Gone)', 40),
        row('order:pwd', 'PWD/Senior -20% (Total items)', 10),
      ],
    })
    await patch('sale-pwd', { removeLineId: 'croissant__fixed' })
    // 240 less the latte's 24 and the whole-order 10; the ₱40 row of a line no longer there goes.
    expect(store.doc('sale-pwd')).toMatchObject({
      subtotal: 240, total: 206,
      discounts: [row('spanish-latte__hot', 'PWD Drink -20% x1 (Spanish Latte)', 24), row('order:pwd', 'PWD/Senior -20% (Total items)', 10)],
    })
  })

  // Add items on the POS can save onto the order between this route's read and its write.
  const addAfterRead = (times: number) => {
    const read = store.client.getDocument
    let left = times
    store.client.getDocument = async <T,>(id: string) => {
      const doc = await read<T>(id)
      if (left-- > 0) {
        const now = store.doc(id)!
        store.touch(id, { items: [...(now.items as unknown[]), line(`added-${left}__hot`, 'Americano', 70, 1)], total: (now.total as number) + 70 })
      }
      return doc
    }
  }

  it('never writes over a save that lands between its read and its write: it works from the order as it now is', async () => {
    addAfterRead(1)
    expect(await (await patch('sale-plain', { removeLineId: 'tiramisu__hot' })).json()).toEqual({ success: true, orderDeleted: false })
    expect(store.doc('sale-plain')).toMatchObject({
      items: [lattes, shot, line('added-0__hot', 'Americano', 70, 1)], subtotal: 340, total: 340, change: 160,
    })
  })

  it('keeps an order whose last line comes off when lines were added to it meanwhile', async () => {
    store.touch('sale-plain', { items: [tiramisu], total: 160, subtotal: 160 })
    addAfterRead(1)
    expect(await (await patch('sale-plain', { removeLineId: 'tiramisu__hot' })).json()).toEqual({ success: true, orderDeleted: false })
    expect(store.doc('sale-plain')).toMatchObject({ items: [line('added-0__hot', 'Americano', 70, 1)], total: 70 })
  })

  it('gives up when the order keeps changing, saying so, and writes nothing of its own', async () => {
    addAfterRead(5)
    const res = await patch('sale-plain', { removeLineId: 'tiramisu__hot' })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('This order changed on another device. Refresh, then try again.')
    expect(store.doc('sale-plain')!.items).toContainEqual(tiramisu)
  })

  it('refuses a line id that is not one, and an id that is not an order', async () => {
    expect((await patch('sale-plain', { removeLineId: 'tiramisu"]' })).status).toBe(400)
    expect((await patch('sale-plain', {})).status).toBe(400)
    expect((await patch('kylene', { removeLineId: 'tiramisu__hot' })).status).toBe(404)
    expect(store.doc('sale-plain')?.items).toHaveLength(3)
  })

  it('answers 404 when the order is deleted between its read and its write', async () => {
    const read = store.client.getDocument
    store.client.getDocument = async <T,>(id: string) => {
      const doc = await read<T>(id)
      void store.client.delete(id)
      return doc
    }
    expect((await patch('sale-plain', { removeLineId: 'tiramisu__hot' })).status).toBe(404)
  })

  it('answers 500 and logs why when the item can’t be taken off', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    sanity.client = { ...store.client, getDocument: () => Promise.reject(new Error('Sanity is down')) }
    const res = await patch('sale-plain', { removeLineId: 'tiramisu__hot' })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ success: false, error: 'Failed to update order.' })
    expect(error).toHaveBeenCalledWith('An item could not be taken off an order', { id: 'sale-plain', removeLineId: 'tiramisu__hot' }, expect.any(Error))
  })
})

describe('PATCH /api/sales/[id] { removeLineId } on a paid order', () => {
  it('takes the removed line off its payment, so the payments still add up to the total', async () => {
    const byWallet: FakeDoc = {
      ...plain, _id: 'sale-wallet', paymentAmount: 430, change: 0,
      payments: [{ _type: 'salePayment', _key: 'pay-0', method: 'ewallet', amount: 430 }],
    }
    store = fakeSanityClient([byWallet])
    sanity.client = store.client
    expect((await patch('sale-wallet', { removeLineId: 'tiramisu__hot' })).status).toBe(200)
    expect(store.doc('sale-wallet')).toMatchObject({
      total: 270, paymentAmount: 270, change: 0,
      payments: [{ _type: 'salePayment', _key: 'pay-0', method: 'ewallet', amount: 270 }],
    })
  })

  it('gives a cash customer the removed line back as change', async () => {
    const byCash: FakeDoc = {
      ...plain, _id: 'sale-cash', paymentAmount: 500, change: 70,
      payments: [{ _type: 'salePayment', _key: 'pay-0', method: 'cash', amount: 430, received: 500 }],
    }
    store = fakeSanityClient([byCash])
    sanity.client = store.client
    expect((await patch('sale-cash', { removeLineId: 'tiramisu__hot' })).status).toBe(200)
    expect(store.doc('sale-cash')).toMatchObject({
      total: 270, paymentAmount: 500, change: 230,
      payments: [{ _type: 'salePayment', _key: 'pay-0', method: 'cash', amount: 270, received: 500 }],
    })
  })
})

describe('PATCH /api/sales/[id] { paymentKey, method }', () => {
  // Two Cafe Lattes with a shot and a Tiramisu, ₱430, paid with ₱500 in cash: ₱70 change.
  const paid: FakeDoc = {
    ...plain, _id: 'sale-paid', paymentAmount: 500, change: 70, orderType: 'dine-in',
    payments: [{ _type: 'salePayment', _key: 'pay-0', method: 'cash', amount: 430, received: 500 }],
  }

  beforeEach(() => {
    store = fakeSanityClient([paid])
    sanity.client = store.client
  })

  it('moves a payment to the method it was really taken by, and what was handed over with it', async () => {
    expect(await (await patch('sale-paid', { paymentKey: 'pay-0', method: 'ewallet' })).json()).toEqual({ success: true })
    expect(store.doc('sale-paid')).toMatchObject({
      payments: [{ _type: 'salePayment', _key: 'pay-0', method: 'ewallet', amount: 430 }],
      paymentAmount: 430,
      change: 0,
    })
  })

  it('notes on the payment what it was taken as and when it moved, by the server’s clock, and logs the move', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-11T06:02:00.000Z'))
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    try {
      expect((await patch('sale-paid', { paymentKey: 'pay-0', method: 'card' })).status).toBe(200)
    } finally {
      vi.useRealTimers()
    }
    expect(store.doc('sale-paid')!.payments).toEqual([
      { _type: 'salePayment', _key: 'pay-0', method: 'card', amount: 430, movedFrom: 'cash', movedAt: '2026-10-11T06:02:00.000Z', receivedBefore: 500 },
    ])
    expect(info).toHaveBeenCalledWith('Payment method changed', { id: 'sale-paid', key: 'pay-0', from: 'cash', to: 'card', amount: 430 })
  })

  it('logs nothing when the payment already had that method', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    expect((await patch('sale-paid', { paymentKey: 'pay-0', method: 'cash' })).status).toBe(200)
    expect(info).not.toHaveBeenCalled()
    expect(store.doc('sale-paid')!.payments).toEqual(paid.payments)
  })

  it('works from the order as it now is when another device saved between the read and the write', async () => {
    const read = store.client.getDocument
    let once = true
    store.client.getDocument = async <T,>(id: string) => {
      const doc = await read<T>(id)
      if (once) {
        once = false
        store.touch(id, { notes: 'Ana B.' })
      }
      return doc
    }
    expect((await patch('sale-paid', { paymentKey: 'pay-0', method: 'card' })).status).toBe(200)
    expect(store.doc('sale-paid')).toMatchObject({ notes: 'Ana B.', payments: [{ _key: 'pay-0', method: 'card', amount: 430 }] })
  })

  it('never leaves the change negative, however what was handed over was stored before', async () => {
    // ₱100 in cash from ₱1,000, then an older POS added a ₱50 line and stored paymentAmount 150.
    const drifted: FakeDoc = {
      ...plain, _id: 'sale-drift', total: 150, paymentAmount: 150, change: 0,
      payments: [{ _type: 'salePayment', _key: 'pay-0', method: 'cash', amount: 100, received: 1000 }],
    }
    store = fakeSanityClient([drifted])
    sanity.client = store.client
    expect((await patch('sale-drift', { paymentKey: 'pay-0', method: 'card' })).status).toBe(200)
    expect(store.doc('sale-drift')).toMatchObject({ paymentAmount: 150, change: 0 })
  })

  it('says the payment changed on another device when it is no longer on the order', async () => {
    const res = await patch('sale-paid', { paymentKey: 'pay-9', method: 'card' })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('This payment changed on another device. Refresh, then try again.')
  })

  it('refuses a method it does not know, a key that is not one, and an id that is not an order', async () => {
    expect((await patch('sale-paid', { paymentKey: 'pay-0', method: 'gcash' })).status).toBe(400)
    expect((await patch('sale-paid', { paymentKey: 'pay-0"]', method: 'card' })).status).toBe(400)
    expect((await patch('sale-gone', { paymentKey: 'pay-0', method: 'card' })).status).toBe(404)
    expect(store.doc('sale-paid')!.payments).toEqual(paid.payments)
  })
})

// ── Serving items one by one (Sales) ─────────────────────────────────────────

// Bea's order from the owner's example: a Spanish Latte with oat milk, an Americano, nachos and fries.
const spanish = line('spanish-latte__ice', 'Spanish Latte', 150, 1, { variant: 'ice', categoryId: 'signature' })
const oat = line('addon__oat-milk__spanish-latte__ice', 'Oat Milk', 30, 1, { variant: null, isAddon: true, parentLineId: 'spanish-latte__ice' })
const americano = line('americano__hot', 'Americano', 100, 1, { categoryId: 'espresso' })
const nachos = line('cheesy-beef-nachos__fixed', 'Cheesy Beef Nachos', 180, 1, { variant: null, categoryId: 'snack' })
const fries = line('classic-fries__fixed', 'Classic Fries', 120, 1, { variant: null, categoryId: 'snack' })
const beas: FakeDoc = {
  _id: 'sale-bea', _type: 'sale', total: 580, subtotal: 580, paymentAmount: 580, change: 0, notes: 'Bea',
  items: [spanish, oat, americano, nachos, fries],
}
// When the first items went out, and the server's clock for the request under test.
const OUT = '2026-11-24T11:46:00.000Z'
const NOW = '2026-11-24T11:53:00.000Z'
const out = <T extends object>(item: T, at = OUT) => ({ ...item, servedAt: at })
const CHANGED = 'This order changed on another device. Refresh, then try again.'

/** Runs `change` right after each of the route's first `times` reads, as another device would; counts the reads. */
const changeAfterRead = (times: number, change: (id: string) => void) => {
  const read = store.client.getDocument
  let reads = 0
  store.client.getDocument = async <T,>(id: string) => {
    const doc = await read<T>(id)
    if (reads++ < times) change(id)
    return doc
  }
  return () => reads
}

describe('Serving items one by one on Sales', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(NOW))
    store = fakeSanityClient([beas, member])
    sanity.client = store.client
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('PATCH /api/sales/[id] { serveLineIds }', () => {
    it('ticks an item as served at the server’s time; the order stays open while items are left', async () => {
      const res = await patch('sale-bea', { serveLineIds: ['americano__hot'] })
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ success: true, isCompleted: false, servedAt: NOW })
      expect(store.doc('sale-bea')!.items).toEqual([spanish, oat, out(americano, NOW), nachos, fries])
      expect(store.doc('sale-bea')!.isCompleted).toBe(false)
    })

    it('ticks several items at once; an add-on takes no time of its own, it goes out with its item', async () => {
      await patch('sale-bea', { serveLineIds: ['spanish-latte__ice', 'cheesy-beef-nachos__fixed'] })
      expect(store.doc('sale-bea')!.items).toEqual([out(spanish, NOW), oat, americano, out(nachos, NOW), fries])
    })

    it('completes the order when its last item goes out', async () => {
      store.touch('sale-bea', { items: [out(spanish), oat, out(americano), out(nachos), fries] })
      const res = await patch('sale-bea', { serveLineIds: ['classic-fries__fixed'] })
      expect(await res.json()).toEqual({ success: true, isCompleted: true, servedAt: NOW })
      expect(store.doc('sale-bea')!.isCompleted).toBe(true)
      expect(store.doc('sale-bea')!.items).toEqual([out(spanish), oat, out(americano), out(nachos), out(fries, NOW)])
    })

    it('writes nothing for an item already out: it keeps its time', async () => {
      store.touch('sale-bea', { items: [spanish, oat, out(americano), nachos, fries] })
      const before = store.doc('sale-bea')
      const res = await patch('sale-bea', { serveLineIds: ['americano__hot'] })
      expect(await res.json()).toEqual({ success: true, isCompleted: false, servedAt: null })
      expect(store.doc('sale-bea')).toEqual(before)
    })

    it('writes nothing on a completed order, whose items all count as out: no time is made up', async () => {
      // Completed before items were ticked one by one, so no item has a time.
      store.touch('sale-bea', { isCompleted: true })
      const before = store.doc('sale-bea')
      const res = await patch('sale-bea', { serveLineIds: ['classic-fries__fixed'] })
      expect(await res.json()).toEqual({ success: true, isCompleted: true, servedAt: null })
      expect(store.doc('sale-bea')).toEqual(before)
    })

    it('keeps a tick made on another device between its read and its write', async () => {
      // This device ticks the fries while another ticks the nachos.
      changeAfterRead(1, id => store.touch(id, { items: [spanish, oat, americano, out(nachos), fries] }))
      const res = await patch('sale-bea', { serveLineIds: ['classic-fries__fixed'] })
      expect(await res.json()).toEqual({ success: true, isCompleted: false, servedAt: NOW })
      expect(store.doc('sale-bea')!.items).toEqual([spanish, oat, americano, out(nachos), out(fries, NOW)])
    })

    it('writes nothing when another device ticked the same item first, and says the order is now completed', async () => {
      store.touch('sale-bea', { items: [out(spanish), oat, out(americano), out(nachos), fries] })
      const allOut = [out(spanish), oat, out(americano), out(nachos), out(fries)]
      changeAfterRead(1, id => store.touch(id, { isCompleted: true, items: allOut }))
      const res = await patch('sale-bea', { serveLineIds: ['classic-fries__fixed'] })
      expect(await res.json()).toEqual({ success: true, isCompleted: true, servedAt: null })
      expect(store.doc('sale-bea')!.items).toEqual(allOut)
    })

    it('gives up after three tries when the order keeps changing, saying so, and writes nothing of its own', async () => {
      const reads = changeAfterRead(Infinity, id => store.touch(id, { notes: 'Bea B.' }))
      const res = await patch('sale-bea', { serveLineIds: ['classic-fries__fixed'] })
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ success: false, error: CHANGED })
      expect(reads()).toBe(3)
      expect(store.doc('sale-bea')!.items).toEqual(beas.items)
    })

    it('refuses an add-on, or an item no longer on the order: the order changed on another device', async () => {
      for (const lineId of ['addon__oat-milk__spanish-latte__ice', 'iced-tea__ice']) {
        const res = await patch('sale-bea', { serveLineIds: ['americano__hot', lineId] })
        expect(res.status).toBe(409)
        expect(await res.json()).toEqual({ success: false, error: CHANGED })
      }
      expect(store.doc('sale-bea')!.items).toEqual(beas.items)
      // A tick changes nothing on a completed order, but an item not on it is still a change elsewhere.
      store.touch('sale-bea', { isCompleted: true })
      expect((await patch('sale-bea', { serveLineIds: ['iced-tea__ice'] })).status).toBe(409)
    })

    it('answers 404 for an order that is gone, even when it goes between the read and the write, and for a document that is not an order', async () => {
      expect((await patch('sale-gone', { serveLineIds: ['americano__hot'] })).status).toBe(404)
      expect((await patch('kylene', { serveLineIds: ['americano__hot'] })).status).toBe(404)
      changeAfterRead(1, id => void store.client.delete(id))
      expect((await patch('sale-bea', { serveLineIds: ['americano__hot'] })).status).toBe(404)
    })

    it('answers 422 for an order whose lines it can’t read', async () => {
      for (const items of ['Americano, fries', [{ _key: 'americano', name: 'Americano', price: 100, qty: 1 }]]) {
        store.touch('sale-bea', { items })
        expect((await patch('sale-bea', { serveLineIds: ['americano__hot'] })).status).toBe(422)
      }
    })

    it('needs the POS session', async () => {
      requirePosAuth.mockResolvedValue(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
      expect((await patch('sale-bea', { serveLineIds: ['americano__hot'] })).status).toBe(401)
      expect(store.doc('sale-bea')!.items).toEqual(beas.items)
    })

    it('answers 500 and logs why when the tick can’t be saved', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      sanity.client = { ...store.client, getDocument: () => Promise.reject(new Error('Sanity is down')) }
      const res = await patch('sale-bea', { serveLineIds: ['americano__hot'] })
      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ success: false, error: 'Failed to update the order.' })
      expect(error).toHaveBeenCalledWith('Items could not be ticked or unticked', expect.objectContaining({ id: 'sale-bea' }), expect.any(Error))
    })
  })

  describe('PATCH /api/sales/[id] { unserveLineIds }', () => {
    it('unticks an item: it goes back to be served, and a completed order reopens', async () => {
      store.touch('sale-bea', { isCompleted: true, items: [out(spanish), oat, out(americano), out(nachos), out(fries)] })
      const res = await patch('sale-bea', { unserveLineIds: ['classic-fries__fixed'] })
      expect(await res.json()).toEqual({ success: true, isCompleted: false, servedAt: null })
      expect(store.doc('sale-bea')!.isCompleted).toBe(false)
      expect(store.doc('sale-bea')!.items).toEqual([out(spanish), oat, out(americano), out(nachos), fries])
    })

    it('keeps the other items of an order completed before ticking out, as of when it was last saved', async () => {
      const SAVED = '2026-11-20T10:15:00Z'
      store.touch('sale-bea', { isCompleted: true, _updatedAt: SAVED })
      const res = await patch('sale-bea', { unserveLineIds: ['classic-fries__fixed'] })
      expect(await res.json()).toEqual({ success: true, isCompleted: false, servedAt: null })
      expect(store.doc('sale-bea')!.items).toEqual([out(spanish, SAVED), oat, out(americano, SAVED), out(nachos, SAVED), fries])
    })

    it('times them by the server’s clock when the order carries no save time', async () => {
      store.touch('sale-bea', { isCompleted: true })
      await patch('sale-bea', { unserveLineIds: ['classic-fries__fixed'] })
      expect(store.doc('sale-bea')!.items).toEqual([out(spanish, NOW), oat, out(americano, NOW), out(nachos, NOW), fries])
    })

    it('writes nothing when the item was not out', async () => {
      const before = store.doc('sale-bea')
      const res = await patch('sale-bea', { unserveLineIds: ['classic-fries__fixed'] })
      expect(await res.json()).toEqual({ success: true, isCompleted: false, servedAt: null })
      expect(store.doc('sale-bea')).toEqual(before)
    })

    it('keeps a tick made on another device between its read and its write', async () => {
      store.touch('sale-bea', { items: [out(spanish), oat, americano, nachos, out(fries)] })
      changeAfterRead(1, id => store.touch(id, { items: [out(spanish), oat, americano, out(nachos), out(fries)] }))
      expect((await patch('sale-bea', { unserveLineIds: ['classic-fries__fixed'] })).status).toBe(200)
      expect(store.doc('sale-bea')!.items).toEqual([out(spanish), oat, americano, out(nachos), fries])
    })

    it('refuses an add-on: it goes back with its item', async () => {
      store.touch('sale-bea', { isCompleted: true, items: [out(spanish), oat, out(americano), out(nachos), out(fries)] })
      const res = await patch('sale-bea', { unserveLineIds: ['addon__oat-milk__spanish-latte__ice'] })
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ success: false, error: CHANGED })
      expect(store.doc('sale-bea')!.isCompleted).toBe(true)
    })

    it('still unticks when another device completes the order between its read and its write', async () => {
      store.touch('sale-bea', { items: [out(spanish), oat, americano, nachos, out(fries)] })
      // Another device taps Complete: the Americano and the nachos go out at its time.
      const COMPLETED = '2026-11-24T11:50:00.000Z'
      changeAfterRead(1, id =>
        store.touch(id, { isCompleted: true, items: [out(spanish), oat, out(americano, COMPLETED), out(nachos, COMPLETED), out(fries)] }))
      const res = await patch('sale-bea', { unserveLineIds: ['classic-fries__fixed'] })
      expect(await res.json()).toEqual({ success: true, isCompleted: false, servedAt: null })
      expect(store.doc('sale-bea')!.items).toEqual([out(spanish), oat, out(americano, COMPLETED), out(nachos, COMPLETED), fries])
    })

    it('gives up after three tries when the order keeps changing, writing nothing of its own', async () => {
      const partly = [spanish, oat, out(americano), nachos, fries]
      store.touch('sale-bea', { items: partly })
      const reads = changeAfterRead(Infinity, id => store.touch(id, { notes: 'Bea B.' }))
      const res = await patch('sale-bea', { unserveLineIds: ['americano__hot'] })
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ success: false, error: CHANGED })
      expect(reads()).toBe(3)
      expect(store.doc('sale-bea')!.items).toEqual(partly)
    })

    it('answers 404 for an order that is gone, even when it goes between the read and the write', async () => {
      expect((await patch('sale-gone', { unserveLineIds: ['americano__hot'] })).status).toBe(404)
      store.touch('sale-bea', { items: [spanish, oat, out(americano), nachos, fries] })
      changeAfterRead(1, id => void store.client.delete(id))
      expect((await patch('sale-bea', { unserveLineIds: ['americano__hot'] })).status).toBe(404)
    })

    it('answers 422 for an order whose lines it can’t read', async () => {
      store.touch('sale-bea', { items: 'Americano, fries' })
      expect((await patch('sale-bea', { unserveLineIds: ['americano__hot'] })).status).toBe(422)
    })

    it('answers 500 and logs why when the untick can’t be saved', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      sanity.client = { ...store.client, getDocument: () => Promise.reject(new Error('Sanity is down')) }
      const res = await patch('sale-bea', { unserveLineIds: ['americano__hot'] })
      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ success: false, error: 'Failed to update the order.' })
      expect(error).toHaveBeenCalledWith('Items could not be ticked or unticked', { id: 'sale-bea', serve: false, lineIds: ['americano__hot'] }, expect.any(Error))
    })
  })

  describe('PATCH /api/sales/[id] { serveLineIds | unserveLineIds }, the body', () => {
    it('refuses both keys in one body, a list that is empty or longer than 102, and ids that are not ids', async () => {
      const before = store.doc('sale-bea')
      const bodies = [
        { serveLineIds: ['americano__hot'], unserveLineIds: ['classic-fries__fixed'] },
        { serveLineIds: [] },
        { unserveLineIds: 'classic-fries__fixed' },
        { serveLineIds: null },
        { serveLineIds: Array.from({ length: 103 }, () => 'americano__hot') },
        { serveLineIds: ['americano__hot"]'] },
        { serveLineIds: ['x'.repeat(101)] },
        { unserveLineIds: [42] },
      ]
      for (const body of bodies) {
        const res = await patch('sale-bea', body)
        expect(res.status, JSON.stringify(body).slice(0, 80)).toBe(400)
        expect((await res.json()).success).toBe(false)
      }
      expect(store.doc('sale-bea')).toEqual(before)
    })

    it('takes up to 102 ids of up to 100 characters each', async () => {
      expect((await patch('sale-bea', { serveLineIds: Array.from({ length: 102 }, () => 'americano__hot') })).status).toBe(200)
      // A well-formed id that is not on the order is a change on another device, not a bad body.
      expect((await patch('sale-bea', { serveLineIds: ['x'.repeat(100)] })).status).toBe(409)
    })
  })

  describe('PATCH /api/sales/[id] { markCompleted }, items ticked one by one', () => {
    it('ticks every item still to serve at the server’s time, keeps the times already there, and completes the order', async () => {
      store.touch('sale-bea', { items: [out(spanish), oat, americano, out(nachos), fries] })
      const res = await patch('sale-bea', { markCompleted: true })
      expect(await res.json()).toEqual({ success: true })
      expect(store.doc('sale-bea')!.isCompleted).toBe(true)
      expect(store.doc('sale-bea')!.items).toEqual([out(spanish), oat, out(americano, NOW), out(nachos), out(fries, NOW)])
    })

    it('completes an order left with add-ons only, which has no item to tick', async () => {
      store.touch('sale-bea', { items: [oat] })
      expect((await patch('sale-bea', { markCompleted: true })).status).toBe(200)
      expect(store.doc('sale-bea')).toMatchObject({ isCompleted: true, items: [oat] })
    })

    it('leaves a completed order as it was: no times are made up for one completed before ticking', async () => {
      store.touch('sale-bea', { isCompleted: true })
      const before = store.doc('sale-bea')
      expect(await (await patch('sale-bea', { markCompleted: true })).json()).toEqual({ success: true })
      expect(store.doc('sale-bea')).toEqual(before)
    })

    it('keeps a tick made on another device between its read and its write, at its own time', async () => {
      changeAfterRead(1, id => store.touch(id, { items: [spanish, oat, americano, out(nachos), fries] }))
      expect((await patch('sale-bea', { markCompleted: true })).status).toBe(200)
      expect(store.doc('sale-bea')!.items).toEqual([out(spanish, NOW), oat, out(americano, NOW), out(nachos), out(fries, NOW)])
    })

    it('gives up after three tries when the order keeps changing, saying so, and completes nothing', async () => {
      const reads = changeAfterRead(Infinity, id => store.touch(id, { notes: 'Bea B.' }))
      const res = await patch('sale-bea', { markCompleted: true })
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ success: false, error: CHANGED })
      expect(reads()).toBe(3)
      expect(store.doc('sale-bea')!.isCompleted).toBeUndefined()
    })

    it('answers 404 for an order that is gone, even when it goes between the read and the write', async () => {
      expect((await patch('sale-gone', { markCompleted: true })).status).toBe(404)
      changeAfterRead(1, id => void store.client.delete(id))
      expect((await patch('sale-bea', { markCompleted: true })).status).toBe(404)
    })

    it('answers 422 for an order whose lines it can’t read, and 500 with the reason logged when Sanity fails', async () => {
      store.touch('sale-bea', { items: 'Americano, fries' })
      expect((await patch('sale-bea', { markCompleted: true })).status).toBe(422)
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      sanity.client = { ...store.client, getDocument: () => Promise.reject(new Error('Sanity is down')) }
      const res = await patch('sale-bea', { markCompleted: true })
      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ success: false, error: 'Failed to complete order.' })
      expect(error).toHaveBeenCalledWith('Order could not be completed', { id: 'sale-bea' }, expect.any(Error))
    })
  })

  describe('PATCH /api/sales/[id] { removeLineId }, items ticked one by one', () => {
    it('completes the order when the item taken off was the last one still to serve', async () => {
      store.touch('sale-bea', { items: [out(spanish), oat, out(americano), out(nachos), fries] })
      expect(await (await patch('sale-bea', { removeLineId: 'classic-fries__fixed' })).json()).toEqual({ success: true, orderDeleted: false })
      expect(store.doc('sale-bea')!.isCompleted).toBe(true)
      expect(store.doc('sale-bea')!.items).toEqual([out(spanish), oat, out(americano), out(nachos)])
    })

    it('keeps the order open while items are still to serve', async () => {
      store.touch('sale-bea', { items: [out(spanish), oat, americano, out(nachos), fries] })
      await patch('sale-bea', { removeLineId: 'classic-fries__fixed' })
      expect(store.doc('sale-bea')).not.toHaveProperty('isCompleted')
    })

    it('never reopens a completed order', async () => {
      // Completed before items were ticked one by one: no item has a time.
      store.touch('sale-bea', { isCompleted: true })
      await patch('sale-bea', { removeLineId: 'classic-fries__fixed' })
      expect(store.doc('sale-bea')!.isCompleted).toBe(true)
    })
  })
})
