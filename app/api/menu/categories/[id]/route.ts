import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { client } from '@/sanity/lib/client'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { cleanCategoryLabel } from '@/lib/menuCategoryLabel'
import { MENU_SETTINGS_ID, fetchMenuSettings } from '@/lib/posMenu'
import type { ResolvedCategory } from '@/lib/menuCategories'

export const dynamic = 'force-dynamic'

const fresh = client.withConfig({ useCdn: false })

// Every tab is a menuCategory document, so manager mode on the POS can rename any tab and
// delete any tab, the ones that used to be written in code included. [id] is the tab's _id.

interface TabDoc {
  _id: string
  id: string
  label: string
  type: 'drink' | 'food'
  order: number
}

async function readTab(sanityId: string): Promise<TabDoc | null> {
  return fresh.fetch<TabDoc | null>(
    `*[_type == "menuCategory" && _id == $sanityId][0]{ _id, id, label, type, order }`,
    { sanityId },
    { cache: 'no-store' }
  )
}

/** Shared checks: a signed-in POS, the write token, and a usable [id]. Null when all pass. */
async function refuseUnlessReady(sanityId: string): Promise<NextResponse | null> {
  const authError = await requirePosAuth()
  if (authError) return authError
  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }
  if (!sanityId) {
    return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })
  }
  return null
}

/** Rename: only the name changes. The id stays, so the tab keeps its items, loyalty rules and filters. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sanityId } = await params
  const notReady = await refuseUnlessReady(sanityId)
  if (notReady) return notReady

  let body: unknown
  try {
    body = await request.json()
  } catch {
    body = null
  }
  const label = cleanCategoryLabel((body as { label?: unknown } | null)?.label)
  if (label === null) {
    return NextResponse.json({ success: false, error: 'Name must be 1–40 characters.' }, { status: 400 })
  }

  try {
    const tab = await readTab(sanityId)
    if (!tab) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 })
    }

    await getWriteClient().patch(tab._id).set({ label }).commit()
    revalidatePath('/menu')

    const category: ResolvedCategory = { _sanityId: tab._id, id: tab.id, label, type: tab.type, order: tab.order }
    return NextResponse.json({ success: true, category })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to rename category.' }, { status: 500 })
  }
}

/**
 * How many items the category manager said the tab holds (`?items=N`), or null when the request
 * didn't say: a page loaded before tabs could be deleted with their items.
 */
function itemsShown(request: NextRequest): number | null {
  const shown = request.nextUrl.searchParams.get('items')
  return shown !== null && /^\d+$/.test(shown) ? Number(shown) : null
}

/**
 * Delete: the tab, every item in it and its place in the tab order go together, in one write.
 * A tab with items goes only when the request says how many items the screen showed, and the tab
 * holds no more than that now, so nothing is deleted that the manager wasn't told about.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sanityId } = await params
  const notReady = await refuseUnlessReady(sanityId)
  if (notReady) return notReady

  try {
    const tab = await readTab(sanityId)
    if (!tab) {
      return NextResponse.json({ success: false, error: 'Category not found' }, { status: 404 })
    }

    const [items, settings] = await Promise.all([
      fresh.fetch<{ _id: string; available: boolean | null }[]>(
        `*[_type == "menuItem" && category == $id]{ _id, available }`,
        { id: tab.id },
        { cache: 'no-store' }
      ),
      fetchMenuSettings(),
    ])
    // The POS counts the items it shows (unavailable ones are hidden); all of them are deleted.
    const onScreen = items.filter((i) => i.available !== false).length
    const shown = itemsShown(request)
    if (onScreen > 0 && shown === null) {
      return NextResponse.json({ success: false, error: 'Reload the POS to delete a tab that still has items.' }, { status: 409 })
    }
    if (shown !== null && onScreen > shown) {
      return NextResponse.json(
        { success: false, error: `${tab.label} now has ${onScreen} item${onScreen === 1 ? '' : 's'}. Reload the POS and try again.` },
        { status: 409 }
      )
    }
    const itemIds = items.map((i) => i._id)

    const orderPatch = settings.categoryOrder.includes(tab.id)
      ? [{ patch: { id: MENU_SETTINGS_ID, set: { categoryOrder: settings.categoryOrder.filter((id) => id !== tab.id) } } }]
      : []
    await getWriteClient().mutate([
      { delete: { id: tab._id } },
      ...itemIds.map((id) => ({ delete: { id } })),
      ...orderPatch,
    ])
    revalidatePath('/menu')

    return NextResponse.json({ success: true, deletedItems: itemIds.length })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete category.' }, { status: 500 })
  }
}
