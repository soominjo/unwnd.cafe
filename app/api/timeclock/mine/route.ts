import { NextRequest, NextResponse } from 'next/server'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { hasStaffPinKey, hashStaffPin } from '@/lib/timeclock/pins'
import { isStaffPin, readRange } from '@/lib/timeclock/rules'
import { fetchMine } from '@/lib/timeclock/store'

export const dynamic = 'force-dynamic'

// My records on the Time clock page: { pin, from, to } gives that person's own shifts in the range,
// and nobody else's. A POST, so the PIN travels in the body rather than in a URL that gets logged.
export async function POST(request: NextRequest) {
  const authError = await requirePosAuth()
  if (authError) return authError

  if (!hasStaffPinKey()) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }
  if (!isStaffPin(body.pin)) {
    return NextResponse.json({ success: false, error: 'Enter your 4-digit PIN.' }, { status: 400 })
  }
  const range = readRange(body.from, body.to)
  if (!range) {
    return NextResponse.json({ success: false, error: 'Give from and to as UTC times, at most two months apart.' }, { status: 400 })
  }

  try {
    const mine = await fetchMine(hashStaffPin(body.pin), range.from, range.to)
    if (!mine) return NextResponse.json({ success: false, error: 'PIN not recognised. Try again.' }, { status: 403 })
    return NextResponse.json({ success: true, data: mine })
  } catch (error) {
    console.error('My records could not be read', error)
    return NextResponse.json({ success: false, error: 'Failed to load your records.' }, { status: 500 })
  }
}
