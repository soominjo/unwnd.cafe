import { NextRequest, NextResponse } from 'next/server'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { isDocId, readInstant } from '@/lib/timeclock/rules'
import { deleteShift, editShift } from '@/lib/timeclock/store'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const misconfigured = () => NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
const badId = () => NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
const gone = () => NextResponse.json({ success: false, error: 'That shift was deleted already.' }, { status: 404 })

// A manager's fix to a shift from Records: { clockIn, clockOut }, with clockOut null to keep an
// open shift open. Like menu editing, the manager PIN is asked on the POS; this route, like the
// menu routes, takes any signed-in POS.
export async function PATCH(request: NextRequest, { params }: Params) {
  const authError = await requirePosAuth()
  if (authError) return authError
  if (!process.env.SANITY_API_WRITE_TOKEN) return misconfigured()

  const { id } = await params
  if (!isDocId(id)) return badId()

  let body: Record<string, unknown>
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }
  const clockIn = readInstant(body.clockIn)
  const clockOut = body.clockOut === null ? null : readInstant(body.clockOut)
  if (clockIn === null || (body.clockOut !== null && clockOut === null)) {
    return NextResponse.json({ success: false, error: 'Send the time in, and the time out or null.' }, { status: 400 })
  }

  try {
    const result = await editShift(id, { clockIn, clockOut })
    if (result.ok) {
      console.info('Shift edited', { id, clockIn, clockOut })
      return NextResponse.json({ success: true, data: result.shift })
    }
    if (result.problem === 'gone') return gone()
    if (result.problem === 'changed') {
      return NextResponse.json({ success: false, error: 'This shift changed on another device. Check it and try again.' }, { status: 409 })
    }
    return NextResponse.json({ success: false, error: result.message }, { status: 400 })
  } catch (error) {
    console.error('Shift could not be edited', error)
    return NextResponse.json({ success: false, error: 'Failed to save the shift.' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const authError = await requirePosAuth()
  if (authError) return authError
  if (!process.env.SANITY_API_WRITE_TOKEN) return misconfigured()

  const { id } = await params
  if (!isDocId(id)) return badId()

  try {
    if (!(await deleteShift(id))) return gone()
    console.info('Shift deleted', { id })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Shift could not be deleted', error)
    return NextResponse.json({ success: false, error: 'Failed to delete the shift.' }, { status: 500 })
  }
}
