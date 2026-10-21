import { describe, it, expect } from 'vitest'
import type { SanityMenuItem } from '@/types/sanity'
import { countLabel, defaultTemp, formatPeso, menuSections, pickActive, priceFor, tempNote } from './menuView'

const item = (over: Partial<SanityMenuItem>): SanityMenuItem => ({ _id: 'x', name: 'X', price: 0, category: 'signature', ...over })
const PHOTO = { asset: { _ref: 'image-abc123-800x600-jpg' } }
const latte = item({ _id: 'l', price: 170, priceHot: 170, priceIce: 180, drinkType: 'both' })
const hotOnly = item({ _id: 'h', price: 120, priceHot: 120, drinkType: 'hot' })
const icedOnly = item({ _id: 'i', price: 130, priceIce: 130, drinkType: 'iced' })
const food = item({ _id: 'f', price: 150, category: 'meal' })

describe('menuSections', () => {
  const categories = [{ id: 'signature', label: 'Signature' }, { id: 'espresso', label: 'Classic' }, { id: 'waffle', label: 'Waffle' }]

  it('lays the tabs out in the POS order, keeps item order, and leaves empty tabs out', () => {
    const s1 = item({ _id: 's1' }), w1 = item({ _id: 'w1', category: 'waffle' }), s2 = item({ _id: 's2' })
    const sections = menuSections([s1, w1, s2], categories)
    expect(sections.map((s) => [s.id, s.label, s.items.map((i) => i._id)])).toEqual([
      ['signature', 'Signature', ['s1', 's2']],
      ['waffle', 'Waffle', ['w1']],
    ])
  })

  it('shows photos in a tab as soon as one of its items has one', () => {
    const sections = menuSections([item({ _id: 's1' }), item({ _id: 's2', image: PHOTO }), item({ _id: 'w1', category: 'waffle' })], categories)
    expect(sections.map((s) => [s.id, s.withPhotos])).toEqual([['signature', true], ['waffle', false]])
  })
})

describe('pickActive', () => {
  const order = ['signature', 'espresso', 'waffle']

  it('marks the lower of two categories in the reading band, the one just scrolled into', () => {
    expect(pickActive(new Set(['espresso', 'signature']), order, 'signature')).toBe('espresso')
  })

  it('goes back to the category above once the lower one leaves the band on the way up', () => {
    expect(pickActive(new Set(['signature']), order, 'espresso')).toBe('signature')
  })

  it('keeps the current mark while no category is in the band', () => {
    expect(pickActive(new Set(), order, 'waffle')).toBe('waffle')
  })
})

describe('temperatures and prices', () => {
  it('starts a drink on Iced when it comes both ways, otherwise its only way; food has none', () => {
    expect(defaultTemp(latte)).toBe('Iced')
    expect(defaultTemp(hotOnly)).toBe('Hot')
    expect(defaultTemp(icedOnly)).toBe('Iced')
    expect(defaultTemp(food)).toBeNull()
  })

  it('prices by temperature, and food by its fixed price', () => {
    expect(priceFor(latte, 'Hot')).toBe(170)
    expect(priceFor(latte, 'Iced')).toBe(180)
    expect(priceFor(food, null)).toBe(150)
    expect(priceFor(icedOnly, 'Iced')).toBe(130)
  })

  it('labels drinks that come one way only', () => {
    expect(tempNote(icedOnly)).toBe('Iced only')
    expect(tempNote(hotOnly)).toBe('Hot only')
    expect(tempNote(latte)).toBeNull()
    expect(tempNote(food)).toBeNull()
  })
})

describe('words', () => {
  it('writes pesos with thousands separators', () => {
    expect(formatPeso(170)).toBe('₱170')
    expect(formatPeso(1200)).toBe('₱1,200')
  })

  it('counts in words', () => {
    expect(countLabel(1, 'item')).toBe('1 item')
    expect(countLabel(40, 'item')).toBe('40 items')
    expect(countLabel(0, 'item')).toBe('0 items')
  })
})
