import type { MenuData, MenuItemDoc } from '@/lib/posMenu'
import type { SanityMenuItem } from '@/types/sanity'
import { ADDON_CATEGORY_ID } from '@/app/pos/constants'

export interface PublicMenu {
  categories: { id: string; label: string }[]
  items: SanityMenuItem[]
}

// The Hot/Iced toggle comes from which prices an item has: there is no drinkType field.
function drinkTypeOf(item: MenuItemDoc): SanityMenuItem['drinkType'] {
  if (item.priceHot != null && item.priceIce != null) return 'both'
  if (item.priceHot != null) return 'hot'
  if (item.priceIce != null) return 'iced'
  return undefined
}

function toPublicItem(item: MenuItemDoc): SanityMenuItem {
  return {
    _id: item._id,
    name: item.name,
    price: item.priceFixed ?? item.priceHot ?? item.priceIce ?? 0,
    ...(item.priceHot != null && { priceHot: item.priceHot }),
    ...(item.priceIce != null && { priceIce: item.priceIce }),
    category: item.category,
    description: item.description ?? item.subtitle ?? undefined,
    subtitle: item.subtitle ?? undefined,
    image: item.image ?? undefined,
    ...(item.ingredients && item.ingredients.length > 0 && { ingredients: item.ingredients }),
    drinkType: drinkTypeOf(item),
  }
}

/**
 * What /menu shows, following the POS: its tabs in its order under its names, without Add ons,
 * and every available item in those tabs in the order it was added, "Hide from POS" ones
 * included. A tab with no items is left out by the page itself.
 */
export function toPublicMenu(menu: Pick<MenuData, 'categories' | 'items'>): PublicMenu {
  const categories = menu.categories
    .filter((c) => c.id !== ADDON_CATEGORY_ID)
    .map((c) => ({ id: c.id, label: c.label }))
  const shown = new Set(categories.map((c) => c.id))
  return { categories, items: menu.items.filter((i) => shown.has(i.category)).map(toPublicItem) }
}
