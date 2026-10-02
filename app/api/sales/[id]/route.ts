import { NextRequest, NextResponse } from 'next/server'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { requirePosAuth } from '@/lib/requirePosAuth'

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

  let body: PatchBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

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

  // ── Remove single item from order ──────────────────────────────────────────
  const { removeLineId } = body
  if (!removeLineId || typeof removeLineId !== 'string' || !isValidId(removeLineId)) {
    return NextResponse.json({ success: false, error: 'Invalid removeLineId' }, { status: 400 })
  }

  try {
    const writeClient = getWriteClient()

    const doc = await writeClient.getDocument<{
      _type: string
      items: Array<{ _key: string; price: number; qty: number }>
      paymentAmount: number
    }>(id)

    if (!doc || doc._type !== 'sale') {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }

    if (!Array.isArray(doc.items)) {
      return NextResponse.json({ success: false, error: 'Malformed order document' }, { status: 422 })
    }

    const remaining = doc.items.filter(item => item._key !== removeLineId)

    if (remaining.length === 0) {
      await writeClient.delete(id)
      return NextResponse.json({ success: true, orderDeleted: true })
    }

    const newTotal  = remaining.reduce((sum, item) => sum + item.price * item.qty, 0)
    const newChange = (doc.paymentAmount ?? 0) - newTotal

    await writeClient
      .patch(id)
      .unset([`items[_key == "${removeLineId}"]`])
      .set({ total: newTotal, change: newChange })
      .commit()

    return NextResponse.json({ success: true, orderDeleted: false })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update order.' }, { status: 500 })
  }
}
