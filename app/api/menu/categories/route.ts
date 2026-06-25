import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { requirePosAuth } from '@/lib/requirePosAuth'

export const dynamic = 'force-dynamic'

interface BuiltInCategory {
  id: string
  label: string
  type: 'drink' | 'food'
  order: number
  isBuiltIn: true
}

const BUILT_IN_CATEGORIES: BuiltInCategory[] = [
  { id: 'signature',  label: 'Signature',  type: 'drink', order: 1, isBuiltIn: true },
  { id: 'espresso',   label: 'Espresso',   type: 'drink', order: 2, isBuiltIn: true },
  { id: 'non-coffee', label: 'Non-Coffee', type: 'drink', order: 3, isBuiltIn: true },
  { id: 'meal',       label: 'Meal',       type: 'food',  order: 4, isBuiltIn: true },
  { id: 'waffle',     label: 'Waffle',     type: 'food',  order: 5, isBuiltIn: true },
  { id: 'snack',      label: 'Snack',      type: 'food',  order: 6, isBuiltIn: true },
]

const fresh = client.withConfig({ useCdn: false })

export async function GET() {
  try {
    const userCategories = await fresh.fetch<{ _id: string; id: string; label: string; type: string; order: number }[]>(
      `*[_type == "menuCategory"] | order(order asc)`,
      {},
      { cache: 'no-store' }
    )

    const builtInIds = new Set(BUILT_IN_CATEGORIES.map((c) => c.id))
    const extra = userCategories
      .filter((c) => !builtInIds.has(c.id))
      .map((c) => ({ ...c, _sanityId: c._id, type: c.type as 'drink' | 'food', isBuiltIn: false as const }))

    const categories = [...BUILT_IN_CATEGORIES, ...extra].sort((a, b) => a.order - b.order)
    return NextResponse.json({ success: true, categories })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch categories.' }, { status: 500 })
  }
}

interface CategoryInput {
  label: string
  type: 'drink' | 'food'
}

function isValidCategoryInput(body: unknown): body is CategoryInput {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  if (typeof b.label !== 'string' || b.label.trim().length === 0 || b.label.length > 40) return false
  return b.type === 'drink' || b.type === 'food'
}

export async function POST(request: NextRequest) {
  const authError = await requirePosAuth()
  if (authError) return authError

  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!isValidCategoryInput(body)) {
    return NextResponse.json({ success: false, error: 'label (string ≤40 chars) and type (drink|food) are required' }, { status: 400 })
  }

  const { label, type } = body
  const id = label.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

  if (!id) {
    return NextResponse.json({ success: false, error: 'Label must contain at least one alphanumeric character' }, { status: 400 })
  }

  const BUILT_IN_IDS = new Set(BUILT_IN_CATEGORIES.map((c) => c.id))
  if (BUILT_IN_IDS.has(id)) {
    return NextResponse.json({ success: false, error: `"${id}" is a built-in category and cannot be overridden` }, { status: 409 })
  }

  try {
    const existing = await fresh.fetch<{ _id: string }[]>(
      `*[_type == "menuCategory" && id == $id][0...1]`,
      { id },
      { cache: 'no-store' }
    )
    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: `Category "${id}" already exists` }, { status: 409 })
    }

    const maxOrderResult = await fresh.fetch<{ order: number }[]>(
      `*[_type == "menuCategory"] | order(order desc)[0...1]{order}`,
      {},
      { cache: 'no-store' }
    )
    const maxOrder = maxOrderResult.length > 0 ? (maxOrderResult[0].order ?? 6) : 6

    const writeClient = getWriteClient()
    const doc = await writeClient.create({
      _type: 'menuCategory',
      id,
      label: label.trim(),
      type,
      order: maxOrder + 1,
    })

    return NextResponse.json({
      success: true,
      category: { _sanityId: doc._id, id, label: label.trim(), type, order: maxOrder + 1, isBuiltIn: false },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create category.' }, { status: 500 })
  }
}
