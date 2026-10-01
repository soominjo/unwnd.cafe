import { client } from '@/sanity/lib/client'
import { getResolvedCategories, type ResolvedCategory } from '@/lib/menuCategories'

/** A menu item stored in Sanity, as the POS reads it — its `price` arrives as `priceFixed`. */
export interface PosMenuItem {
  _id: string
  name: string
  subtitle: string | null
  category: string
  priceHot: number | null
  priceIce: number | null
  priceFixed: number | null
  addonType: 'drink' | 'food' | null
  hiddenFromPos: boolean | null
  applicableCategories: string[] | null
}

/** The menu-settings document: built-in items hidden from the POS, and the dragged tab order. */
export interface MenuSettings {
  hiddenItemIds: string[]
  categoryOrder: string[]
}

/** Everything the POS menu is built from, read live. */
export interface PosMenu extends MenuSettings {
  categories: ResolvedCategory[]
  items: PosMenuItem[]
}

export const MENU_SETTINGS_ID = 'menu-settings'

/**
 * How long the /pos page waits for Sanity before rendering the built-in menu
 * instead. The server reaches Sanity in well under a second when it is healthy.
 */
export const MENU_LOAD_TIMEOUT_MS = 3000

const fresh = client.withConfig({ useCdn: false })

export async function fetchPosMenuItems(): Promise<PosMenuItem[]> {
  return fresh.fetch<PosMenuItem[]>(
    `*[_type == "menuItem" && available != false] {
      _id,
      name,
      subtitle,
      category,
      priceHot,
      priceIce,
      "priceFixed": price,
      addonType,
      hiddenFromPos,
      applicableCategories
    }`,
    {},
    { cache: 'no-store' }
  )
}

export async function fetchMenuSettings(): Promise<MenuSettings> {
  const doc = await fresh.fetch<{ hiddenItemIds?: string[]; categoryOrder?: string[] } | null>(
    `*[_type == "menuSettings" && _id == $id][0]{ hiddenItemIds, categoryOrder }`,
    { id: MENU_SETTINGS_ID },
    { cache: 'no-store' }
  )
  return { hiddenItemIds: doc?.hiddenItemIds ?? [], categoryOrder: doc?.categoryOrder ?? [] }
}

function rejectAfter(ms: number): { promise: Promise<never>; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`POS menu took longer than ${ms}ms`)), ms)
  })
  return { promise, cancel: () => clearTimeout(timer) }
}

/**
 * The live menu for the /pos page to render with, so its first paint already
 * shows the real tabs and items. Never throws: null when Sanity cannot be read
 * in time, and the POS falls back to its built-in menu.
 */
export async function loadPosMenu(): Promise<PosMenu | null> {
  const timeout = rejectAfter(MENU_LOAD_TIMEOUT_MS)
  try {
    const [categories, items, settings] = await Promise.race([
      Promise.all([getResolvedCategories(), fetchPosMenuItems(), fetchMenuSettings()]),
      timeout.promise,
    ])
    return { categories, items, ...settings }
  } catch (error) {
    console.error('POS menu could not be loaded; showing the built-in menu', error)
    return null
  } finally {
    timeout.cancel()
  }
}
