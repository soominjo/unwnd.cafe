import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { requirePosAuth } from '@/lib/requirePosAuth'

export const dynamic = 'force-dynamic'

const SETTINGS_ID = 'menu-settings'
const fresh = client.withConfig({ useCdn: false })

async function fetchHiddenIds(): Promise<string[]> {
  const doc = await fresh.fetch<{ hiddenItemIds?: string[] } | null>(
    `*[_type == "menuSettings" && _id == $id][0]{ hiddenItemIds }`,
    { id: SETTINGS_ID },
    { cache: 'no-store' }
  )
  return doc?.hiddenItemIds ?? []
}

export async function GET() {
  try {
    const hiddenItemIds = await fetchHiddenIds()
    return NextResponse.json({ success: true, hiddenItemIds })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch settings.' }, { status: 500 })
  }
}

interface SettingsAction {
  itemId: string
  action: 'hide' | 'restore'
}

function isValidAction(body: unknown): body is SettingsAction {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return (
    typeof b.itemId === 'string' && b.itemId.trim().length > 0 && b.itemId.length <= 100 &&
    (b.action === 'hide' || b.action === 'restore')
  )
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

  if (!isValidAction(body)) {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const { itemId, action } = body

  try {
    const writeClient = getWriteClient()
    const current = await fetchHiddenIds()

    let updated: string[]
    if (action === 'hide') {
      updated = current.includes(itemId) ? current : [...current, itemId]
    } else {
      updated = current.filter((id) => id !== itemId)
    }

    await writeClient.createOrReplace({
      _id: SETTINGS_ID,
      _type: 'menuSettings',
      hiddenItemIds: updated,
    })

    return NextResponse.json({ success: true, hiddenItemIds: updated })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update settings.' }, { status: 500 })
  }
}
