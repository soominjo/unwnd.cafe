import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { BUILT_IN_CATEGORIES, getResolvedCategories } from '@/lib/menuCategories'

export const dynamic = 'force-dynamic'

const fresh = client.withConfig({ useCdn: false })

export async function GET() {
  try {
    const categories = await getResolvedCategories()
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
