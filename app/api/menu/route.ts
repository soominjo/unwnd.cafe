import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { isValidMenuItemInput } from '@/lib/validateMenuItemInput'
import { fetchPosMenuItems } from '@/lib/posMenu'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const items = await fetchPosMenuItems()
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
    // The customer-facing menu follows the POS: its next visit shows the new item.
    revalidatePath('/menu')

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
