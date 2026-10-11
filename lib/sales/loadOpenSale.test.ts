import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { fetch } = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/sanity/lib/client', () => ({ client: { withConfig: () => ({ fetch }) } }))

import { OPEN_SALE_TIMEOUT_MS, loadOpenSale } from './loadOpenSale'

const pending = {
  _id: 'sale-214', _rev: 'rev-9', _type: 'sale', _createdAt: '2026-10-03T06:14:00Z',
  total: 790, paymentAmount: 790, change: 0,
  items: [{ _key: 'tiramisu__ice', lineId: 'tiramisu__ice', name: 'Tiramisu', variant: 'ice', price: 160, qty: 2, categoryId: 'signature' }],
}

beforeEach(() => {
  fetch.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('loadOpenSale', () => {
  it('opens a pending order by its id, as it is now', async () => {
    fetch.mockResolvedValue(pending)
    expect(await loadOpenSale('sale-214')).toEqual({
      order: {
        id: 'sale-214', rev: 'rev-9', createdAt: '2026-10-03T06:14:00Z', name: '', items: pending.items,
        discounts: [], total: 790, loyaltyMemberId: null, loyaltyRewards: [],
        // Saved before Dine in / Take out and payments were recorded.
        orderType: null, payments: [],
      },
    })
    expect(fetch).toHaveBeenCalledWith('*[_type == "sale" && _id == $id][0]', { id: 'sale-214' }, { cache: 'no-store' })
  })

  it('says why an order can’t be added to: completed, or not there', async () => {
    fetch.mockResolvedValueOnce({ ...pending, isCompleted: true })
    expect(await loadOpenSale('sale-214')).toEqual({ problem: 'completed' })
    fetch.mockResolvedValueOnce(null)
    expect(await loadOpenSale('sale-214')).toEqual({ problem: 'gone' })
  })

  it('reads nothing for an id that is not one', async () => {
    expect(await loadOpenSale('drafts.sale-214')).toEqual({ problem: 'gone' })
    expect(await loadOpenSale('sale"] | *[0')).toEqual({ problem: 'gone' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('never throws: an order that can’t be read, or not in time, is unreadable', async () => {
    fetch.mockRejectedValueOnce(new Error('Sanity down'))
    expect(await loadOpenSale('sale-214')).toEqual({ problem: 'unreadable' })
    expect(console.error).toHaveBeenCalled()

    vi.useFakeTimers()
    fetch.mockReturnValueOnce(new Promise(() => {}))
    const slow = loadOpenSale('sale-214')
    await vi.advanceTimersByTimeAsync(OPEN_SALE_TIMEOUT_MS)
    expect(await slow).toEqual({ problem: 'unreadable' })
  })
})
