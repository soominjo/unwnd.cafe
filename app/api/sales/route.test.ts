import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requirePosAuth, create, fetchCardTotals } = vi.hoisted(() => ({
  requirePosAuth: vi.fn(), create: vi.fn(), fetchCardTotals: vi.fn(),
}))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/sanity/lib/writeClient', () => ({ getWriteClient: () => ({ create }) }))
vi.mock('@/sanity/lib/client', () => ({ client: { withConfig: () => ({ fetch: vi.fn() }) } }))
vi.mock('@/lib/loyaltyStore', () => ({ fetchCardTotals }))
vi.mock('@/lib/sales/rewardsRefusal', () => ({ rewardsRefusal: async () => 'Rewards need items (named by the menu).' }))

import { POST } from './route'

const signature = { lineId: 'tiramisu__ice', name: 'Tiramisu', variant: 'ice', price: 160, qty: 1, categoryId: 'signature' }
const latte = { lineId: 'cafe-latte__hot', name: 'Cafe Latte', variant: 'hot', price: 110, qty: 1, categoryId: 'espresso' }
// A Signature drink (a stamp) and a classic drink (for a reward to go on).
const sale = (over: Record<string, unknown> = {}) => ({ total: 259, paymentAmount: 300, subtotal: 270, items: [signature, latte], notes: 'Kylene', ...over })
const post = (body: unknown) => POST(new NextRequest('http://pos.test/api/sales', { method: 'POST', body: JSON.stringify(body) }))
// Five stamps saved: this order's Signature drink is the sixth, so its 10% is ready.
const fiveStamps = { earned: 5, usedTen: 0, usedFree: 0 }

