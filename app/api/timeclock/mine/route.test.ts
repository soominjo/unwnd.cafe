import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { requirePosAuth, fetchMine } = vi.hoisted(() => ({ requirePosAuth: vi.fn(), fetchMine: vi.fn() }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/lib/timeclock/store', () => ({ fetchMine }))

import { POST } from './route'
import { hashStaffPin } from '@/lib/timeclock/pins'

const SECRET = 'test-secret-that-is-long-enough-1234'
const WEEK = { from: '2026-10-11T16:00:00.000Z', to: '2026-10-18T16:00:00.000Z' }
const post = (body: unknown) => POST(new NextRequest('http://pos.test/api/timeclock/mine', {
  method: 'POST',
  body: typeof body === 'string' ? body : JSON.stringify(body),
}))
const mine = { name: 'John Reyes', openShift: null, shifts: [] }

beforeEach(() => {
  vi.stubEnv('STAFF_PIN_SECRET', SECRET)
  requirePosAuth.mockReset().mockResolvedValue(null)
  fetchMine.mockReset().mockResolvedValue(mine)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/timeclock/mine', () => {
  it('gives that person’s own hours, found by the PIN’s fingerprint', async () => {
    const res = await post({ pin: '2222', ...WEEK })
    expect(res.status).toBe(200)
    expect(fetchMine).toHaveBeenCalledWith(hashStaffPin('2222', SECRET), WEEK.from, WEEK.to)
    expect((await res.json()).data).toEqual(mine)
  })

  it('answers 403 to a PIN nobody has', async () => {
    fetchMine.mockResolvedValue(null)
    const res = await post({ pin: '9999', ...WEEK })
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('PIN not recognised. Try again.')
  })

  it('refuses a PIN that is not four digits, or a range that is wrong', async () => {
    expect((await post({ pin: '22', ...WEEK })).status).toBe(400)
    expect((await post({ pin: '2222', from: WEEK.to, to: WEEK.from })).status).toBe(400)
    expect((await post({ pin: '2222' })).status).toBe(400)
    expect((await post('not json')).status).toBe(400)
    expect(fetchMine).not.toHaveBeenCalled()
  })

  it('stops until STAFF_PIN_SECRET is set, and needs the POS session', async () => {
    vi.stubEnv('STAFF_PIN_SECRET', '')
    expect((await post({ pin: '2222', ...WEEK })).status).toBe(500)
    vi.stubEnv('STAFF_PIN_SECRET', SECRET)
    requirePosAuth.mockResolvedValue(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    expect((await post({ pin: '2222', ...WEEK })).status).toBe(401)
    expect(fetchMine).not.toHaveBeenCalled()
  })
})
