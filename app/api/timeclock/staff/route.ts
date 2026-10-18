import { NextRequest, NextResponse } from 'next/server'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { hasStaffPinSecret, hashStaffPin, staffPinRefusal } from '@/lib/timeclock/pins'
import { cleanStaffName, staffNameProblem } from '@/lib/timeclock/rules'
import { addStaff } from '@/lib/timeclock/store'

export const dynamic = 'force-dynamic'

// Putting someone on the time clock, from the Manager page: { name, pin }. The manager PIN is
// asked on that page.
export async function POST(request: NextRequest) {
  const authError = await requirePosAuth()
  if (authError) return authError

  if (!process.env.SANITY_API_WRITE_TOKEN || !hasStaffPinSecret()) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? cleanStaffName(body.name) : ''
  const problem = staffNameProblem(name) ?? staffPinRefusal(body.pin)
  if (problem) return NextResponse.json({ success: false, error: problem }, { status: 400 })

  try {
    const result = await addStaff(name, hashStaffPin(body.pin as string))
    if (!result.ok) {
      const error = result.problem === 'duplicate' ? `${name} is already on the time clock.` : 'Someone else has that PIN. Choose another.'
      return NextResponse.json({ success: false, error }, { status: 409 })
    }
    console.info('Staff added to the time clock', { id: result.row.staffId })
    return NextResponse.json({ success: true, data: result.row }, { status: 201 })
  } catch (error) {
    console.error('Staff could not be added to the time clock', error)
    return NextResponse.json({ success: false, error: 'Failed to add them.' }, { status: 500 })
  }
}
