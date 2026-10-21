import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { MENU_SETTINGS_ID as SETTINGS_ID, fetchMenuSettings, type MenuSettings } from '@/lib/posMenu'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const settings = await fetchMenuSettings()
    return NextResponse.json({ success: true, ...settings })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch settings.' }, { status: 500 })
  }
}

interface ReorderAction {
  categoryOrder: string[]
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

    if (isReorderAction(body)) {
      const updated: MenuSettings = { categoryOrder: body.categoryOrder }
      await writeClient.createOrReplace({ _id: SETTINGS_ID, _type: 'menuSettings', ...updated })
      // /menu shows its tabs in this order too.
      revalidatePath('/menu')
      return NextResponse.json({ success: true, ...updated })
    }

    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update settings.' }, { status: 500 })
  }
}
