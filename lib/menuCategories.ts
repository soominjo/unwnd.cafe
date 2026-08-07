import { client } from '@/sanity/lib/client'

export interface ResolvedCategory {
  id: string
  label: string
  type: 'drink' | 'food'
  order: number
  isBuiltIn: boolean
  _sanityId?: string
}

export const BUILT_IN_CATEGORIES: ResolvedCategory[] = [
  { id: 'signature',  label: 'Signature',  type: 'drink', order: 1, isBuiltIn: true },
  { id: 'espresso',   label: 'Espresso',   type: 'drink', order: 2, isBuiltIn: true },
  { id: 'non-coffee', label: 'Non-Coffee', type: 'drink', order: 3, isBuiltIn: true },
  { id: 'meal',       label: 'Meal',       type: 'food',  order: 4, isBuiltIn: true },
  { id: 'waffle',     label: 'Waffle',     type: 'food',  order: 5, isBuiltIn: true },
  { id: 'snack',      label: 'Snack',      type: 'food',  order: 6, isBuiltIn: true },
]

const fresh = client.withConfig({ useCdn: false })

// Single source of truth for the resolved category list (built-ins + custom
// Sanity docs, in the order set by dragging tabs on the POS) — used by both
// the POS category API and the customer-facing /menu page so the two never drift.
// `fresh: false` (used by /menu) skips the no-store override so the page's own
// ISR `revalidate` setting still applies instead of forcing full dynamic rendering.
export async function getResolvedCategories({ fresh: wantFresh = true }: { fresh?: boolean } = {}): Promise<ResolvedCategory[]> {
  const sanityClient = wantFresh ? fresh : client
  const fetchOptions = wantFresh ? { cache: 'no-store' as const } : {}

  const [userCategories, settings] = await Promise.all([
    sanityClient.fetch<{ _id: string; id: string; label: string; type: string; order: number }[]>(
      `*[_type == "menuCategory"] | order(order asc)`,
      {},
      fetchOptions
    ),
    sanityClient.fetch<{ categoryOrder?: string[] } | null>(
      `*[_type == "menuSettings" && _id == "menu-settings"][0]{ categoryOrder }`,
      {},
      fetchOptions
    ),
  ])

  const builtInIds = new Set(BUILT_IN_CATEGORIES.map((c) => c.id))
  const extra = userCategories
    .filter((c) => !builtInIds.has(c.id))
    .map((c) => ({ ...c, _sanityId: c._id, type: c.type as 'drink' | 'food', isBuiltIn: false as const }))

  const categories = [...BUILT_IN_CATEGORIES, ...extra].sort((a, b) => a.order - b.order)

  const categoryOrder = settings?.categoryOrder ?? []
  if (categoryOrder.length === 0) return categories

  const orderIndex = new Map(categoryOrder.map((id, i) => [id, i]))
  return [...categories].sort((a, b) => {
    const ai = orderIndex.has(a.id) ? orderIndex.get(a.id)! : Number.MAX_SAFE_INTEGER
    const bi = orderIndex.has(b.id) ? orderIndex.get(b.id)! : Number.MAX_SAFE_INTEGER
    return ai - bi
  })
}
