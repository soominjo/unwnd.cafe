import { client } from '@/sanity/lib/client'
import MenuClient from './MenuClient'
import type { SanityMenuItem } from '@/types/sanity'
import { MENU } from '@/app/pos/menuData'
import { getResolvedCategories } from '@/lib/menuCategories'
import { ADDON_CATEGORY_ID } from '@/app/pos/constants'

export const revalidate = 3600 // re-fetch menu from Sanity once per hour

async function getSanityItems(): Promise<SanityMenuItem[]> {
  return client.fetch(
    `*[_type == "menuItem" && available == true] | order(category asc, name asc) {
      _id, name, price, priceHot, priceIce, category, description, subtitle, image, drinkType, sizes, ingredients
    }`
  )
}

// The Sanity item schema has no explicit drinkType field — POS-created drink
// items only carry priceHot/priceIce, so derive the Hot/Iced toggle from those
// (mirrors the same derivation already done for the hardcoded fallback items).
function deriveDrinkType(item: SanityMenuItem): SanityMenuItem['drinkType'] {
  if (item.drinkType) return item.drinkType
  if (item.priceHot != null && item.priceIce != null) return 'both'
  if (item.priceHot != null) return 'hot'
  if (item.priceIce != null) return 'iced'
  return undefined
}

async function getHiddenItemIds(): Promise<string[]> {
  const doc = await client.fetch<{ hiddenItemIds?: string[] } | null>(
    `*[_type == "menuSettings" && _id == "menu-settings"][0]{ hiddenItemIds }`
  )
  return doc?.hiddenItemIds ?? []
}

function buildMergedItems(
  sanityItems: SanityMenuItem[],
  hiddenItemIds: string[],
  validCategoryIds: Set<string>
): SanityMenuItem[] {
  // Only mirror items whose category actually exists on the POS — an item
  // filed under a category the POS doesn't have is not "on /pos", so it
  // shouldn't surface here either (no silent remapping into a different tab).
  const normalizedSanity = sanityItems
    .filter((item) => validCategoryIds.has(item.category))
    .map((item) => ({
      ...item,
      description: item.description ?? item.subtitle ?? undefined,
      drinkType: deriveDrinkType(item),
    }))

  // Map each hardcoded item name to its canonical category.
  // A Sanity item only replaces its hardcoded counterpart when BOTH name AND
  // category match. If the name matches but the category differs, the Sanity
  // entry is a stale duplicate saved under the wrong tab — discard it so the
  // hardcoded item appears in the correct category without needing manual deletion.
  const hardcodedCategoryByName = new Map<string, string>()
  MENU.forEach((cat) => {
    cat.items.forEach((item) => {
      hardcodedCategoryByName.set(item.name.toLowerCase().trim(), cat.id)
    })
  })

  const validSanityItems = normalizedSanity.filter((item) => {
    const canonical = hardcodedCategoryByName.get(item.name.toLowerCase().trim())
    return canonical === undefined || item.category === canonical
  })

  const sanityNames = new Set(validSanityItems.map((i) => i.name.toLowerCase().trim()))

  const hardcodedItems: SanityMenuItem[] = MENU
    .filter((cat) => validCategoryIds.has(cat.id))
    .flatMap((cat) =>
      cat.items.map((item) => ({
        _id: item.id,
        name: item.name,
        price: item.priceFixed ?? item.priceHot ?? item.priceIce ?? 0,
        ...(item.priceHot != null && { priceHot: item.priceHot }),
        ...(item.priceIce != null && { priceIce: item.priceIce }),
        category: cat.id,
        description: item.subtitle || undefined,
        drinkType:
          item.priceHot != null && item.priceIce != null
            ? ('both' as const)
            : item.priceHot != null
            ? ('hot' as const)
            : item.priceIce != null
            ? ('iced' as const)
            : undefined,
      }))
    )

  const filteredHardcoded = hardcodedItems.filter(
    (i) =>
      !sanityNames.has(i.name.toLowerCase().trim()) &&
      !hiddenItemIds.includes(i._id)
  )

  return [...filteredHardcoded, ...validSanityItems]
}

export default async function MenuPage() {
  const [sanityItems, hiddenItemIds, resolvedCategories] = await Promise.all([
    getSanityItems(),
    getHiddenItemIds(),
    getResolvedCategories({ fresh: false }),
  ])

  const menuCategories = resolvedCategories.filter((c) => c.id !== ADDON_CATEGORY_ID)
  const validCategoryIds = new Set(menuCategories.map((c) => c.id))
  const items = buildMergedItems(sanityItems, hiddenItemIds, validCategoryIds)
  const categories = menuCategories.map((c) => ({ id: c.id, label: c.label }))

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Header ── */}
      <header className="bg-foreground text-cream px-8 md:px-16 pt-32 pb-10 shrink-0">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-cream/40 text-[9px] uppercase tracking-[0.45em] mb-4">
              unwnd. café
            </p>
            <h1
              className="font-serif lowercase tracking-tighter leading-none"
              style={{ fontSize: 'clamp(2.8rem, 7vw, 6rem)' }}
            >
              the menu.
            </h1>
          </div>
          <p className="text-cream/25 text-[10px] uppercase tracking-[0.3em] hidden md:block mb-1.5">
            {items.length} items
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="px-8 md:px-16 py-24">
          <p className="text-muted font-light">
            Menu items are being added — check back soon.
          </p>
        </div>
      ) : (
        <MenuClient items={items as SanityMenuItem[]} categories={categories} />
      )}

    </main>
  )
}
