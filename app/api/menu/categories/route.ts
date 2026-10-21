import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { client } from '@/sanity/lib/client'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { getResolvedCategories } from '@/lib/menuCategories'
import { categoryIdFromLabel, cleanCategoryLabel } from '@/lib/menuCategoryLabel'

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
  if (cleanCategoryLabel(b.label) === null) return false
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
  const id = categoryIdFromLabel(label)

  if (!id) {
    return NextResponse.json({ success: false, error: 'Label must contain at least one alphanumeric character' }, { status: 400 })
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
    const maxOrder = maxOrderResult.length > 0 ? (maxOrderResult[0].order ?? 0) : 0

    const writeClient = getWriteClient()
    const doc = await writeClient.create({
      _type: 'menuCategory',
      id,
      label: label.trim(),
      type,
      order: maxOrder + 1,
    })
    revalidatePath('/menu')

    return NextResponse.json({
      success: true,
      category: { _sanityId: doc._id, id, label: label.trim(), type, order: maxOrder + 1 },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create category.' }, { status: 500 })
  }
}
