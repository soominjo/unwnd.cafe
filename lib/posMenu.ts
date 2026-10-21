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

/** A menu item as the shared reader returns it: the POS fields, plus what /menu shows. */
export interface MenuItemDoc extends PosMenuItem {
  description: string | null
  image: { asset: { _ref: string } } | null
  ingredients: string[] | null
}

/** The menu-settings document: the tab order set by dragging tabs on the POS. */
export interface MenuSettings {
  categoryOrder: string[]
}

/** Everything the POS menu is built from, read live. */
export interface PosMenu extends MenuSettings {
  categories: ResolvedCategory[]
  items: PosMenuItem[]
}

/** The whole menu as the shared reader returns it, for /pos and /menu alike. */
export interface MenuData extends MenuSettings {
  categories: ResolvedCategory[]
  items: MenuItemDoc[]
}

export const MENU_SETTINGS_ID = 'menu-settings'

/**
 * How long the /pos page waits for Sanity before showing its fallback instead.
 * The server reaches Sanity in well under a second when it is healthy.
 */
export const MENU_LOAD_TIMEOUT_MS = 3000

const fresh = client.withConfig({ useCdn: false })
const fetchOptions = (noStore: boolean) => (noStore ? { cache: 'no-store' as const } : {})

/** Every available item, in the order it was added: the same order on /pos and /menu. */
export async function fetchPosMenuItems({ noStore = true }: { noStore?: boolean } = {}): Promise<MenuItemDoc[]> {
  return fresh.fetch<MenuItemDoc[]>(
    `*[_type == "menuItem" && available != false] | order(_createdAt asc, _id asc) {
      _id,
      name,
      subtitle,
      category,
      priceHot,
      priceIce,
      "priceFixed": price,
      addonType,
      hiddenFromPos,
      applicableCategories,
      description,
      image,
      ingredients
    }`,
    {},
    fetchOptions(noStore)
  )
}

export async function fetchMenuSettings({ noStore = true }: { noStore?: boolean } = {}): Promise<MenuSettings> {
  const doc = await fresh.fetch<{ categoryOrder?: string[] } | null>(
    `*[_type == "menuSettings" && _id == $id][0]{ categoryOrder }`,
    { id: MENU_SETTINGS_ID },
    fetchOptions(noStore)
  )
  return { categoryOrder: doc?.categoryOrder ?? [] }
}

/**
 * The menu, read from Sanity alone, for both the POS (`noStore: true`) and /menu (`noStore:
 * false`, so that page stays static until a POS save revalidates it). Throws when Sanity can't
 * be read.
 */
export async function readMenu({ noStore }: { noStore: boolean }): Promise<MenuData> {
  const [categories, items, settings] = await Promise.all([
    getResolvedCategories({ noStore }),
    fetchPosMenuItems({ noStore }),
    fetchMenuSettings({ noStore }),
  ])
  return { categories, items, ...settings }
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
 * in time, and the POS shows its fallback.
 */
export async function loadPosMenu(): Promise<PosMenu | null> {
  const timeout = rejectAfter(MENU_LOAD_TIMEOUT_MS)
  try {
    return await Promise.race([readMenu({ noStore: true }), timeout.promise])
  } catch (error) {
    console.error('POS menu could not be loaded', error)
    return null
  } finally {
    timeout.cancel()
  }
}
