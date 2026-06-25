import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { requirePosAuth } from '@/lib/requirePosAuth'

export const dynamic = 'force-dynamic'

const fresh = client.withConfig({ useCdn: false })

const BUILT_IN_IDS = new Set(['signature', 'espresso', 'non-coffee', 'meal', 'waffle', 'snack'])

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requirePosAuth()
  if (authError) return authError

  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  const { id: sanityId } = await params

  if (!sanityId || typeof sanityId !== 'string') {
    return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })
  }

  try {
    const doc = await fresh.fetch<{ _id: string; id: string } | null>(
      `*[_type == "menuCategory" && _id == $sanityId][0]`,
      { sanityId },
      { cache: 'no-store' }
    )

    if (!doc) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 })
    }

    if (BUILT_IN_IDS.has(doc.id)) {
      return NextResponse.json({ success: false, error: 'Built-in categories cannot be deleted' }, { status: 403 })
    }

    const usedCount = await fresh.fetch<number>(
      `count(*[_type == "menuItem" && category == $catId && available != false])`,
      { catId: doc.id },
      { cache: 'no-store' }
    )

    if (usedCount > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete — ${usedCount} menu item(s) still use this category` },
        { status: 409 }
      )
    }

    const writeClient = getWriteClient()
    await writeClient.delete(sanityId)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete category.' }, { status: 500 })
  }
}
