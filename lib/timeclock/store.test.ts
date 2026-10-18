import { describe, it, expect, vi, beforeEach } from 'vitest'

const { read, create, remove, patch } = vi.hoisted(() => ({ read: vi.fn(), create: vi.fn(), remove: vi.fn(), patch: vi.fn() }))
vi.mock('@/sanity/lib/client', () => ({ client: { withConfig: () => ({ fetch: read }) } }))
vi.mock('@/sanity/lib/writeClient', () => ({ getWriteClient: () => ({ create, delete: remove, patch }) }))

import { REPEAT_WINDOW_MS, addStaff, deleteShift, editShift, fetchBoard, fetchMine, fetchShifts, punch, removeStaff, setStaffPin } from './store'

const NOW = new Date('2026-10-15T10:02:00.000Z') // 6:02 PM in Manila
const later = (ms: number) => new Date(NOW.getTime() + ms)

// A Sanity patch that records what it was given, then commits to `result` (or throws it).
function patchChain(result: unknown) {
  const chain = {
    ifRevisionId: vi.fn(() => chain),
    set: vi.fn(() => chain),
    commit: vi.fn(async () => {
      if (result instanceof Error) throw result
      return result
    }),
  }
  return chain
}
const conflict = () => Object.assign(new Error('Document has unexpected revision ID'), { statusCode: 409 })

const shift = (over: Record<string, unknown> = {}) => ({
  _id: 'shift-1', staffId: 'john', staffName: 'John Reyes', clockIn: '2026-10-14T23:44:00.000Z', clockOut: null, editedAt: null, ...over,
})
const off = { staffId: 'john', name: 'John Reyes', pinMatches: true, openShift: null, lastShift: shift({ clockOut: '2026-10-14T07:46:00.000Z' }) }
const onShift = { staffId: 'john', name: 'John Reyes', pinMatches: true, openShift: { ...shift(), _rev: 'rev-1' }, lastShift: null }

beforeEach(() => {
  read.mockReset()
  create.mockReset().mockImplementation(async (doc: Record<string, unknown>) => ({ ...doc, _id: 'new-id' }))
  remove.mockReset()
  patch.mockReset()
})

describe('punch', () => {
  it('checks the PIN against the person tapped, inside the query, never reading a fingerprint back', async () => {
    read.mockResolvedValueOnce(off)
    await punch('john', 'pin-hash', 'in', NOW)
    expect(read.mock.calls[0][1]).toEqual({ id: 'john', pinHash: 'pin-hash' })
    expect(read.mock.calls[0][0]).toContain('active != false')
    expect(read.mock.calls[0][0]).toContain('"pinMatches": defined(pinHash) && pinHash == $pinHash')
    expect(read.mock.calls[0][0]).not.toMatch(/[{,]\s*pinHash\s*[,}]/)
  })

  it('clocks someone in at the server’s time, under the name they have now', async () => {
    read.mockResolvedValueOnce(off)
    const result = await punch('john', 'pin-hash', 'in', NOW)
    expect(create).toHaveBeenCalledWith({ _type: 'timeShift', staffId: 'john', staffName: 'John Reyes', clockIn: '2026-10-15T10:02:00.000Z' })
    expect(result).toEqual({
      ok: true, action: 'in', name: 'John Reyes', repeat: false,
      shift: { _id: 'new-id', staffId: 'john', staffName: 'John Reyes', clockIn: '2026-10-15T10:02:00.000Z', clockOut: null, editedAt: null },
    })
  })

  it('clocks someone out at the revision it read', async () => {
    read.mockResolvedValueOnce(onShift)
    const chain = patchChain({ ...shift(), clockOut: '2026-10-15T10:02:00.000Z' })
    patch.mockReturnValue(chain)
    const result = await punch('john', 'pin-hash', 'out', NOW)
    expect(patch).toHaveBeenCalledWith('shift-1')
    expect(chain.ifRevisionId).toHaveBeenCalledWith('rev-1')
    expect(chain.set).toHaveBeenCalledWith({ clockOut: '2026-10-15T10:02:00.000Z' })
    expect(result).toMatchObject({ ok: true, action: 'out', repeat: false, shift: { clockOut: '2026-10-15T10:02:00.000Z' } })
  })

  it('refuses a PIN that is not that person’s, and says when they are not on the time clock', async () => {
    read.mockResolvedValueOnce({ ...off, pinMatches: false })
    expect(await punch('john', 'ana-hash', 'in', NOW)).toEqual({ ok: false, problem: 'wrong-pin' })
    read.mockResolvedValueOnce(null)
    expect(await punch('gone', 'pin-hash', 'in', NOW)).toEqual({ ok: false, problem: 'no-staff' })
    expect(create).not.toHaveBeenCalled()
  })

  it('answers a second Clock in with the shift already open, starting nothing', async () => {
    read.mockResolvedValueOnce(onShift)
    const result = await punch('john', 'pin-hash', 'in', NOW)
    expect(result).toEqual({ ok: true, action: 'in', name: 'John Reyes', shift: shift(), repeat: true })
    expect(create).not.toHaveBeenCalled()
  })

  it('repeats a Clock out within a minute, and refuses one for someone not clocked in', async () => {
    const justOut = { ...off, lastShift: shift({ clockOut: NOW.toISOString() }) }
    read.mockResolvedValueOnce(justOut)
    expect(await punch('john', 'pin-hash', 'out', later(30 * 1000))).toMatchObject({ ok: true, action: 'out', repeat: true })
    read.mockResolvedValueOnce(justOut)
    expect(await punch('john', 'pin-hash', 'out', later(REPEAT_WINDOW_MS))).toEqual({ ok: false, problem: 'not-in', name: 'John Reyes' })
    expect(patch).not.toHaveBeenCalled()
  })

  it('clocks two people in at the same moment, each into their own shift', async () => {
    read.mockImplementation(async (_query: string, params: { id: string }) => ({
      ...off, staffId: params.id, name: params.id === 'john' ? 'John Reyes' : 'Ana Cruz', lastShift: null,
    }))
    const results = await Promise.all([punch('john', 'john-hash', 'in', NOW), punch('ana', 'ana-hash', 'in', NOW)])
    expect(create).toHaveBeenCalledTimes(2)
    expect(results.map(result => result.ok && result.name)).toEqual(['John Reyes', 'Ana Cruz'])
  })

  it('says when another clock-out landed first', async () => {
    read.mockResolvedValueOnce(onShift)
    patch.mockReturnValue(patchChain(conflict()))
    expect(await punch('john', 'pin-hash', 'out', NOW)).toEqual({ ok: false, problem: 'changed' })
  })
})

