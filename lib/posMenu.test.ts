import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { sanityFetch, getResolvedCategories } = vi.hoisted(() => ({
  sanityFetch: vi.fn(),
  getResolvedCategories: vi.fn(),
}))
vi.mock('@/sanity/lib/client', () => ({ client: { withConfig: () => ({ fetch: sanityFetch }) } }))
vi.mock('@/lib/menuCategories', () => ({ getResolvedCategories }))

import { loadPosMenu, readMenu, MENU_LOAD_TIMEOUT_MS } from './posMenu'

const categories = [
  { id: 'espresso', label: 'Classic', type: 'drink', order: 2, _sanityId: 'menu-category-espresso' },
  { id: 'signature', label: 'Signature', type: 'drink', order: 1, _sanityId: 'menu-category-signature' },
]
const items = [
  {
    _id: 'sanity-ube', name: 'Ube Cream Latte', subtitle: null, category: 'signature', priceHot: null,
    priceIce: 170, priceFixed: null, addonType: null, hiddenFromPos: false, applicableCategories: null,
    description: null, image: null, ingredients: null,
  },
]

// The two queries posMenu sends itself: menu items, and the settings document.
function answer(settings: unknown) {
  sanityFetch.mockImplementation(async (query: string) => (query.includes('"menuItem"') ? items : settings))
}

beforeEach(() => {
  sanityFetch.mockReset()
  getResolvedCategories.mockReset()
  getResolvedCategories.mockResolvedValue(categories)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('loadPosMenu', () => {
  it('reads the tabs, items and saved tab order the menu is built from', async () => {
    answer({ categoryOrder: ['espresso', 'signature'] })
    expect(await loadPosMenu()).toEqual({ categories, items, categoryOrder: ['espresso', 'signature'] })
  })

  it('treats a missing settings document as no saved order', async () => {
    answer(null)
    const menu = await loadPosMenu()
    expect(menu?.categoryOrder).toEqual([])
  })

  it('gives null when any part cannot be read, so the POS shows its fallback', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    answer(null)
    getResolvedCategories.mockRejectedValue(new Error('Sanity is down'))
    expect(await loadPosMenu()).toBeNull()
    expect(console.error).toHaveBeenCalled()
  })

  it('stops waiting after the timeout instead of holding the page', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    sanityFetch.mockReturnValue(new Promise(() => {}))
    const menu = loadPosMenu()
    await vi.advanceTimersByTimeAsync(MENU_LOAD_TIMEOUT_MS)
    expect(await menu).toBeNull()
  })
})

describe('the menu reader', () => {
  it('asks Sanity for items in the order they were added, past the cache, for the POS', async () => {
    answer(null)
    await loadPosMenu()
    const [query, , options] = sanityFetch.mock.calls.find(([q]) => String(q).includes('"menuItem"'))!
    expect(query).toContain('order(_createdAt asc, _id asc)')
    expect(query).toContain('description')
    expect(query).toContain('image')
    expect(query).toContain('ingredients')
    expect(options).toEqual({ cache: 'no-store' })
    expect(getResolvedCategories).toHaveBeenCalledWith({ noStore: true })
  })

  it('reads the same menu for /menu without opting the page out of its cache', async () => {
    answer(null)
    await readMenu({ noStore: false })
    const [, , options] = sanityFetch.mock.calls.find(([q]) => String(q).includes('"menuItem"'))!
    expect(options).toEqual({})
    expect(getResolvedCategories).toHaveBeenCalledWith({ noStore: false })
  })
})
