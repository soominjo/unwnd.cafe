import { describe, it, expect, vi } from 'vitest'
import { TIME_CLOCK_MESSAGES, readMyHours, readTimeClock, sendTimeClock } from './sendTimeClock'

const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe('sendTimeClock', () => {
  it('sends the change as JSON and gives back the saved data', async () => {
    const fetchImpl = reply(201, { success: true, data: { _id: 'shift-1' } })
    const result = await sendTimeClock('/api/timeclock', 'POST', { staffId: 'john', action: 'in' }, fetchImpl)
    expect(result).toEqual({ message: null, data: { _id: 'shift-1' } })
    expect(fetchImpl).toHaveBeenCalledWith('/api/timeclock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"staffId":"john","action":"in"}',
    })
  })

  it('shows the route’s own reason, such as someone already clocked in', async () => {
    const result = await sendTimeClock('/api/timeclock', 'POST', {}, reply(409, { success: false, error: 'John Reyes is already clocked in.' }))
    expect(result).toEqual({ message: 'John Reyes is already clocked in.' })
  })

  it('marks a 404 as gone, so a shift deleted elsewhere counts as deleted', async () => {
    const result = await sendTimeClock('/api/timeclock/shifts/s1', 'DELETE', undefined, reply(404, { success: false, error: 'That shift was deleted already.' }))
    expect(result).toEqual({ message: 'That shift was deleted already.', gone: true })
  })

  it('says signed out on a 401, unsure when no reply came, and failed on a stranger’s reply', async () => {
    expect(await sendTimeClock('/x', 'DELETE', undefined, reply(401, {}))).toEqual({ message: TIME_CLOCK_MESSAGES.signedOut })
    const offline = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    expect(await sendTimeClock('/x', 'DELETE', undefined, offline)).toEqual({ message: TIME_CLOCK_MESSAGES.noReply, unsure: true })
    const gateway = vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 }))
    expect(await sendTimeClock('/x', 'DELETE', undefined, gateway)).toEqual({ message: TIME_CLOCK_MESSAGES.failed })
  })
})

describe('readMyHours', () => {
  it('sends the PIN in the body, never in the URL', async () => {
    const fetchImpl = reply(200, { success: true, data: { name: 'John Reyes', openShift: null, shifts: [] } })
    const result = await readMyHours('2222', { from: '2026-10-11T16:00:00.000Z', to: '2026-10-18T16:00:00.000Z' }, fetchImpl)
    expect(result).toEqual({ message: null, data: { name: 'John Reyes', openShift: null, shifts: [] } })
    expect(fetchImpl).toHaveBeenCalledWith('/api/timeclock/mine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"pin":"2222","from":"2026-10-11T16:00:00.000Z","to":"2026-10-18T16:00:00.000Z"}',
    })
  })
})

describe('readTimeClock', () => {
  const data = { board: [{ staffId: 'john', name: 'John Reyes', openShift: null }], shifts: [] }

  it('reads the staff and the shifts in the range', async () => {
    const fetchImpl = reply(200, { success: true, data })
    expect(await readTimeClock({ from: '2026-10-04T16:00:00.000Z', to: '2026-10-18T16:00:00.000Z' }, fetchImpl)).toEqual(data)
    expect((fetchImpl.mock.calls[0] as unknown[])[0]).toBe('/api/timeclock?from=2026-10-04T16%3A00%3A00.000Z&to=2026-10-18T16%3A00%3A00.000Z')
  })

  it('reads the staff alone when no range is given', async () => {
    const fetchImpl = reply(200, { success: true, data })
    await readTimeClock(undefined, fetchImpl)
    expect((fetchImpl.mock.calls[0] as unknown[])[0]).toBe('/api/timeclock')
  })

  it('gives null, never throws, when the read fails or the reply is not the time clock', async () => {
    expect(await readTimeClock(undefined, reply(500, { success: false }))).toBeNull()
    expect(await readTimeClock(undefined, reply(200, { success: true, data: { board: 'x' } }))).toBeNull()
    expect(await readTimeClock(undefined, vi.fn(async () => { throw new TypeError('Failed to fetch') }))).toBeNull()
  })
})
