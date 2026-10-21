import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fetch, cdnFetch, withConfig } = vi.hoisted(() => {
  const fetch = vi.fn()
  return { fetch, cdnFetch: vi.fn(), withConfig: vi.fn(() => ({ fetch })) }
})
vi.mock('@/sanity/lib/client', () => ({ client: { fetch: cdnFetch, withConfig } }))

import { getResolvedCategories } from './menuCategories'

const tab = (id: string, label: string, order: number, _id = `menu-category-${id}`) => ({ _id, id, label, type: 'drink', order })

beforeEach(() => fetch.mockReset())

describe('the tabs', () => {
  it('come from Sanity only, in the saved tab order, with any tab missing from it last by its order', async () => {
    fetch
      .mockResolvedValueOnce([tab('signature', 'Signature', 1), tab('espresso', 'Classic', 2), tab('add-ons', 'Add ons', 7, 'RacZ'), tab('add-ons-food', 'ADD ONS FOOD', 9, 'fz5v')])
      .mockResolvedValueOnce({ categoryOrder: ['espresso', 'signature', 'add-ons'] })
    const tabs = await getResolvedCategories()
    expect(tabs.map((t) => t.id)).toEqual(['espresso', 'signature', 'add-ons', 'add-ons-food'])
    expect(tabs[0]).toEqual({ id: 'espresso', label: 'Classic', type: 'drink', order: 2, _sanityId: 'menu-category-espresso' })
  })

  it('has none of its own: with nothing in Sanity there are no tabs', async () => {
    fetch.mockResolvedValueOnce([]).mockResolvedValueOnce(null)
    expect(await getResolvedCategories()).toEqual([])
  })

  it('never reads through the API CDN; past the cache for the POS, page-cached for /menu', async () => {
    fetch.mockResolvedValue([])
    await getResolvedCategories()
    expect(fetch.mock.calls[0][2]).toEqual({ cache: 'no-store' })
    fetch.mockClear()
    await getResolvedCategories({ noStore: false })
    expect(fetch.mock.calls[0][2]).toEqual({})
    expect(withConfig).toHaveBeenCalledWith({ useCdn: false })
    expect(cdnFetch).not.toHaveBeenCalled()
  })
})
