import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { requirePosAuth, punch } = vi.hoisted(() => ({ requirePosAuth: vi.fn(), punch: vi.fn() }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/lib/timeclock/store', () => ({ punch }))

import { POST } from './route'
import { hashStaffPin } from '@/lib/timeclock/pins'

const TOKEN = 'test-write-token-that-is-long-enough-1234'
const post = (body: unknown) => POST(new NextRequest('http://pos.test/api/timeclock/punch', {
  method: 'POST',
  body: typeof body === 'string' ? body : JSON.stringify(body),
}))
const shift = { _id: 'shift-1', staffId: 'john', staffName: 'John Reyes', clockIn: '2026-10-15T01:58:00.000Z', clockOut: null, editedAt: null }
const johnIn = { staffId: 'john', action: 'in', pin: '2222' }

beforeEach(() => {
  vi.stubEnv('SANITY_API_WRITE_TOKEN', TOKEN)
  requirePosAuth.mockReset().mockResolvedValue(null)
  punch.mockReset().mockResolvedValue({ ok: true, action: 'in', name: 'John Reyes', shift, repeat: false })
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/timeclock/punch', () => {
  it('clocks the person tapped, checking the PIN by its fingerprint, never passing the digits on', async () => {
    const res = await post(johnIn)
    expect(res.status).toBe(200)
    expect(punch).toHaveBeenCalledWith('john', hashStaffPin('2222', TOKEN), 'in')
    expect(JSON.stringify(punch.mock.calls[0])).not.toContain('2222')
    expect((await res.json()).data).toEqual({ action: 'in', name: 'John Reyes', shift, repeat: false })
  })

  it('logs who clocked in or out, without the PIN', async () => {
    await post(johnIn)
    expect(console.info).toHaveBeenCalledWith('Clocked in', { staffId: 'john', shiftId: 'shift-1', repeat: false })
  })

  it('answers 403 to someone else’s PIN, so the POS does not take it for a lost session', async () => {
    punch.mockResolvedValue({ ok: false, problem: 'wrong-pin' })
    const res = await post({ ...johnIn, pin: '3333' })
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Incorrect PIN. Try again.')
  })

  it('answers 409 to a Clock out for someone not clocked in, and 404 for someone removed', async () => {
    punch.mockResolvedValueOnce({ ok: false, problem: 'not-in', name: 'Ana Cruz' }).mockResolvedValueOnce({ ok: false, problem: 'no-staff' })
    const out = await post({ staffId: 'ana', action: 'out', pin: '3333' })
    expect(out.status).toBe(409)
    expect((await out.json()).error).toBe('Ana Cruz is not clocked in.')
    expect((await post(johnIn)).status).toBe(404)
  })

  it('refuses a body without a person, an action and a four-digit PIN, or that is not JSON', async () => {
    const bodies = [{}, { action: 'in', pin: '2222' }, { staffId: 'john', action: 'lunch', pin: '2222' }, { staffId: 'drafts.john', action: 'in', pin: '2222' }, { staffId: 'john', action: 'in', pin: '22' }, 'not json']
    for (const body of bodies) expect((await post(body)).status).toBe(400)
    expect(punch).not.toHaveBeenCalled()
  })

  it('stops with "Server misconfiguration" until SANITY_API_WRITE_TOKEN is set', async () => {
    vi.stubEnv('SANITY_API_WRITE_TOKEN', '')
    const res = await post(johnIn)
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Server misconfiguration')
    expect(punch).not.toHaveBeenCalled()
  })

  it('needs the POS session before anything else', async () => {
    requirePosAuth.mockResolvedValue(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    expect((await post(johnIn)).status).toBe(401)
    expect(punch).not.toHaveBeenCalled()
  })
})
