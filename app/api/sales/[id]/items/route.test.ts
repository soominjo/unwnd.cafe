import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { fakeSanityClient, type FakeDoc } from '@/lib/testing/fakeSanityClient'

const { requirePosAuth, fetchCardTotals, sanity } = vi.hoisted(() => ({
  requirePosAuth: vi.fn(),
  fetchCardTotals: vi.fn(),
  sanity: { client: null as unknown },
}))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/lib/loyaltyStore', () => ({ fetchCardTotals }))
vi.mock('@/sanity/lib/writeClient', () => ({ getWriteClient: () => sanity.client }))

import { POST } from './route'

const saved = (lineId: string, name: string, variant: string, price: number, qty: number, categoryId: string) =>
  ({ _type: 'saleItem', _key: lineId, lineId, name, variant, price, qty, categoryId })

// The order in the owner's screenshot: 320 + 160 + 160 + 150 = 790, taken as paid exactly.
const screenshotItems = [
  saved('tiramisu__ice', 'Tiramisu', 'ice', 160, 2, 'signature'),
  saved('white-mocha-americano__ice', 'White Mocha Americano', 'ice', 160, 1, 'signature'),
  saved('white-mocha-americano__hot', 'White Mocha Americano', 'hot', 160, 1, 'signature'),
  saved('amber-cream-latte__ice', 'Amber Cream Latte', 'ice', 150, 1, 'signature'),
]
const open: FakeDoc = {
  _id: 'sale-214', _type: 'sale', _createdAt: '2026-10-03T06:14:00Z',
  total: 790, subtotal: 790, paymentAmount: 790, change: 0, items: screenshotItems,
}
// Kylene's order, linked to her card, with the 10% used on its Cafe Latte: 120 + 170 − 12 = 278.
const kylenes: FakeDoc = {
  _id: 'sale-152', _type: 'sale', _createdAt: '2026-10-03T05:52:00Z', notes: 'Kylene',
  total: 278, subtotal: 290, paymentAmount: 278, change: 0, loyaltyMemberId: 'kylene', loyaltyRewards: ['ten'],
  items: [saved('cereal-cream-latte__ice', 'Cereal Cream Latte', 'ice', 170, 1, 'signature'), saved('cafe-latte__hot', 'Cafe Latte', 'hot', 120, 1, 'espresso')],
  discounts: [{ _type: 'saleDiscount', _key: 'cafe-latte__hot-0', lineId: 'cafe-latte__hot', name: 'Loyalty -10% (Cafe Latte)', amount: 12 }],
}

// New lines carry the adding session's suffix, so they never share an id with a saved line.
const latteNew = { lineId: 'cafe-latte__hot__ak3j9', name: 'Cafe Latte', variant: 'hot', price: 120, qty: 1, categoryId: 'espresso' }
const matchaNew = { lineId: 'matcha-latte__ice__ak3j9', name: 'Matcha Latte', variant: 'ice', price: 170, qty: 1, categoryId: 'matcha-series' }
const AT = '2026-10-03T06:31:00.000Z'
const stamped = (line: typeof latteNew) => ({ _type: 'saleItem', _key: line.lineId, ...line, addedAt: AT })

