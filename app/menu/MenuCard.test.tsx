import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SanityMenuItem } from '@/types/sanity'

// sanity/env.ts reads these when the image builder is imported.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = 'proj'
  process.env.NEXT_PUBLIC_SANITY_DATASET = 'prod'
})

import MenuCard from './MenuCard'

const text = (html: string) => html.replace(/<[^>]+>/g, '')
const noop = () => {}
const PHOTO = { asset: { _ref: 'image-abc123-800x600-jpg' } }
const latte: SanityMenuItem = {
  _id: 'l', name: 'Seasalt Spanish Latte⭐', price: 170, priceHot: 170, priceIce: 170, drinkType: 'both',
  category: 'signature', description: 'Espresso · Milk',
}
const card = (over: Partial<Parameters<typeof MenuCard>[0]> = {}) =>
  renderToStaticMarkup(
    <MenuCard item={latte} withPhoto={false} temp="Iced" justAdded={false} onTemp={noop} onAdd={noop} onOpen={noop} {...over} />
  )

describe('MenuCard', () => {
  it('a plain card: no photo, the name, the words, Hot/Iced with Iced on, the price and +', () => {
    const html = card()
    expect(html).not.toContain('<img')
    expect(html).toContain('bg-paper')
    expect(text(html)).toContain('Seasalt Spanish Latte⭐')
    expect(text(html)).toContain('Espresso · Milk')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Iced</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Hot</)
    expect(text(html)).toContain('₱170')
    expect(html).toContain('aria-label="Add Seasalt Spanish Latte⭐ to the tray"')
  })

  it('prices the temperature chosen', () => {
    const html = card({ item: { ...latte, priceHot: 160 }, temp: 'Hot' })
    expect(text(html)).toContain('₱160')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Hot</)
  })

  it('a photo card shows the Sanity photo and opens the item from it', () => {
    const html = card({ item: { ...latte, image: PHOTO, lqip: 'data:image/jpeg;base64,AAA' }, withPhoto: true })
    expect(html).toContain('<img')
    expect(html).toContain('cdn.sanity.io/images/proj/prod/abc123-800x600.jpg')
    expect(html).toContain('aria-label="See Seasalt Spanish Latte⭐"')
    expect(html).toContain('data:image/jpeg;base64,AAA')
    expect(html).not.toContain('bg-paper')
  })

  it('keeps the photo spot with a quiet unwnd. tile while the photo is missing', () => {
    const html = card({ withPhoto: true })
    expect(html).not.toContain('<img')
    expect(html).toContain('aria-label="See Seasalt Spanish Latte⭐"')
    expect(text(html)).toContain('unwnd.')
  })

  it('notes one-way drinks and shows nothing for food', () => {
    const iced = card({ item: { ...latte, priceHot: undefined, drinkType: 'iced' } })
    expect(text(iced)).toContain('Iced only')
    expect(iced).not.toContain('aria-pressed')

    const food = card({ item: { _id: 'f', name: 'Classic Fries', price: 120, category: 'snack' }, temp: null })
    expect(text(food)).not.toContain('only')
    expect(food).not.toContain('aria-pressed')
    expect(text(food)).toContain('₱120')
  })

  it('turns + into a tick just after adding', () => {
    const html = card({ justAdded: true })
    expect(html).toContain('bg-added')
    expect(html).toContain('aria-label="Add Seasalt Spanish Latte⭐ to the tray"')
    expect(card()).not.toContain('bg-added')
  })
})
