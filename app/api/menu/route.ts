import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { requirePosAuth } from '@/lib/requirePosAuth'

export const dynamic = 'force-dynamic'

const fresh = client.withConfig({ useCdn: false })

export async function GET() {
  try {
    const items = await fresh.fetch<{
      _id: string
      name: string
      subtitle: string | null
      category: string
      priceHot: number | null
      priceIce: number | null
      priceFixed: number | null
    }[]>(
      `*[_type == "menuItem" && available != false] {
        _id,
        name,
        subtitle,
        category,
        priceHot,
        priceIce,
        "priceFixed": price
      }`,
      {},
      { cache: 'no-store' }
    )
    return NextResponse.json({ success: true, items })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch menu items.' }, { status: 500 })
  }
}

const MAX_PRICE = 100_000

interface MenuItemInput {
  name: string
  subtitle?: string
  category: string
  priceHot?: number | null
  priceIce?: number | null
  priceFixed?: number | null
}

function isValidMenuItemInput(body: unknown): body is MenuItemInput {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  if (typeof b.name !== 'string' || b.name.trim().length === 0 || b.name.length > 80) return false
  if (typeof b.category !== 'string' || b.category.trim().length === 0 || b.category.length > 60) return false
  if (b.subtitle !== undefined && b.subtitle !== null) {
    if (typeof b.subtitle !== 'string' || b.subtitle.length > 200) return false
  }
  const validatePrice = (v: unknown) =>
    v === undefined || v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_PRICE)
  return validatePrice(b.priceHot) && validatePrice(b.priceIce) && validatePrice(b.priceFixed)
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

  if (!isValidMenuItemInput(body)) {
    return NextResponse.json({ success: false, error: 'Invalid menu item data' }, { status: 400 })
  }

  const { name, subtitle, category, priceHot, priceIce, priceFixed } = body

  const hasPrice = (priceHot ?? null) !== null || (priceIce ?? null) !== null || (priceFixed ?? null) !== null
  if (!hasPrice) {
    return NextResponse.json({ success: false, error: 'At least one price (hot, ice, or fixed) is required' }, { status: 400 })
  }

  try {
    const writeClient = getWriteClient()
    const doc = await writeClient.create({
      _type: 'menuItem',
      name: name.trim(),
      subtitle: subtitle?.trim() ?? '',
      category: category.trim(),
      priceHot: priceHot ?? null,
      priceIce: priceIce ?? null,
      price: priceFixed ?? null,
      available: true,
    })

    return NextResponse.json({
      success: true,
      item: {
        _id: doc._id,
        name: name.trim(),
        subtitle: subtitle?.trim() ?? '',
        category: category.trim(),
        priceHot: priceHot ?? null,
        priceIce: priceIce ?? null,
        priceFixed: priceFixed ?? null,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create menu item.' }, { status: 500 })
  }
}