describe('reads', () => {
  it('lists the people on the time clock with whether they have a PIN, never the PIN', async () => {
    read.mockResolvedValueOnce([])
    await fetchBoard()
    expect(read.mock.calls[0][0]).toContain('"hasPin": defined(pinHash)')
    expect(read.mock.calls[0][0]).not.toMatch(/[{,]\s*pinHash\s*[,}]/)
  })

  it('reads everyone’s shifts in a range, and one person’s own by PIN', async () => {
    read.mockResolvedValueOnce([]).mockResolvedValueOnce({ name: 'John Reyes', openShift: null, shifts: [] })
    await fetchShifts('2026-10-11T16:00:00.000Z', '2026-10-18T16:00:00.000Z')
    expect(read.mock.calls[0][1]).toEqual({ from: '2026-10-11T16:00:00.000Z', to: '2026-10-18T16:00:00.000Z' })
    expect(await fetchMine('pin-hash', '2026-10-11T16:00:00.000Z', '2026-10-18T16:00:00.000Z')).toEqual({ name: 'John Reyes', openShift: null, shifts: [] })
    expect(read.mock.calls[1][1]).toEqual({ pinHash: 'pin-hash', from: '2026-10-11T16:00:00.000Z', to: '2026-10-18T16:00:00.000Z' })
  })
})

