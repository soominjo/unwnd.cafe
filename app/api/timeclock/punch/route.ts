import { NextRequest, NextResponse } from 'next/server'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { hasStaffPinKey, hashStaffPin } from '@/lib/timeclock/pins'
import { isDocId, isStaffPin } from '@/lib/timeclock/rules'
import { punch } from '@/lib/timeclock/store'

export const dynamic = 'force-dynamic'

// Clock in or Clock out, tapped on someone's name on the Time clock page:
// { staffId, action: 'in' | 'out', pin }. The PIN must be that person's; the server picks the
// time. A wrong PIN answers 403, not 401: a 401 tells the POS its session has ended.
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
  const { staffId, action, pin } = body
  if (!isDocId(staffId) || (action !== 'in' && action !== 'out')) {
    return NextResponse.json({ success: false, error: 'Send staffId, and action "in" or "out".' }, { status: 400 })
  }
  if (!isStaffPin(pin)) {
    return NextResponse.json({ success: false, error: 'Enter your 4-digit PIN.' }, { status: 400 })
  }

  try {
    const result = await punch(staffId, hashStaffPin(pin), action)
    if (!result.ok) {
      switch (result.problem) {
        case 'no-staff':
          return NextResponse.json({ success: false, error: 'That person is not on the time clock any more.' }, { status: 404 })
        case 'wrong-pin':
          return NextResponse.json({ success: false, error: 'Incorrect PIN. Try again.' }, { status: 403 })
        case 'not-in':
          return NextResponse.json({ success: false, error: `${result.name} is not clocked in.` }, { status: 409 })
        case 'changed':
          return NextResponse.json({ success: false, error: 'That changed on another device. Try again.' }, { status: 409 })
      }
    }
    console.info(result.action === 'in' ? 'Clocked in' : 'Clocked out', { staffId, shiftId: result.shift._id, repeat: result.repeat })
    const { name, shift, repeat } = result
    return NextResponse.json({ success: true, data: { action: result.action, name, shift, repeat } })
  } catch (error) {
    console.error('Clock in or out could not be saved', error)
    return NextResponse.json({ success: false, error: 'Failed to save. Try again.' }, { status: 500 })
  }
}
