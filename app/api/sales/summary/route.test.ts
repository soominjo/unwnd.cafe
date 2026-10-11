import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requirePosAuth, fetch, getResolvedCategories } = vi.hoisted(() => ({
  requirePosAuth: vi.fn(),
  fetch: vi.fn(),
  getResolvedCategories: vi.fn(),
}))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/sanity/lib/client', () => ({ client: { withConfig: () => ({ fetch }) } }))
vi.mock('@/lib/menuCategories', () => ({ getResolvedCategories }))

import { GET } from './route'

const get = (query: string) => GET(new NextRequest(`http://pos.test/api/sales/summary?${query}`))
const range = 'from=2026-10-11T00:00:00.000Z&to=2026-10-11T15:59:59.999Z'

const latte = { name: 'Spanish Latte', variant: 'ice', price: 130, qty: 1, categoryId: 'espresso' }
// A take-out paid by e-wallet, a dine-in split, and an order from before payments were recorded.
const sales = [
  { _id: 'a', _createdAt: '2026-10-11T10:00:00.000Z', total: 130, isCompleted: true, orderType: 'take-out', items: [latte],
    payments: [{ _key: 'pay-0', method: 'ewallet', amount: 130 }] },
  { _id: 'b', _createdAt: '2026-10-11T11:00:00.000Z', total: 260, notes: 'Bea', orderType: 'dine-in', items: [{ ...latte, qty: 2 }],
    payments: [{ _key: 'pay-0', method: 'card', amount: 160 }, { _key: 'pay-1', method: 'cash', amount: 100, received: 100 }] },
  { _id: 'c', _createdAt: '2026-10-11T09:00:00.000Z', total: 130, items: [latte] },
]

beforeEach(() => {
  requirePosAuth.mockReset().mockResolvedValue(null)
  fetch.mockReset().mockResolvedValue(sales)
  getResolvedCategories.mockReset().mockResolvedValue([{ id: 'espresso', label: 'Espresso' }])
})

describe('GET /api/sales/summary', () => {
  it('says how the period was paid and where it was eaten, adding up to the revenue', async () => {
    const { data } = await (await get(range)).json()
    expect(data.totalRevenue).toBe(520)
    expect(data.paymentTally).toEqual({
      cash: { amount: 100, orders: 1 },
      ewallet: { amount: 130, orders: 1 },
      card: { amount: 160, orders: 1 },
      notRecorded: { amount: 130, orders: 1 },
    })
    expect(data.orderTypes).toEqual({ dineIn: 1, takeOut: 1, notRecorded: 1 })
    expect(data).not.toHaveProperty('paymentLines')
  })

  it('lists each payment, newest first, when asked for the lines', async () => {
    const { data } = await (await get(`${range}&lines=1`)).json()
    expect(data.paymentLines.map((l: { saleId: string; paymentKey: string }) => `${l.saleId}:${l.paymentKey}`)).toEqual(['b:pay-0', 'b:pay-1', 'a:pay-0'])
  })

  it('reads the payments and the order type from Sanity', async () => {
    await get(range)
    expect(fetch.mock.calls[0][0]).toMatch(/orderType/)
    expect(fetch.mock.calls[0][0]).toMatch(/payments\[\]\{[^}]*method[^}]*amount/)
  })

  it('reads what a moved payment was taken as, and when it moved, for the Tally list', async () => {
    await get(`${range}&lines=1`)
    expect(fetch.mock.calls[0][0]).toMatch(/payments\[\]\{[^}]*movedFrom[^}]*movedAt/)
  })
})
