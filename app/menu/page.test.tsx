import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { MenuData, MenuItemDoc } from '@/lib/posMenu'

// sanity/env.ts reads these when the image builder is imported.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'proj'
  process.env.NEXT_PUBLIC_SANITY_DATASET = 'prod'
})

const { readMenu, fetchPhotoPreviews } = vi.hoisted(() => ({ readMenu: vi.fn(), fetchPhotoPreviews: vi.fn() }))
vi.mock('@/lib/posMenu', () => ({ readMenu }))
vi.mock('./photoPreviews', () => ({ fetchPhotoPreviews }))

import MenuPage from './page'

const text = (html: string) => html.replace(/<[^>]+>/g, '')
const tab = (id: string, label: string) => ({ id, label, type: 'drink' as const, order: 1, _sanityId: `menu-category-${id}` })
const item = (over: Partial<MenuItemDoc>): MenuItemDoc => ({
  _id: 'x', name: 'X', subtitle: null, category: 'signature', priceHot: null, priceIce: null, priceFixed: null,
  addonType: null, hiddenFromPos: false, applicableCategories: null, description: null, image: null, ingredients: null, ...over,
})
const menu = (items: MenuItemDoc[]): MenuData => ({
  categories: [tab('signature', 'Signature'), tab('add-ons', 'Add ons')], categoryOrder: [], items,
})
const renderPage = async () => renderToStaticMarkup(await MenuPage())

beforeEach(() => {
  readMenu.mockReset()
  fetchPhotoPreviews.mockReset().mockResolvedValue({})
})

describe('the /menu page', () => {
  it('heads the page with the brand, the title and the count of items shown', async () => {
    readMenu.mockResolvedValue(menu([
      item({ _id: 'a', name: 'Americano', priceHot: 120, priceIce: 120 }),
      item({ _id: 'b', name: 'Cafe Latte', priceHot: 140, priceIce: 140 }),
      item({ _id: 's', name: 'Espresso Shot', category: 'add-ons', priceFixed: 50 }),
    ]))
    const html = await renderPage()
    expect(text(html)).toContain('unwnd. café')
    expect(html).toMatch(/<h1[^>]*>the menu\.<\/h1>/)
    expect(text(html)).toContain('2 items · prices in pesos')
    expect(text(html)).not.toContain('Espresso Shot')
    expect(readMenu).toHaveBeenCalledWith({ noStore: false })
  })

  it('says items are on their way when the menu is empty', async () => {
    readMenu.mockResolvedValue(menu([]))
    const html = await renderPage()
    expect(text(html)).toContain('Menu items are being added — check back soon.')
    expect(html).not.toContain('aria-label="Menu categories"')
  })

  // Lighthouse (mobile) measured it: the brand display font alone costs the menu 76 KB and
  // about 3 performance points, enough to make it slower than the menu it replaced.
  it('stays off the brand display font, which would slow the menu', async () => {
    readMenu.mockResolvedValue(menu([
      item({ _id: 'a', name: 'Americano', priceFixed: 120, image: { asset: { _ref: 'image-abc123-800x600-jpg' } } }),
      item({ _id: 'b', name: 'Cafe Latte', priceFixed: 140 }),
    ]))
    const html = await renderPage()
    expect(text(html)).toContain('unwnd. café')
    expect(html).toContain('aria-label="See Cafe Latte"')
    expect(html).not.toContain('font-logo')
  })

  it('passes the blurred previews through to the photos', async () => {
    readMenu.mockResolvedValue(menu([item({ _id: 'a', name: 'Americano', priceFixed: 120, image: { asset: { _ref: 'image-abc123-800x600-jpg' } } })]))
    fetchPhotoPreviews.mockResolvedValue({ a: 'data:image/jpeg;base64,AAA' })
    const html = await renderPage()
    expect(html).toContain('data:image/jpeg;base64,AAA')
  })
})
