import type { SanityMenuItem } from '@/types/sanity'

export type Temp = 'Hot' | 'Iced'

/** One category as /menu lays it out: a heading, its items, and whether its cards show photos. */
export interface MenuSection {
  id: string
  label: string
  items: SanityMenuItem[]
  /** True once any item in the category has a photo; the rest then get a placeholder tile. */
  withPhotos: boolean
}

/** The categories in the POS order, each with its items in their order. Empty categories are left out. */
export function menuSections(
  items: readonly SanityMenuItem[],
  categories: readonly { id: string; label: string }[]
): MenuSection[] {
  return categories
    .map(({ id, label }) => {
      const inCategory = items.filter((item) => item.category === id)
      return { id, label, items: inCategory, withPhotos: inCategory.some((item) => item.image != null) }
    })
    .filter((section) => section.items.length > 0)
}

/**
 * The category whose chip is marked, from those in the reading band right now: the lowest of
 * them on the page, since that is the one just scrolled into. With none in the band the mark
 * stays where it is.
 */
export function pickActive(visible: ReadonlySet<string>, order: readonly string[], current: string): string {
  return order.findLast((id) => visible.has(id)) ?? current
}

/** Where the Hot/Iced choice starts: Iced for a drink that comes both ways, none for food. */
export function defaultTemp(item: SanityMenuItem): Temp | null {
  if (item.drinkType === 'hot') return 'Hot'
  if (item.drinkType === 'iced' || item.drinkType === 'both') return 'Iced'
  return null
}

export function priceFor(item: SanityMenuItem, temp: Temp | null): number {
  if (temp === 'Hot') return item.priceHot ?? item.price
  if (temp === 'Iced') return item.priceIce ?? item.price
  return item.price
}

/** "Iced only" or "Hot only" for a drink that comes one way; nothing otherwise. */
export function tempNote(item: SanityMenuItem): string | null {
  if (item.drinkType === 'iced') return 'Iced only'
  if (item.drinkType === 'hot') return 'Hot only'
  return null
}

export function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString('en-PH')}`
}

export function countLabel(n: number, word: string): string {
  return `${n} ${n === 1 ? word : `${word}s`}`
}
