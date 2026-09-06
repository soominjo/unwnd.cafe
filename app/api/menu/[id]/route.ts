import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { isValidMenuItemInput } from '@/lib/validateMenuItemInput'

export const dynamic = 'force-dynamic'

const fresh = client.withConfig({ useCdn: false })

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requirePosAuth()
  if (authError) return authError

  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  const { id } = await params

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })
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

  const { name, subtitle, priceHot, priceIce, priceFixed, addonType, hiddenFromPos, applicableCategories } = body

  const hasPrice = (priceHot ?? null) !== null || (priceIce ?? null) !== null || (priceFixed ?? null) !== null
  if (!hasPrice) {
    return NextResponse.json({ success: false, error: 'At least one price (hot, ice, or fixed) is required' }, { status: 400 })
  }

  try {
    const doc = await fresh.fetch<{ _id: string; category: string } | null>(
      `*[_type == "menuItem" && _id == $id][0]{_id, category}`,
      { id },
      { cache: 'no-store' }
    )

    if (!doc) {
      return NextResponse.json({ success: false, error: 'Menu item not found' }, { status: 404 })
    }

    const writeClient = getWriteClient()
    await writeClient
      .patch(id)
      .set({
        name: name.trim(),
        subtitle: subtitle?.trim() ?? '',
        priceHot: priceHot ?? null,
        priceIce: priceIce ?? null,
        price: priceFixed ?? null,
        addonType: addonType ?? null,
        hiddenFromPos: hiddenFromPos ?? false,
        applicableCategories: applicableCategories ?? null,
      })
      .commit()

    return NextResponse.json({
      success: true,
      item: {
        _id: id,
        name: name.trim(),
        subtitle: subtitle?.trim() ?? '',
        category: doc.category,
        priceHot: priceHot ?? null,
        priceIce: priceIce ?? null,
        priceFixed: priceFixed ?? null,
        addonType: addonType ?? null,
        hiddenFromPos: hiddenFromPos ?? false,
        applicableCategories: applicableCategories ?? null,
      },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update menu item.' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requirePosAuth()
  if (authError) return authError

  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  const { id } = await params

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })
  }

  try {
    const doc = await fresh.fetch<{ _id: string } | null>(
      `*[_type == "menuItem" && _id == $id][0]{_id}`,
      { id },
      { cache: 'no-store' }
    )

    if (!doc) {
      return NextResponse.json({ success: false, error: 'Menu item not found' }, { status: 404 })
    }

    const writeClient = getWriteClient()
    await writeClient.delete(id)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete menu item.' }, { status: 500 })
  }
}
