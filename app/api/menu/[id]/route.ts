import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { requirePosAuth } from '@/lib/requirePosAuth'

export const dynamic = 'force-dynamic'

const fresh = client.withConfig({ useCdn: false })

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