let store: ReturnType<typeof fakeSanityClient>
const add = (id: string, body: unknown) =>
  POST(new NextRequest(`http://pos.test/api/sales/${id}/items`, { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })
const revOf = (id: string) => store.doc(id)!._rev

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(AT))
  vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token')
  requirePosAuth.mockReset().mockResolvedValue(null)
  fetchCardTotals.mockReset()
  store = fakeSanityClient([open, kylenes])
  sanity.client = store.client
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/sales/[id]/items', () => {
  it('adds the new lines to the same order, stamped with the time, and works the money out', async () => {
    const res = await add('sale-214', { rev: revOf('sale-214'), items: [latteNew, matchaNew] })
    expect(res.status).toBe(200)
    const doc = store.doc('sale-214')!
    expect(doc.items).toEqual([...screenshotItems, stamped(latteNew), stamped(matchaNew)])
    expect(doc).toMatchObject({ subtotal: 1080, total: 1080, paymentAmount: 1080, change: 0, _createdAt: '2026-10-03T06:14:00Z' })
    expect((await res.json()).data).toEqual(doc)
  })

  it('takes the payment for the whole order and the new lines’ discounts off the total', async () => {
    const pwd = { lineId: latteNew.lineId, name: 'PWD Drink -20% (Cafe Latte)', amount: 24 }
    await add('sale-214', { rev: revOf('sale-214'), items: [latteNew, matchaNew], discounts: [pwd], paymentAmount: 1100 })
    expect(store.doc('sale-214')).toMatchObject({
      subtotal: 1080, total: 1056, paymentAmount: 1100, change: 44,
      items: [...screenshotItems, stamped(latteNew), stamped(matchaNew)],
      discounts: [{ _type: 'saleDiscount', _key: 'cafe-latte__hot__ak3j9-0', ...pwd }],
    })
  })

  it('refuses an order completed meanwhile, and one that is gone, adding nothing', async () => {
    store.touch('sale-214', { isCompleted: true })
    const completed = await add('sale-214', { rev: revOf('sale-214'), items: [latteNew] })
    expect(completed.status).toBe(409)
    // The order comes back too, so a POS whose earlier save went through can tell.
    expect(await completed.json()).toMatchObject({ code: 'order-completed', data: { _id: 'sale-214', items: screenshotItems } })
    expect(store.doc('sale-214')!.items).toEqual(screenshotItems)
    const gone = await add('sale-gone', { rev: 'rev-1', items: [latteNew] })
    expect(gone.status).toBe(404)
    expect(await gone.json()).toMatchObject({ code: 'order-gone' })
  })

  it('refuses a second save of the same lines, sending the order as it now is', async () => {
    const rev = revOf('sale-214')
    expect((await add('sale-214', { rev, items: [latteNew] })).status).toBe(200)
    // The reply was lost and the cashier taps Save again: the order has moved on.
    const again = await add('sale-214', { rev, items: [latteNew] })
    expect(again.status).toBe(409)
    const body = await again.json()
    expect(body.code).toBe('order-changed')
    expect(body.data.items).toEqual([...screenshotItems, stamped(latteNew)])
    expect(store.doc('sale-214')!.items).toHaveLength(5)
  })

  it('refuses a save when the order changes between the check and the write', async () => {
    const read = store.client.getDocument
    store.client.getDocument = async <T,>(id: string) => {
      const doc = await read<T>(id)
      store.touch(id, { paymentAmount: 1000 })
      return doc
    }
    const res = await add('sale-214', { rev: revOf('sale-214'), items: [latteNew] })
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('order-changed')
    expect(store.doc('sale-214')!.items).toEqual(screenshotItems)
  })

  it('names or renames the order with the name sent, or clears it, but keeps a card holder’s name', async () => {
    await add('sale-214', { rev: revOf('sale-214'), items: [latteNew], notes: '  Juan ' })
    expect(store.doc('sale-214')!.notes).toBe('Juan')
    await add('sale-214', { rev: revOf('sale-214'), items: [matchaNew], notes: 'Juanito' })
    expect(store.doc('sale-214')!.notes).toBe('Juanito')
    await add('sale-214', { rev: revOf('sale-214'), items: [{ ...latteNew, lineId: 'cafe-latte__hot__bq2k1' }], notes: '' })
    expect(store.doc('sale-214')).not.toHaveProperty('notes')
    await add('sale-152', { rev: revOf('sale-152'), items: [matchaNew], notes: 'Someone else' })
    expect(store.doc('sale-152')!.notes).toBe('Kylene')
  })

  it('works the subtotal out from the lines for an order saved before subtotals were kept', async () => {
    store.touch('sale-214', { subtotal: undefined })
    await add('sale-214', { rev: revOf('sale-214'), items: [latteNew] })
    expect(store.doc('sale-214')).toMatchObject({ subtotal: 910, total: 910 })
  })

  it('refuses more than 50 lines in all, saying so', async () => {
    const many = Array.from({ length: 49 }, (_, i) => saved(`line-${i}`, 'Americano', 'hot', 100, 1, 'espresso'))
    store.touch('sale-214', { items: many })
    const res = await add('sale-214', { rev: revOf('sale-214'), items: [latteNew, matchaNew] })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('An order holds up to 50 lines. Start a new order for the rest.')
  })

  it('refuses new lines that reuse a saved line’s id, and bodies that are not one', async () => {
    const rev = revOf('sale-214')
    expect((await add('sale-214', { rev, items: [{ ...latteNew, lineId: 'tiramisu__ice' }] })).status).toBe(400)
    expect((await add('sale-214', { items: [latteNew] })).status).toBe(400)
    expect((await add('sale-214', { rev, items: [] })).status).toBe(400)
    expect((await add('sale-214', { rev, items: [{ ...latteNew, qty: 0.5 }] })).status).toBe(400)
    expect((await add('sale-214', { rev, items: [latteNew], discounts: [{ lineId: 'tiramisu__ice', name: 'PWD Drink -20% (Tiramisu)', amount: 32 }] })).status).toBe(400)
    expect((await add('sale-214', { rev, items: [latteNew], discounts: [{ lineId: latteNew.lineId, name: 'Too much', amount: 121 }] })).status).toBe(400)
    expect(store.doc('sale-214')!.items).toEqual(screenshotItems)
  })

  it('refuses a discount bigger than its own line, even beside a dearer line', async () => {
    const res = await add('sale-214', {
      rev: revOf('sale-214'),
      items: [latteNew, matchaNew],
      discounts: [{ lineId: latteNew.lineId, name: 'PWD Drink -20% (Cafe Latte)', amount: 200 }],
    })
    expect(res.status).toBe(400)
    // A row may cover its line's add-ons too.
    const shot = { lineId: 'addon__shot__cafe-latte__hot__ak3j9', name: 'Espresso Shot', variant: null, price: 30, qty: 1, parentLineId: latteNew.lineId }
    const fine = await add('sale-214', {
      rev: revOf('sale-214'),
      items: [latteNew, shot],
      discounts: [{ lineId: latteNew.lineId, name: 'Loyalty free drink (Cafe Latte)', amount: 120 }, { lineId: latteNew.lineId, name: 'PWD Drink -20% (Cafe Latte)', amount: 6 }],
    })
    expect(fine.status).toBe(200)
  })

  it('refuses a total over ₱1,000,000, and more discount rows than one order holds', async () => {
    const pricey = { ...latteNew, price: 1_000_000 }
    const tooMuch = await add('sale-214', { rev: revOf('sale-214'), items: [pricey] })
    expect(tooMuch.status).toBe(400)
    expect((await tooMuch.json()).error).toBe('An order can come to at most ₱1,000,000.')

    const rows = Array.from({ length: 101 }, (_, i) => ({ _type: 'saleDiscount', _key: `old-${i}`, lineId: 'tiramisu__ice', name: 'PWD Drink -20% (Tiramisu)', amount: 0 }))
    store.touch('sale-214', { discounts: rows })
    const twoMore = [
      { lineId: latteNew.lineId, name: 'PWD Drink -20% (Cafe Latte)', amount: 24 },
      { lineId: latteNew.lineId, name: 'Google Review -10% (Cafe Latte)', amount: 12 },
    ]
    expect((await add('sale-214', { rev: revOf('sale-214'), items: [latteNew], discounts: twoMore })).status).toBe(400)
    expect(store.doc('sale-214')!.items).toEqual(screenshotItems)
  })

  it('refuses to add to an order it can’t read the money of', async () => {
    store.touch('sale-214', { total: 'seven hundred' })
    expect((await add('sale-214', { rev: revOf('sale-214'), items: [latteNew] })).status).toBe(422)
    expect(store.doc('sale-214')!.items).toEqual(screenshotItems)
  })

  it('needs the POS session', async () => {
    requirePosAuth.mockResolvedValue(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    expect((await add('sale-214', { rev: revOf('sale-214'), items: [latteNew] })).status).toBe(401)
    expect(store.doc('sale-214')!.items).toEqual(screenshotItems)
  })
})

