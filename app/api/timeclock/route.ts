import { NextRequest, NextResponse } from 'next/server'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { readRange } from '@/lib/timeclock/rules'
import { fetchBoard, fetchShifts } from '@/lib/timeclock/store'

export const dynamic = 'force-dynamic'

// Everyone on the time clock, with no PINs: the POS header counts who is on shift from it, and
// the Manager page lists the staff. With ?from=&to= it adds everyone's shifts that began in that
// range, for Hours. The manager PIN is asked on the Manager page; like the menu routes, this
// route takes any signed-in POS.
export async function GET(request: NextRequest) {
  const authError = await requirePosAuth()
  if (authError) return authError

  const params = request.nextUrl.searchParams
  const wantsShifts = params.has('from') || params.has('to')
  const range = wantsShifts ? readRange(params.get('from'), params.get('to')) : null
  if (wantsShifts && !range) {
    return NextResponse.json({ success: false, error: 'Give from and to as UTC times, at most two months apart.' }, { status: 400 })
  }

  try {
    const [board, shifts] = await Promise.all([fetchBoard(), range ? fetchShifts(range.from, range.to) : Promise.resolve([])])
    return NextResponse.json({ success: true, data: { board, shifts } })
  } catch (error) {
    console.error('Time clock could not be read', error)
    return NextResponse.json({ success: false, error: 'Failed to load the time clock.' }, { status: 500 })
  }
}
