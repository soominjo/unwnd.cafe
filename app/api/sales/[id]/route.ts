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
    await writeClient.delete(id)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete order.' }, { status: 500 })
  }
}

interface PatchBody {
  removeLineId?: string
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

  const { removeLineId } = body
  if (!removeLineId || typeof removeLineId !== 'string' || !isValidId(removeLineId)) {
    return NextResponse.json({ success: false, error: 'Invalid removeLineId' }, { status: 400 })
  }

  try {
    const writeClient = getWriteClient()

    const doc = await writeClient.getDocument<{
      items: Array<{ _key: string; price: number; qty: number }>
      paymentAmount: number
    }>(id)

    if (!doc) {
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
