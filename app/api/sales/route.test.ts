import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requirePosAuth, create, fetchCardTotals } = vi.hoisted(() => ({
  requirePosAuth: vi.fn(), create: vi.fn(), fetchCardTotals: vi.fn(),
}))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/sanity/lib/writeClient', () => ({ getWriteClient: () => ({ create }) }))
vi.mock('@/sanity/lib/client', () => ({ client: { withConfig: () => ({ fetch: vi.fn() }) } }))
vi.mock('@/lib/loyaltyStore', () => ({ fetchCardTotals }))

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

  it('refuses rewards that have no classic drink of their own to go on', async () => {
    fetchCardTotals.mockResolvedValue({ earned: 11, usedTen: 0, usedFree: 0 })
    // A Signature drink only: the 10% has no Espresso or Non-Coffee drink to go on.
    const none = await post(sale({ items: [signature], loyaltyMemberId: 'kylene', loyaltyRewards: ['ten'] }))
    expect(none.status).toBe(400)
    expect((await none.json()).error).toBe('Each loyalty reward needs its own Espresso or Non-Coffee drink in the order.')
    // One Cafe Latte cannot be both the free drink and the 10% one.
    expect((await post(sale({ items: [latte], loyaltyMemberId: 'kylene', loyaltyRewards: ['ten', 'free'] }))).status).toBe(400)
    expect((await post(sale({ items: [{ ...latte, qty: 2 }], loyaltyMemberId: 'kylene', loyaltyRewards: ['ten', 'free'] }))).status).toBe(200)
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

  it('logs a sale that could not be saved', async () => {
    create.mockRejectedValueOnce(new Error('Sanity down'))
    expect((await post(sale({ total: 160 }))).status).toBe(500)
    expect(console.error).toHaveBeenCalled()
  })
})
