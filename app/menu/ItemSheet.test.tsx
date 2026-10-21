import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SanityMenuItem } from '@/types/sanity'

// sanity/env.ts reads these when the image builder is imported.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'proj'
  process.env.NEXT_PUBLIC_SANITY_DATASET = 'prod'
})

import ItemSheet from './ItemSheet'

const text = (html: string) => html.replace(/<[^>]+>/g, '')
const noop = () => {}
const latte: SanityMenuItem = {
  _id: 'l', name: 'Seasalt Spanish Latte⭐', price: 170, priceHot: 170, priceIce: 170, drinkType: 'both',
  category: 'signature', description: 'Espresso · Milk · Sea Salt Cream', ingredients: ['Espresso', 'Milk'],
}
const food: SanityMenuItem = { _id: 'f', name: 'Bacon and Egg Rice Meal', price: 150, category: 'meal' }
const sheet = (item: SanityMenuItem | null, temp: 'Hot' | 'Iced' | null, categoryLabel = 'Signature') =>
  renderToStaticMarkup(<ItemSheet item={item} categoryLabel={categoryLabel} temp={temp} onTemp={noop} onAdd={noop} onClose={noop} />)

describe('ItemSheet', () => {
  it('renders an empty dialog when no item is open', () => {
    const html = sheet(null, null)
    expect(html).toContain('<dialog')
    expect(text(html)).not.toContain('Add to tray')
  })

  it('shows the item with its temperature in the add button', () => {
    const html = sheet(latte, 'Iced')
    expect(html).toContain('aria-labelledby="item-sheet-title"')
    expect(html).toMatch(/id="item-sheet-title"[^>]*>Seasalt Spanish Latte⭐</)
    expect(text(html)).toContain('Signature')
    expect(text(html)).toContain('Espresso · Milk · Sea Salt Cream')
    expect(text(html)).toContain('What’s in it')
    expect(text(html)).toContain('Add to tray · ₱170 · Iced')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Iced</)
  })

  it('adds food without a temperature', () => {
    const html = sheet(food, null, 'Meal')
    expect(text(html)).toContain('Add to tray · ₱150')
    expect(text(html)).not.toContain('· Iced')
    expect(text(html)).not.toContain('What’s in it')
    expect(html).not.toContain('aria-pressed')
  })

  // The menu's photos are tall cup shots cropped square; a wider box would cut off the lid and base.
  it('shows the whole square photo on phones too', () => {
    const html = sheet({ ...latte, image: { asset: { _ref: 'image-abc123-800x600-jpg' } } }, 'Iced')
    const photoBox = html.match(/<div class="([^"]*bg-photo[^"]*)"/)?.[1] ?? ''
    expect(photoBox.split(' ')).toContain('aspect-square')
    expect(photoBox).not.toMatch(/aspect-\[/)
  })

  it('shows no photo area for an item without a photo, and the photo for one with', () => {
    expect(sheet(latte, 'Iced')).not.toContain('<img')
    const withPhoto = sheet({ ...latte, image: { asset: { _ref: 'image-abc123-800x600-jpg' } } }, 'Iced')
    expect(withPhoto).toContain('<img')
    expect(withPhoto).toContain('cdn.sanity.io/images/proj/prod/abc123-800x600.jpg')
  })
})
