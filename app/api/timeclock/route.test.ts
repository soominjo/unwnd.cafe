import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { requirePosAuth, fetchBoard, fetchShifts } = vi.hoisted(() => ({ requirePosAuth: vi.fn(), fetchBoard: vi.fn(), fetchShifts: vi.fn() }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/lib/timeclock/store', () => ({ fetchBoard, fetchShifts }))

import { GET } from './route'
import { config } from '@/proxy'

const get = (query = '') => GET(new NextRequest(`http://pos.test/api/timeclock${query}`))
const WEEK = '?from=2026-10-11T16:00:00.000Z&to=2026-10-18T16:00:00.000Z'

beforeEach(() => {
  requirePosAuth.mockReset().mockResolvedValue(null)
  fetchBoard.mockReset().mockResolvedValue([])
  fetchShifts.mockReset().mockResolvedValue([])
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/timeclock', () => {
  it('gives the staff on the time clock and everyone’s shifts in the range', async () => {
    fetchBoard.mockResolvedValue([{ staffId: 'john', name: 'John Reyes', hasPin: true, openShift: null }])
    const res = await get(WEEK)
    expect(res.status).toBe(200)
    expect(fetchShifts).toHaveBeenCalledWith('2026-10-11T16:00:00.000Z', '2026-10-18T16:00:00.000Z')
    expect((await res.json()).data.board).toHaveLength(1)
  })

  it('gives only the staff list when no range is asked for, as the header count needs', async () => {
    const res = await get()
    expect((await res.json()).data).toEqual({ board: [], shifts: [] })
    expect(fetchShifts).not.toHaveBeenCalled()
  })

  it('refuses a range that is half there, backwards, not UTC, impossible or longer than two months', async () => {
    const queries = [
      '?from=2026-10-11T16:00:00Z',
      '?from=2026-10-18T16:00:00Z&to=2026-10-11T16:00:00Z',
      '?from=2026-10-11&to=2026-10-18',
      '?from=2026-10-11T25:00:00Z&to=2026-10-18T16:00:00Z',
      '?from=2026-01-01T00:00:00Z&to=2026-10-01T00:00:00Z',
    ]
    for (const query of queries) expect((await get(query)).status).toBe(400)
    expect(fetchShifts).not.toHaveBeenCalled()
  })

  it('needs the POS session', async () => {
    requirePosAuth.mockResolvedValue(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    expect((await get(WEEK)).status).toBe(401)
    expect(fetchBoard).not.toHaveBeenCalled()
  })
})

describe('the POS login check', () => {
  it('covers the time clock routes, like the sales and loyalty ones', () => {
    expect(config.matcher).toEqual(expect.arrayContaining(['/api/timeclock', '/api/timeclock/(.+)']))
  })
})