beforeEach(() => {
  vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token')
  requirePosAuth.mockReset().mockResolvedValue(null)
  create.mockReset().mockResolvedValue({ _id: 'sale-1' })
  fetchCardTotals.mockReset().mockResolvedValue(fiveStamps)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/sales with a loyalty card', () => {
  it('saves the card and the rewards used with the sale', async () => {
    const res = await post(sale({ loyaltyMemberId: 'kylene', loyaltyRewards: ['ten'] }))
    expect(res.status).toBe(200)
    expect(fetchCardTotals).toHaveBeenCalledWith('kylene')
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ loyaltyMemberId: 'kylene', loyaltyRewards: ['ten'] }))
  })

  it('refuses rewards that have no item of their own to go on', async () => {
    fetchCardTotals.mockResolvedValue({ earned: 11, usedTen: 0, usedFree: 0 })
    // A Signature drink only: the 10% has no Espresso, Non-Coffee, Waffle or Snack item to go on.
    const none = await post(sale({ items: [signature], loyaltyMemberId: 'kylene', loyaltyRewards: ['ten'] }))
    expect(none.status).toBe(400)
    expect((await none.json()).error).toBe('Rewards need items (named by the menu).')
    // One Cafe Latte cannot be both the free drink and the 10% one.
    expect((await post(sale({ items: [latte], loyaltyMemberId: 'kylene', loyaltyRewards: ['ten', 'free'] }))).status).toBe(400)
    expect((await post(sale({ items: [{ ...latte, qty: 2 }], loyaltyMemberId: 'kylene', loyaltyRewards: ['ten', 'free'] }))).status).toBe(200)
  })

  it('takes the 10% on a Waffle or Snack too, but never makes one the free drink', async () => {
    const waffle = { lineId: 'classic-waffle__fixed', name: 'Classic Waffle', variant: null, price: 150, qty: 1, categoryId: 'waffle' }
    const waffleSale = { items: [signature, waffle], subtotal: 310, total: 295, paymentAmount: 300, loyaltyMemberId: 'kylene' }
    expect((await post(sale({ ...waffleSale, loyaltyRewards: ['ten'] }))).status).toBe(200)
    fetchCardTotals.mockResolvedValue({ earned: 11, usedTen: 1, usedFree: 0 })
    expect((await post(sale({ ...waffleSale, loyaltyRewards: ['free'] }))).status).toBe(400)
  })

  it('refuses a malformed card link: a draft id, or a reward given twice', async () => {
    expect((await post(sale({ loyaltyMemberId: 'drafts.kylene' }))).status).toBe(400)
    expect((await post(sale({ loyaltyMemberId: 'kylene', loyaltyRewards: ['ten', 'ten'] }))).status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('says the card changed when it was removed, or the reward is not ready, and saves nothing', async () => {
    fetchCardTotals.mockResolvedValueOnce(null)
    const removed = await post(sale({ loyaltyMemberId: 'kylene' }))
    expect(removed.status).toBe(409)
    expect(await removed.json()).toEqual({ success: false, code: 'loyalty-card-changed', error: 'This loyalty card was removed.' })

    // The 10% was already used on another device.
    fetchCardTotals.mockResolvedValueOnce({ ...fiveStamps, usedTen: 1 })
    const spent = await post(sale({ loyaltyMemberId: 'kylene', loyaltyRewards: ['ten'] }))
    expect(spent.status).toBe(409)
    expect(await spent.json()).toMatchObject({ code: 'loyalty-card-changed', error: 'This card has no 10% off ready.' })
    expect(create).not.toHaveBeenCalled()
  })

  it('logs a card that could not be checked, and says how to go on', async () => {
    fetchCardTotals.mockRejectedValueOnce(new Error('Sanity timeout'))
    const res = await post(sale({ loyaltyMemberId: 'kylene' }))
    expect(res.status).toBe(503)
    expect((await res.json()).error).toContain('unlink it to charge without stamps')
    expect(console.error).toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})

describe('POST /api/sales', () => {
  it('saves a sale with no card without reading any card', async () => {
    expect((await post(sale({ total: 160 }))).status).toBe(200)
    expect(fetchCardTotals).not.toHaveBeenCalled()
  })

  it('refuses part of a drink, since quantities count stamps', async () => {
    expect((await post(sale({ items: [{ ...signature, qty: 1.5 }] }))).status).toBe(400)
  })

  it('refuses a sale with no lines, or more than 50', async () => {
    expect((await post(sale({ items: [] }))).status).toBe(400)
    const many = Array.from({ length: 51 }, (_, i) => ({ ...signature, lineId: `line-${i}` }))
    expect((await post(sale({ items: many }))).status).toBe(400)
    expect((await post(sale({ items: many.slice(0, 50) }))).status).toBe(200)
  })

  it('refuses a discount row that is not one: no name, or a negative amount', async () => {
    expect((await post(sale({ discounts: [{ lineId: 'tiramisu__ice', name: '', amount: 16 }] }))).status).toBe(400)
    expect((await post(sale({ discounts: [{ lineId: 'tiramisu__ice', name: 'PWD Drink -20% (Tiramisu)', amount: -16 }] }))).status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('stores each line under its own key, flagging only a line with a parent as an add-on', async () => {
    const shot = { lineId: 'addon__shot__tiramisu__ice', name: 'Espresso Shot', variant: null, price: 30, qty: 1, parentLineId: 'tiramisu__ice' }
    const oat = { lineId: 'addon__oat', name: 'Oat Milk', variant: null, price: 40, qty: 1, note: 'on the side' }
    await post(sale({ items: [signature, shot, oat], discounts: [{ lineId: 'tiramisu__ice', name: 'PWD Drink -20% (Tiramisu)', amount: 32 }] }))
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      items: [
        { _type: 'saleItem', _key: 'tiramisu__ice', lineId: 'tiramisu__ice', name: 'Tiramisu', variant: 'ice', price: 160, qty: 1, categoryId: 'signature' },
        { _type: 'saleItem', _key: 'addon__shot__tiramisu__ice', lineId: 'addon__shot__tiramisu__ice', name: 'Espresso Shot', variant: null, price: 30, qty: 1, isAddon: true, parentLineId: 'tiramisu__ice' },
        { _type: 'saleItem', _key: 'addon__oat', lineId: 'addon__oat', name: 'Oat Milk', variant: null, price: 40, qty: 1, note: 'on the side' },
      ],
      discounts: [{ _type: 'saleDiscount', _key: 'tiramisu__ice-0', lineId: 'tiramisu__ice', name: 'PWD Drink -20% (Tiramisu)', amount: 32 }],
    }))
  })

  it('logs a sale that could not be saved', async () => {
    create.mockRejectedValueOnce(new Error('Sanity down'))
    expect((await post(sale({ total: 160 }))).status).toBe(500)
    expect(console.error).toHaveBeenCalled()
  })
})

describe('POST /api/sales with how it was paid', () => {
  it('stores Dine in or Take out and each payment, keyed, with what was handed over and the change', async () => {
    const res = await post(sale({ orderType: 'take-out', payments: [{ method: 'cash', amount: 259, received: 300 }] }))
    expect(res.status).toBe(200)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      orderType: 'take-out',
      payments: [{ _type: 'salePayment', _key: 'pay-0', method: 'cash', amount: 259, received: 300 }],
      paymentAmount: 300,
      change: 41,
    }))
  })

  it('works out what was handed over from the payments, whatever paymentAmount says', async () => {
    await post(sale({ paymentAmount: 999, orderType: 'dine-in', payments: [{ method: 'ewallet', amount: 159 }, { method: 'cash', amount: 100, received: 200 }] }))
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      payments: [
        { _type: 'salePayment', _key: 'pay-0', method: 'ewallet', amount: 159 },
        { _type: 'salePayment', _key: 'pay-1', method: 'cash', amount: 100, received: 200 },
      ],
      paymentAmount: 359,
      change: 100,
    }))
  })

  it('takes no payment on a ₱0 order', async () => {
    const free = { ...latte, price: 0 }
    expect((await post(sale({ items: [free], subtotal: 0, total: 0, paymentAmount: 0, payments: [] }))).status).toBe(200)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ payments: [], paymentAmount: 0, change: 0 }))
  })

  it('refuses payments that do not add up to the total, and an order type it does not know', async () => {
    const short = await post(sale({ orderType: 'dine-in', payments: [{ method: 'cash', amount: 200 }] }))
    expect(short.status).toBe(400)
    expect((await short.json()).error).toMatch(/doesn’t add up/)
    expect((await post(sale({ orderType: 'delivery', payments: [{ method: 'card', amount: 259 }] }))).status).toBe(400)
    expect(create).not.toHaveBeenCalled()
  })

  it('saves an order from an older POS, with neither, as before', async () => {
    expect((await post(sale())).status).toBe(200)
    const stored = create.mock.calls[0][0]
    expect(stored).toMatchObject({ paymentAmount: 300, change: 41 })
    expect(stored).not.toHaveProperty('payments')
    expect(stored).not.toHaveProperty('orderType')
  })
})
