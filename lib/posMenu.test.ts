import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { sanityFetch, getResolvedCategories } = vi.hoisted(() => ({
  sanityFetch: vi.fn(),
  getResolvedCategories: vi.fn(),
}))
vi.mock('@/sanity/lib/client', () => ({ client: { withConfig: () => ({ fetch: sanityFetch }) } }))
vi.mock('@/lib/menuCategories', () => ({ getResolvedCategories }))

import { loadPosMenu, MENU_LOAD_TIMEOUT_MS } from './posMenu'

const categories = [
  { id: 'espresso', label: 'Espresso', type: 'drink', order: 2, isBuiltIn: true },
  { id: 'signature', label: 'Signature', type: 'drink', order: 1, isBuiltIn: true },
]
const items = [
  {
    _id: 'sanity-ube', name: 'Ube Cream Latte', subtitle: null, category: 'signature', priceHot: null,
    priceIce: 170, priceFixed: null, addonType: null, hiddenFromPos: false, applicableCategories: null,
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
  it('reads the categories, items and settings the POS menu is built from', async () => {
    answer({ hiddenItemIds: ['cereal-cream-latte'], categoryOrder: ['espresso', 'signature'] })
    expect(await loadPosMenu()).toEqual({
      categories,
      items,
      hiddenItemIds: ['cereal-cream-latte'],
      categoryOrder: ['espresso', 'signature'],
    })
  })

  it('treats a missing settings document as nothing hidden and no saved order', async () => {
    answer(null)
    const menu = await loadPosMenu()
    expect(menu?.hiddenItemIds).toEqual([])
    expect(menu?.categoryOrder).toEqual([])
  })

  it('gives null when any part cannot be read, so the POS shows its built-in menu', async () => {
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
