import { NextRequest, NextResponse } from 'next/server'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { rewardOfSavedDiscount, type LoyaltyReward } from '@/lib/loyalty'
import { isValidNotes } from '@/lib/sales/validateSaleInput'

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id)
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
  if (!id || !isValidId(id)) {
    return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
  }

  try {
    const writeClient = getWriteClient()
    // Orders only: the query keeps this route from deleting a loyalty card holder or any other document.
    const result = await writeClient.delete({ query: '*[_type == "sale" && _id == $id]', params: { id } })
    if (result.results.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete order.' }, { status: 500 })
  }
}

interface PatchBody {
  removeLineId?: string
  markCompleted?: boolean
  /** The customer's name, stored as the sale's notes; empty clears it. */
  notes?: unknown
}

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
  if (!id || !isValidId(id)) {
    return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
  }

  let parsed: unknown
  try {
    parsed = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }
  // JSON that is not an object (null, a number, a string) carries none of the fields below.
  if (typeof parsed !== 'object' || parsed === null) {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }
  const body = parsed as PatchBody

  // ── Mark order as completed ────────────────────────────────────────────────
  if (body.markCompleted === true) {
    try {
      const writeClient = getWriteClient()
      const order = await writeClient.getDocument<{ _type: string }>(id)
      if (!order || order._type !== 'sale') {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
      }
      await writeClient.patch(id).set({ isCompleted: true }).commit()
      return NextResponse.json({ success: true })
    } catch {
      return NextResponse.json({ success: false, error: 'Failed to complete order.' }, { status: 500 })
    }
  }

  // ── Name the order (Sales): the customer's name, kept as the sale's notes ──
  if (body.notes !== undefined) {
    if (!isValidNotes(body.notes)) {
      return NextResponse.json({ success: false, error: 'Names are up to 100 characters.' }, { status: 400 })
    }
    const name = body.notes.trim()
    try {
      const writeClient = getWriteClient()
      const order = await writeClient.getDocument<{ _type: string; loyaltyMemberId?: string }>(id)
      if (!order || order._type !== 'sale') {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
      }
      // The card and the name on the order stay in step.
      if (order.loyaltyMemberId) {
        return NextResponse.json({ success: false, error: 'An order on a loyalty card keeps the card holder’s name.' }, { status: 400 })
      }
      const patch = writeClient.patch(id)
      await (name ? patch.set({ notes: name }) : patch.unset(['notes'])).commit()
      return NextResponse.json({ success: true, notes: name })
    } catch (error) {
      console.error('Order could not be renamed', { id }, error)
      return NextResponse.json({ success: false, error: 'Failed to rename the order.' }, { status: 500 })
    }
  }

  // ── Remove single item from order ──────────────────────────────────────────
  const { removeLineId } = body
  if (!removeLineId || typeof removeLineId !== 'string' || !isValidId(removeLineId)) {
    return NextResponse.json({ success: false, error: 'Invalid removeLineId' }, { status: 400 })
  }

  // Each write is made against the order as read, by its revision: Add items on the POS (or
  // another ✕) can save in between, and that save must not be written over. A clash reads the
  // order again, once.
  try {
    const writeClient = getWriteClient()
    for (let attempt = 1; attempt <= REMOVE_ATTEMPTS; attempt++) {
      const doc = await writeClient.getDocument<StoredOrder>(id)
      if (!doc || doc._type !== 'sale') {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
      }
      if (!Array.isArray(doc.items)) {
        return NextResponse.json({ success: false, error: 'Malformed order document' }, { status: 422 })
      }

      const next = withoutLine(doc, removeLineId)
      if (!next) {
        // The last line: the order goes, but only as it was read.
        const result = await writeClient.delete({ query: '*[_type == "sale" && _id == $id && _rev == $rev]', params: { id, rev: doc._rev } })
        if (result.results.length > 0) return NextResponse.json({ success: true, orderDeleted: true })
        continue
      }
      try {
        await writeClient.patch(id).ifRevisionId(doc._rev).set(next).commit()
        return NextResponse.json({ success: true, orderDeleted: false })
      } catch (error) {
        if ((error as { statusCode?: unknown }).statusCode !== 409) throw error
      }
    }
    return NextResponse.json({ success: false, error: 'This order changed on another device. Refresh, then try again.' }, { status: 409 })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update order.' }, { status: 500 })
  }
}

const REMOVE_ATTEMPTS = 2

interface StoredOrder {
  _type: string
  _rev: string
  items: Array<{ _key: string; price: number; qty: number }>
  discounts?: Array<{ _key?: string; lineId: string; name: string; amount: number }>
  loyaltyRewards?: LoyaltyReward[]
  paymentAmount: number
}

/** A whole-order row from before discounts went per line: tied to no one line, so it stays. */
const isOrderRow = (row: { lineId: string }) => row.lineId.startsWith('order:')

/**
 * The fields to write once a line is off the order, or null when it was the last line. The
 * line's own discount rows go with it, as do rows of lines taken off before (✕ used to leave
 * them), and a loyalty reward among them goes back on the card. The rows left come off the
 * total. Whole arrays are written, behind the revision they were read at.
 */
function withoutLine(doc: StoredOrder, lineId: string) {
  const items = doc.items.filter(item => item._key !== lineId)
  if (items.length === 0) return null
  const onOrder = new Set(items.map(item => item._key))
  const rows = doc.discounts ?? []
  const kept = rows.filter(row => isOrderRow(row) || onOrder.has(row.lineId))
  const released = rows
    .filter(row => !kept.includes(row))
    .map(row => rewardOfSavedDiscount(row.name))
    .filter((reward): reward is LoyaltyReward => reward !== null)
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0)
  const total = Math.max(0, subtotal - kept.reduce((sum, row) => sum + row.amount, 0))
  return {
    items,
    ...(doc.discounts ? { discounts: kept } : {}),
    subtotal,
    total,
    change: (doc.paymentAmount ?? 0) - total,
    ...(released.length > 0 ? { loyaltyRewards: (doc.loyaltyRewards ?? []).filter(reward => !released.includes(reward)) } : {}),
  }
}
