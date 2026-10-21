import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SanityMenuItem } from '@/types/sanity'

// sanity/env.ts reads these when the image builder is imported.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'proj'
  process.env.NEXT_PUBLIC_SANITY_DATASET = 'prod'
})

import MenuClient from './MenuClient'

const text = (html: string) => html.replace(/<[^>]+>/g, '')
const PHOTO = { asset: { _ref: 'image-abc123-800x600-jpg' } }
const categories = [{ id: 'signature', label: 'Signature' }, { id: 'espresso', label: 'Classic' }, { id: 'waffle', label: 'Waffle' }]
const items: SanityMenuItem[] = [
  { _id: 's1', name: 'Seasalt Spanish Latte⭐', price: 170, priceHot: 170, priceIce: 170, drinkType: 'both', category: 'signature' },
  { _id: 'w1', name: 'Nutella Waffle', price: 130, category: 'waffle', image: PHOTO },
  { _id: 's2', name: 'Tiramisu Latte⭐', price: 190, priceHot: 190, priceIce: 190, drinkType: 'both', category: 'signature' },
  { _id: 'w2', name: 'Cream Cheese Waffle', price: 130, category: 'waffle' },
]
const render = () => renderToStaticMarkup(<MenuClient items={items} categories={categories} />)

describe('MenuClient', () => {
  it('puts every tab on one page in the POS order, as h2 sections with h3 items', () => {
    const html = render()
    const signature = html.indexOf('id="cat-signature"')
    const waffle = html.indexOf('id="cat-waffle"')
    expect(signature).toBeGreaterThan(-1)
    expect(waffle).toBeGreaterThan(signature)
    expect(html).not.toContain('id="cat-espresso"')
    expect(html).toMatch(/<h2[^>]*>signature\.<\/h2>/)
    expect(html).toMatch(/<h2[^>]*>waffle\.<\/h2>/)
    expect(text(html)).toContain('2 items')
    expect(html.match(/<h3/g)).toHaveLength(4)
    expect(html.indexOf('Seasalt Spanish Latte⭐')).toBeLessThan(html.indexOf('Tiramisu Latte⭐'))
  })

  it('marks the first chip current', () => {
    const html = render()
    expect(html.match(/aria-current="true"/g)).toHaveLength(1)
    expect(html).toMatch(/aria-current="true"[^>]*>Signature</)
    expect(html).not.toMatch(/data-chip="espresso"/)
  })

  it('shows plain cards for a tab without photos and photo cards for a tab with one', () => {
    const html = render()
    const signature = html.slice(html.indexOf('id="cat-signature"'), html.indexOf('id="cat-waffle"'))
    const waffle = html.slice(html.indexOf('id="cat-waffle"'))
    expect(signature).not.toContain('aria-label="See ')
    expect(signature).toContain('bg-paper')
    expect(waffle).toContain('aria-label="See Nutella Waffle"')
    expect(waffle).toContain('aria-label="See Cream Cheese Waffle"')
    expect(waffle.match(/<img/g)).toHaveLength(1)
  })

  it("loads the first row's photos up front when the first category has photos", () => {
    // A photo of its own per item: React merges preloads of the same address into one.
    const photoOf = (id: string) => ({ asset: { _ref: `image-${id}abc-800x600-jpg` } })
    const withPhotos = items.map((i) => (i.category === 'signature' ? { ...i, image: photoOf(i._id) } : i))
    const third = { _id: 's3', name: 'Oat Spanish Latte⭐', price: 180, priceHot: 180, priceIce: 180, drinkType: 'both' as const, category: 'signature', image: photoOf('s3') }
    const html = renderToStaticMarkup(<MenuClient items={[...withPhotos, third]} categories={categories} />)
    expect(html.match(/<link rel="preload" as="image"/g)).toHaveLength(2)
    expect(render().match(/<link rel="preload" as="image"/g)).toBeNull()
  })

  it('starts drinks on Iced and prices them that way', () => {
    const html = render()
    expect(html).toMatch(/aria-pressed="true"[^>]*>Iced</)
    expect(text(html)).toContain('₱170')
  })

  it('shows no tray bar while the tray is empty, and ends with the counter note', () => {
    const html = render()
    expect(text(html)).not.toContain('Your tray')
    expect(text(html)).toContain('Prices are a guide. Please order and pay at the counter.')
  })
})