describe('POST /api/sales/[id]/items on a loyalty card holder’s order', () => {
  const signatureNew = { lineId: 'tiramisu__ice__ak3j9', name: 'Tiramisu', variant: 'ice', price: 160, qty: 1, categoryId: 'signature' }
  const americanoNew = { lineId: 'americano__hot__ak3j9', name: 'Americano', variant: 'hot', price: 100, qty: 1, categoryId: 'espresso' }
  const free = { lineId: americanoNew.lineId, name: 'Loyalty free drink (Americano)', amount: 100 }

  it('adds drinks with no card check when no reward is used: their stamps count from the lines', async () => {
    expect((await add('sale-152', { rev: revOf('sale-152'), items: [signatureNew] })).status).toBe(200)
    expect(fetchCardTotals).not.toHaveBeenCalled()
  })

  it('uses a reward the card has ready on the new lines, and records it with the order', async () => {
    // Ten stamps saved, this order's first part included: the added Tiramisu is the eleventh.
    fetchCardTotals.mockResolvedValue({ earned: 10, usedTen: 1, usedFree: 0 })
    const res = await add('sale-152', { rev: revOf('sale-152'), items: [signatureNew, americanoNew], discounts: [free], loyaltyRewards: ['free'] })
    expect(res.status).toBe(200)
    expect(fetchCardTotals).toHaveBeenCalledWith('kylene')
    expect(store.doc('sale-152')).toMatchObject({ loyaltyRewards: ['ten', 'free'], subtotal: 550, total: 438 })
  })

  it('refuses a reward the order already used, one with no new classic drink to go on, and one on an order with no card', async () => {
    fetchCardTotals.mockResolvedValue({ earned: 11, usedTen: 1, usedFree: 0 })
    const rev = revOf('sale-152')
    expect((await add('sale-152', { rev, items: [americanoNew], loyaltyRewards: ['ten'] })).status).toBe(400)
    expect((await add('sale-152', { rev, items: [signatureNew], loyaltyRewards: ['free'] })).status).toBe(400)
    expect((await add('sale-214', { rev: revOf('sale-214'), items: [americanoNew], loyaltyRewards: ['free'] })).status).toBe(400)
    expect(store.doc('sale-152')!.loyaltyRewards).toEqual(['ten'])
  })

  it('says the card changed when the reward is no longer ready, or the card is gone', async () => {
    fetchCardTotals.mockResolvedValueOnce({ earned: 10, usedTen: 1, usedFree: 1 })
    const spent = await add('sale-152', { rev: revOf('sale-152'), items: [signatureNew, americanoNew], discounts: [free], loyaltyRewards: ['free'] })
    expect(spent.status).toBe(409)
    expect(await spent.json()).toMatchObject({ code: 'loyalty-card-changed', error: 'This card has no free drink ready.' })
    fetchCardTotals.mockResolvedValueOnce(null)
    expect((await add('sale-152', { rev: revOf('sale-152'), items: [signatureNew, americanoNew], discounts: [free], loyaltyRewards: ['free'] })).status).toBe(409)
  })

  it('asks to try again when the card cannot be checked', async () => {
    fetchCardTotals.mockRejectedValueOnce(new Error('Sanity timeout'))
    const res = await add('sale-152', { rev: revOf('sale-152'), items: [signatureNew, americanoNew], discounts: [free], loyaltyRewards: ['free'] })
    expect(res.status).toBe(503)
    expect(console.error).toHaveBeenCalled()
  })
})
