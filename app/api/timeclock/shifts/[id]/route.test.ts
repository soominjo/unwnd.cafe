import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { requirePosAuth, editShift, deleteShift } = vi.hoisted(() => ({ requirePosAuth: vi.fn(), editShift: vi.fn(), deleteShift: vi.fn() }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/lib/timeclock/store', () => ({ editShift, deleteShift }))

import { DELETE, PATCH } from './route'

const url = (id: string) => `http://pos.test/api/timeclock/shifts/${id}`
const context = (id: string) => ({ params: Promise.resolve({ id }) })
const patch = (id: string, body: unknown) =>
  PATCH(new NextRequest(url(id), { method: 'PATCH', body: typeof body === 'string' ? body : JSON.stringify(body) }), context(id))
const remove = (id: string) => DELETE(new NextRequest(url(id), { method: 'DELETE' }), context(id))
const times = { clockIn: '2026-10-14T23:44:00.000Z', clockOut: '2026-10-15T07:46:00.000Z' }

beforeEach(() => {
  vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token')
  requirePosAuth.mockReset().mockResolvedValue(null)
  editShift.mockReset().mockResolvedValue({ ok: true, shift: { _id: 'shift-1', staffId: 'john', staffName: 'John Reyes', ...times, editedAt: '2026-10-15T12:00:00.000Z' } })
  deleteShift.mockReset().mockResolvedValue(true)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('PATCH /api/timeclock/shifts/[id]', () => {
  it('saves a manager’s fix and logs it', async () => {
    const res = await patch('shift-1', times)
    expect(res.status).toBe(200)
    expect(editShift).toHaveBeenCalledWith('shift-1', times)
    expect(console.info).toHaveBeenCalledWith('Shift edited', { id: 'shift-1', ...times })
  })

  it('keeps an open shift open when the time out is null', async () => {
    await patch('shift-1', { clockIn: times.clockIn, clockOut: null })
    expect(editShift).toHaveBeenCalledWith('shift-1', { clockIn: times.clockIn, clockOut: null })
  })

  it('passes on why the times were refused, such as an overlap', async () => {
    editShift.mockResolvedValue({ ok: false, problem: 'invalid', message: 'That overlaps their shift from Thu, Oct 15, 4:00 PM.' })
    const res = await patch('shift-1', times)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('That overlaps their shift from Thu, Oct 15, 4:00 PM.')
  })

  it('answers 404 for a deleted shift and 409 for one changed on another device', async () => {
    editShift.mockResolvedValueOnce({ ok: false, problem: 'gone' }).mockResolvedValueOnce({ ok: false, problem: 'changed' })
    expect((await patch('shift-1', times)).status).toBe(404)
    expect((await patch('shift-1', times)).status).toBe(409)
  })

  it('refuses times that are missing or not UTC, a bad id, and a body that is not JSON', async () => {
    for (const body of [{}, { clockIn: times.clockIn }, { clockIn: '2026-10-15 09:00', clockOut: null }, { clockIn: times.clockIn, clockOut: 'later' }, 'not json']) {
      expect((await patch('shift-1', body)).status).toBe(400)
    }
    expect((await patch('drafts.shift-1', times)).status).toBe(400)
    expect(editShift).not.toHaveBeenCalled()
  })

  it('needs the POS session', async () => {
    requirePosAuth.mockResolvedValue(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    expect((await patch('shift-1', times)).status).toBe(401)
    expect(editShift).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/timeclock/shifts/[id]', () => {
  it('deletes the shift, and says when it was gone already', async () => {
    expect((await remove('shift-1')).status).toBe(200)
    expect(deleteShift).toHaveBeenCalledWith('shift-1')
    deleteShift.mockResolvedValue(false)
    expect((await remove('shift-1')).status).toBe(404)
  })

  it('refuses an id that is not a document id', async () => {
    expect((await remove('drafts.shift-1')).status).toBe(400)
    expect(deleteShift).not.toHaveBeenCalled()
  })
})