describe('editShift', () => {
  const stored = { ...shift(), _rev: 'rev-4' }
  const LATER = new Date('2026-10-15T12:00:00.000Z') // 8:00 PM in Manila
  const fixed = { clockIn: '2026-10-14T23:44:00.000Z', clockOut: '2026-10-15T07:46:00.000Z' }

  it('sets the times, marks the shift edited and saves it at the revision read', async () => {
    read.mockResolvedValueOnce(stored).mockResolvedValueOnce([])
    const chain = patchChain({ ...stored, ...fixed, editedAt: LATER.toISOString() })
    patch.mockReturnValue(chain)
    const result = await editShift('shift-1', fixed, LATER)
    expect(chain.ifRevisionId).toHaveBeenCalledWith('rev-4')
    expect(chain.set).toHaveBeenCalledWith({ ...fixed, editedAt: '2026-10-15T12:00:00.000Z' })
    expect(result.ok && result.shift.editedAt).toBe('2026-10-15T12:00:00.000Z')
  })

  it('refuses times that overlap another of their shifts, before writing anything', async () => {
    read.mockResolvedValueOnce(stored).mockResolvedValueOnce([{ clockIn: '2026-10-15T08:00:00.000Z', clockOut: '2026-10-15T09:00:00.000Z' }])
    const result = await editShift('shift-1', { clockIn: '2026-10-14T23:44:00.000Z', clockOut: '2026-10-15T08:30:00.000Z' }, LATER)
    expect(result).toEqual({ ok: false, problem: 'invalid', message: 'That overlaps their shift from Thu, Oct 15, 4:00 PM.' })
    expect(patch).not.toHaveBeenCalled()
  })

  it('says when the shift is gone, or changed on another device since it was read', async () => {
    read.mockResolvedValueOnce(null)
    expect(await editShift('shift-1', fixed, LATER)).toEqual({ ok: false, problem: 'gone' })
    read.mockResolvedValueOnce(stored).mockResolvedValueOnce([])
    patch.mockReturnValue(patchChain(conflict()))
    expect(await editShift('shift-1', fixed, LATER)).toEqual({ ok: false, problem: 'changed' })
  })
})

describe('deleteShift', () => {
  it('deletes shifts only, and says when there was none', async () => {
    remove.mockResolvedValueOnce({ results: [{ id: 'shift-1' }] }).mockResolvedValueOnce({ results: [] })
    expect(await deleteShift('shift-1')).toBe(true)
    expect(remove.mock.calls[0][0]).toEqual({ query: '*[_type == "timeShift" && _id == $id]', params: { id: 'shift-1' } })
    expect(await deleteShift('a-sale')).toBe(false)
  })
})

describe('the staff list', () => {
  it('adds a name, cleaned up, with its PIN’s fingerprint', async () => {
    read.mockResolvedValueOnce({ name: 0, pin: 0 })
    expect(await addStaff('  Ana   Cruz ', 'ana-hash')).toEqual({ ok: true, row: { staffId: 'new-id', name: 'Ana Cruz', hasPin: true, openShift: null } })
    expect(create).toHaveBeenCalledWith({ _type: 'staffMember', name: 'Ana Cruz', active: true, pinHash: 'ana-hash' })
  })

  it('refuses a name or a PIN someone on the time clock has already', async () => {
    read.mockResolvedValueOnce({ name: 1, pin: 0 }).mockResolvedValueOnce({ name: 0, pin: 1 })
    expect(await addStaff('Ana Cruz', 'ana-hash')).toEqual({ ok: false, problem: 'duplicate' })
    expect(await addStaff('Ana Santos', 'john-hash')).toEqual({ ok: false, problem: 'pin-taken' })
    expect(create).not.toHaveBeenCalled()
  })

  it('changes a PIN, unless someone else has it or the person was removed', async () => {
    const chain = patchChain({})
    patch.mockReturnValue(chain)
    read.mockResolvedValueOnce({ name: 'Ana Cruz', taken: 0 })
    expect(await setStaffPin('ana', 'new-hash')).toEqual({ ok: true, name: 'Ana Cruz' })
    expect(patch).toHaveBeenCalledWith('ana')
    expect(chain.set).toHaveBeenCalledWith({ pinHash: 'new-hash' })
    read.mockResolvedValueOnce({ name: 'Ana Cruz', taken: 1 }).mockResolvedValueOnce({ name: null, taken: 0 })
    expect(await setStaffPin('ana', 'john-hash')).toEqual({ ok: false, problem: 'pin-taken' })
    expect(await setStaffPin('gone', 'new-hash')).toEqual({ ok: false, problem: 'gone' })
  })

  it('takes someone off the time clock and keeps their document, unless they are on shift', async () => {
    const chain = patchChain({})
    patch.mockReturnValue(chain)
    read.mockResolvedValueOnce({ staffId: 'john', name: 'John Reyes', hasPin: true, openShift: null })
    expect(await removeStaff('john')).toEqual({ ok: true, name: 'John Reyes' })
    expect(chain.set).toHaveBeenCalledWith({ active: false })
    read.mockResolvedValueOnce({ staffId: 'john', name: 'John Reyes', hasPin: true, openShift: { _id: 's', clockIn: NOW.toISOString() } })
    expect(await removeStaff('john')).toEqual({ ok: false, problem: 'on-shift', name: 'John Reyes' })
    read.mockResolvedValueOnce(null)
    expect(await removeStaff('john')).toEqual({ ok: false, problem: 'gone' })
  })
})
