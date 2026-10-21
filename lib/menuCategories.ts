import { client } from '@/sanity/lib/client'

export interface ResolvedCategory {
  id: string
  label: string
  type: 'drink' | 'food'
  order: number
  _sanityId: string
}

const fresh = client.withConfig({ useCdn: false })

// Single source of truth for the tab list: every tab is a menuCategory document, edited from
// the POS in manager mode, in the order set by dragging tabs there. Used by the POS, its
// category API, Sales and the customer-facing /menu page, so they never drift. Never read
// through the API CDN. `noStore: false` (used by /menu) leaves out the no-store override, so
// the page stays static and is re-rendered when a POS save revalidates it.
export async function getResolvedCategories({ noStore = true }: { noStore?: boolean } = {}): Promise<ResolvedCategory[]> {
  const fetchOptions = noStore ? { cache: 'no-store' as const } : {}

  const [docs, settings] = await Promise.all([
    fresh.fetch<{ _id: string; id: string; label: string; type: string; order: number }[]>(
      `*[_type == "menuCategory"] | order(order asc){ _id, id, label, type, order }`,
      {},
      fetchOptions
    ),
    fresh.fetch<{ categoryOrder?: string[] } | null>(
      `*[_type == "menuSettings" && _id == "menu-settings"][0]{ categoryOrder }`,
      {},
      fetchOptions
    ),
  ])

  const categories: ResolvedCategory[] = docs.map((c) => ({
    id: c.id,
    label: c.label,
    type: c.type as 'drink' | 'food',
    order: c.order,
    _sanityId: c._id,
  }))

  const categoryOrder = settings?.categoryOrder ?? []
  if (categoryOrder.length === 0) return categories

  const orderIndex = new Map(categoryOrder.map((id, i) => [id, i]))
  return [...categories].sort((a, b) => {
    const ai = orderIndex.has(a.id) ? orderIndex.get(a.id)! : Number.MAX_SAFE_INTEGER
    const bi = orderIndex.has(b.id) ? orderIndex.get(b.id)! : Number.MAX_SAFE_INTEGER
    return ai - bi
  })
}
