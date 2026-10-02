import { NextRequest, NextResponse } from 'next/server'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { isPosPin } from '@/lib/posPin'
import { removeCardHolder } from '@/lib/loyaltyStore'

export const dynamic = 'force-dynamic'

// Removing a card: { pin }. Their past orders keep the customer's name. A wrong PIN is a
// 403, so the POS can tell it from a signed-out session (401).
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requirePosAuth()
  if (authError) return authError

  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  const { id } = await params
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
    return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }
  if (!isPosPin(body.pin)) {
    console.warn('Loyalty card not removed: wrong manager PIN', { id })
    return NextResponse.json({ success: false, error: 'Incorrect PIN' }, { status: 403 })
  }

  try {
    const removed = await removeCardHolder(id)
    if (!removed) return NextResponse.json({ success: false, error: 'That card holder no longer exists.' }, { status: 404 })
    console.info('Loyalty card removed', { id })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Loyalty card holder could not be removed', error)
    return NextResponse.json({ success: false, error: 'Failed to remove the card holder.' }, { status: 500 })
  }
}
