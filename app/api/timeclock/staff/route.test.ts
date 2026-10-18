import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { requirePosAuth, addStaff } = vi.hoisted(() => ({ requirePosAuth: vi.fn(), addStaff: vi.fn() }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/lib/timeclock/store', () => ({ addStaff }))

import { POST } from './route'
import { hashStaffPin } from '@/lib/timeclock/pins'

const SECRET = 'test-secret-that-is-long-enough-1234'
const post = (body: unknown) => POST(new NextRequest('http://pos.test/api/timeclock/staff', {
  method: 'POST',
  body: typeof body === 'string' ? body : JSON.stringify(body),
}))

beforeEach(() => {
  vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token')
  vi.stubEnv('STAFF_PIN_SECRET', SECRET)
  vi.stubEnv('POS_PIN', '2468')
  requirePosAuth.mockReset().mockResolvedValue(null)
  addStaff.mockReset().mockImplementation(async (name: string) => ({ ok: true, row: { staffId: 'new-id', name, hasPin: true, openShift: null } }))
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/timeclock/staff', () => {
  it('puts the name, cleaned up, on the time clock with its PIN’s fingerprint', async () => {
    const res = await post({ name: '  Ana   Cruz ', pin: '3333' })
    expect(res.status).toBe(201)
    expect(addStaff).toHaveBeenCalledWith('Ana Cruz', hashStaffPin('3333', SECRET))
    expect((await res.json()).data).toEqual({ staffId: 'new-id', name: 'Ana Cruz', hasPin: true, openShift: null })
  })

  it('refuses a bad name, a PIN that is not four digits, and the manager PIN', async () => {
    const short = await post({ name: 'A', pin: '3333' })
    expect((await short.json()).error).toBe('Enter a name: 2 to 60 characters.')
    const pin = await post({ name: 'Ana Cruz', pin: '33' })
    expect((await pin.json()).error).toBe('A PIN is 4 digits.')
    const manager = await post({ name: 'Ana Cruz', pin: '2468' })
    expect(manager.status).toBe(400)
    expect((await manager.json()).error).toBe("That's the manager PIN. Choose another.")
    expect((await post('not json')).status).toBe(400)
    expect(addStaff).not.toHaveBeenCalled()
  })

  it('answers 409 when the name or the PIN is someone else’s already', async () => {
    addStaff.mockResolvedValueOnce({ ok: false, problem: 'duplicate' }).mockResolvedValueOnce({ ok: false, problem: 'pin-taken' })
    const name = await post({ name: 'Ana Cruz', pin: '3333' })
    expect(name.status).toBe(409)
    expect((await name.json()).error).toBe('Ana Cruz is already on the time clock.')
    const pin = await post({ name: 'Ana Santos', pin: '2222' })
    expect((await pin.json()).error).toBe('Someone else has that PIN. Choose another.')
  })

  it('stops until STAFF_PIN_SECRET is set, and needs the POS session', async () => {
    vi.stubEnv('STAFF_PIN_SECRET', '')
    expect((await post({ name: 'Ana Cruz', pin: '3333' })).status).toBe(500)
    vi.stubEnv('STAFF_PIN_SECRET', SECRET)
    requirePosAuth.mockResolvedValue(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    expect((await post({ name: 'Ana Cruz', pin: '3333' })).status).toBe(401)
    expect(addStaff).not.toHaveBeenCalled()
  })
})
