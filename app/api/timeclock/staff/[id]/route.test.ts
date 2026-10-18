import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { requirePosAuth, removeStaff, setStaffPin } = vi.hoisted(() => ({ requirePosAuth: vi.fn(), removeStaff: vi.fn(), setStaffPin: vi.fn() }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/lib/timeclock/store', () => ({ removeStaff, setStaffPin }))

import { DELETE, PATCH } from './route'
import { hashStaffPin } from '@/lib/timeclock/pins'

const TOKEN = 'test-write-token-that-is-long-enough-1234'
const url = (id: string) => `http://pos.test/api/timeclock/staff/${id}`
const context = (id: string) => ({ params: Promise.resolve({ id }) })
const patch = (id: string, body: unknown) =>
  PATCH(new NextRequest(url(id), { method: 'PATCH', body: typeof body === 'string' ? body : JSON.stringify(body) }), context(id))
const remove = (id: string) => DELETE(new NextRequest(url(id), { method: 'DELETE' }), context(id))
const signedOut = () => NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

beforeEach(() => {
  vi.stubEnv('SANITY_API_WRITE_TOKEN', TOKEN)
  vi.stubEnv('POS_PIN', '2468')
  requirePosAuth.mockReset().mockResolvedValue(null)
  removeStaff.mockReset().mockResolvedValue({ ok: true, name: 'Ana Cruz' })
  setStaffPin.mockReset().mockResolvedValue({ ok: true, name: 'Ana Cruz' })
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('PATCH /api/timeclock/staff/[id]', () => {
  it('gives them a new PIN, stored as its fingerprint', async () => {
    expect((await patch('ana', { pin: '4321' })).status).toBe(200)
    expect(setStaffPin).toHaveBeenCalledWith('ana', hashStaffPin('4321', TOKEN))
  })

  it('refuses a PIN that is not four digits, the manager PIN, and a bad id', async () => {
    expect((await patch('ana', { pin: '43' })).status).toBe(400)
    const manager = await patch('ana', { pin: '2468' })
    expect((await manager.json()).error).toBe("That's the manager PIN. Choose another.")
    expect((await patch('drafts.ana', { pin: '4321' })).status).toBe(400)
    expect(setStaffPin).not.toHaveBeenCalled()
  })

  it('answers 409 for a PIN someone else has, and 404 for someone removed', async () => {
    setStaffPin.mockResolvedValueOnce({ ok: false, problem: 'pin-taken' }).mockResolvedValueOnce({ ok: false, problem: 'gone' })
    const taken = await patch('ana', { pin: '2222' })
    expect(taken.status).toBe(409)
    expect((await taken.json()).error).toBe('Someone else has that PIN. Choose another.')
    expect((await patch('ana', { pin: '4321' })).status).toBe(404)
  })

  it('needs the POS session', async () => {
    requirePosAuth.mockResolvedValue(signedOut())
    expect((await patch('ana', { pin: '4321' })).status).toBe(401)
    expect(setStaffPin).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/timeclock/staff/[id]', () => {
  it('takes them off the time clock', async () => {
    expect((await remove('ana')).status).toBe(200)
    expect(removeStaff).toHaveBeenCalledWith('ana')
  })

  it('refuses while they are on shift, and says what to do', async () => {
    removeStaff.mockResolvedValue({ ok: false, problem: 'on-shift', name: 'John Reyes' })
    const res = await remove('john')
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('John Reyes is on shift. Clock them out first.')
  })

  it('answers 404 when they were removed already, and 400 for an id that is not a document id', async () => {
    removeStaff.mockResolvedValue({ ok: false, problem: 'gone' })
    expect((await remove('ana')).status).toBe(404)
    expect((await remove('drafts.ana')).status).toBe(400)
  })

  it('needs the POS session', async () => {
    requirePosAuth.mockResolvedValue(signedOut())
    expect((await remove('ana')).status).toBe(401)
    expect(removeStaff).not.toHaveBeenCalled()
  })
})
