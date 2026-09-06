import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { isValidMenuItemInput } from '@/lib/validateMenuItemInput'

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
      addonType: 'drink' | 'food' | null
      hiddenFromPos: boolean | null
      applicableCategories: string[] | null
    }[]>(
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
    return NextResponse.json({ success: true, items })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch menu items.' }, { status: 500 })
  }
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

  const { name, subtitle, category, priceHot, priceIce, priceFixed, addonType, hiddenFromPos, applicableCategories } = body

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
      addonType: addonType ?? null,
      hiddenFromPos: hiddenFromPos ?? false,
      applicableCategories: applicableCategories ?? null,
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
        addonType: addonType ?? null,
        hiddenFromPos: hiddenFromPos ?? false,
        applicableCategories: applicableCategories ?? null,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create menu item.' }, { status: 500 })
  }
}
