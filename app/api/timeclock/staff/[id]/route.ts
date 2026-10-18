import { NextRequest, NextResponse } from 'next/server'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { hasStaffPinSecret, hashStaffPin, staffPinRefusal } from '@/lib/timeclock/pins'
import { isDocId } from '@/lib/timeclock/rules'
import { removeStaff, setStaffPin } from '@/lib/timeclock/store'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const misconfigured = () => NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
const badId = () => NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
const gone = () => NextResponse.json({ success: false, error: 'They are off the time clock already.' }, { status: 404 })

// A new PIN for someone, from the Manager page: { pin }. Nobody can read a PIN back, so a
// forgotten one is replaced here.
export async function PATCH(request: NextRequest, { params }: Params) {
  const authError = await requirePosAuth()
  if (authError) return authError
  if (!process.env.SANITY_API_WRITE_TOKEN || !hasStaffPinSecret()) return misconfigured()

  const { id } = await params
  if (!isDocId(id)) return badId()

  let body: Record<string, unknown>
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }
  const problem = staffPinRefusal(body.pin)
  if (problem) return NextResponse.json({ success: false, error: problem }, { status: 400 })

  try {
    const result = await setStaffPin(id, hashStaffPin(body.pin as string))
    if (result.ok) {
      console.info('Staff PIN changed', { id })
      return NextResponse.json({ success: true })
    }
    if (result.problem === 'gone') return gone()
    return NextResponse.json({ success: false, error: 'Someone else has that PIN. Choose another.' }, { status: 409 })
  } catch (error) {
    console.error('Staff PIN could not be changed', error)
    return NextResponse.json({ success: false, error: 'Failed to change the PIN.' }, { status: 500 })
  }
}

// Taking someone off the time clock, from the Manager page. Their shifts stay; someone on shift
// has to clock out first, so no shift is left open with nobody to close it.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const authError = await requirePosAuth()
  if (authError) return authError
  if (!process.env.SANITY_API_WRITE_TOKEN) return misconfigured()

  const { id } = await params
  if (!isDocId(id)) return badId()

  try {
    const result = await removeStaff(id)
    if (result.ok) {
      console.info('Staff removed from the time clock', { id })
      return NextResponse.json({ success: true })
    }
    if (result.problem === 'gone') return gone()
    return NextResponse.json({ success: false, error: `${result.name} is on shift. Clock them out first.` }, { status: 409 })
  } catch (error) {
    console.error('Staff could not be removed from the time clock', error)
    return NextResponse.json({ success: false, error: 'Failed to remove them.' }, { status: 500 })
  }
}
