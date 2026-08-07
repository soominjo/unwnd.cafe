import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { requirePosAuth } from '@/lib/requirePosAuth'

export const dynamic = 'force-dynamic'

const SETTINGS_ID = 'menu-settings'
const fresh = client.withConfig({ useCdn: false })

interface MenuSettings {
  hiddenItemIds: string[]
  categoryOrder: string[]
}

async function fetchSettings(): Promise<MenuSettings> {
  const doc = await fresh.fetch<{ hiddenItemIds?: string[]; categoryOrder?: string[] } | null>(
    `*[_type == "menuSettings" && _id == $id][0]{ hiddenItemIds, categoryOrder }`,
    { id: SETTINGS_ID },
    { cache: 'no-store' }
  )
  return { hiddenItemIds: doc?.hiddenItemIds ?? [], categoryOrder: doc?.categoryOrder ?? [] }
}

export async function GET() {
  try {
    const settings = await fetchSettings()
    return NextResponse.json({ success: true, ...settings })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch settings.' }, { status: 500 })
  }
}

interface HideAction {
  itemId: string
  action: 'hide' | 'restore'
}

interface ReorderAction {
  categoryOrder: string[]
}

function isHideAction(body: unknown): body is HideAction {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return (
    typeof b.itemId === 'string' && b.itemId.trim().length > 0 && b.itemId.length <= 100 &&
    (b.action === 'hide' || b.action === 'restore')
  )
}

function isReorderAction(body: unknown): body is ReorderAction {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return (
    Array.isArray(b.categoryOrder) &&
    b.categoryOrder.every((id) => typeof id === 'string' && id.length <= 60)
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

  try {
    const writeClient = getWriteClient()
    const current = await fetchSettings()

    if (isReorderAction(body)) {
      const updated: MenuSettings = { ...current, categoryOrder: body.categoryOrder }
      await writeClient.createOrReplace({ _id: SETTINGS_ID, _type: 'menuSettings', ...updated })
      return NextResponse.json({ success: true, ...updated })
    }

    if (isHideAction(body)) {
      const { itemId, action } = body
      const hiddenItemIds = action === 'hide'
        ? (current.hiddenItemIds.includes(itemId) ? current.hiddenItemIds : [...current.hiddenItemIds, itemId])
        : current.hiddenItemIds.filter((id) => id !== itemId)
      const updated: MenuSettings = { ...current, hiddenItemIds }
      await writeClient.createOrReplace({ _id: SETTINGS_ID, _type: 'menuSettings', ...updated })
      return NextResponse.json({ success: true, ...updated })
    }

    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update settings.' }, { status: 500 })
  }
}
