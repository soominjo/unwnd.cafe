import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { BoardRow, MyHours, TimeShift } from '@/lib/timeclock/rules'
import ClockView, { ClockRow, punchLine, type Punch } from './ClockView'
import { MyRecordsCard, RecordsTable } from './MyRecordsView'
import PinDialog from './PinDialog'
import TimeClockClient from './TimeClockClient'

const NOW = Date.parse('2026-10-15T04:12:05Z') // Thu, Oct 15, 12:12:05 PM in Manila
const noop = () => {}
const done = async () => null

const shift = (over: Partial<TimeShift> = {}): TimeShift => ({
  _id: 's1', staffId: 'john', staffName: 'John Reyes', clockIn: '2026-10-15T01:58:00Z', clockOut: null, editedAt: null, ...over,
})
const john: BoardRow = { staffId: 'john', name: 'John Reyes', hasPin: true, openShift: { _id: 's1', clockIn: '2026-10-15T01:58:00Z' } }
const ana: BoardRow = { staffId: 'ana', name: 'Ana Cruz', hasPin: true, openShift: null }
const row = (r: BoardRow) => renderToStaticMarkup(<ClockRow row={r} now={NOW} onTap={noop} />)

describe('the Time clock page', () => {
  it('opens on Clock in or out, with My records beside it and the way back to the POS', () => {
    const html = renderToStaticMarkup(<TimeClockClient />)
    expect(html).toContain('unwnd. time clock')
    expect(html).toContain('href="/pos"')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Clock in or out</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>My records</)
  })

  it('waits for the staff list, with the tip for arriving together', () => {
    const html = renderToStaticMarkup(<ClockView now={NOW} />)
    expect(html).toContain('animate-pulse')
    expect(html).toContain('Thursday, October 15')
    expect(html).toContain('12:12:05 PM')
    expect(html).toContain('Arriving together? Each person taps their own button and enters their own PIN, one after the other.')
  })
})

describe('Clock in or out', () => {
  it('shows someone off the clock with Clock in', () => {
    const html = row(ana)
    expect(html).toContain('Ana Cruz')
    expect(html).toContain('Off the clock')
    expect(html).toContain('>Clock in</button>')
  })

  it('shows someone on shift with a running timer and Clock out', () => {
    const html = row(john)
    expect(html).toContain('On shift since 9:58 AM')
    expect(html).toContain('2:14:05')
    expect(html).toContain('>Clock out</button>')
    expect(html).not.toContain('Clock in')
  })

  it('keeps Clock in off for someone with no PIN yet, and says why', () => {
    const html = row({ ...ana, hasPin: false })
    expect(html).toContain('No PIN yet · ask the manager')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Clock in<\/button>/)
  })

  it('flags a shift still open from yesterday and says what to do', () => {
    const html = row({ ...john, openShift: { _id: 'old', clockIn: '2026-10-14T01:51:00Z' } })
    expect(html).toContain('Clocked in since yesterday, 9:51 AM. Clock out now, then ask the manager to set the real time out.')
  })

  it('keeps quiet about a closing shift still running after midnight', () => {
    const closing = { ...john, openShift: { _id: 'fri', clockIn: '2026-10-16T08:50:00Z' } } // Fri, Oct 16, 4:50 PM in Manila
    const html = renderToStaticMarkup(<ClockRow row={closing} now={Date.parse('2026-10-16T16:30:00Z')} onTap={noop} />) // Sat 12:30 AM
    expect(html).toContain('On shift since yesterday, 4:50 PM')
    expect(html).not.toContain('ask the manager')
  })

  it('asks for the PIN of the person tapped', () => {
    const html = renderToStaticMarkup(<PinDialog title="Clock in" name="Ana Cruz" note="Enter your PIN to clock in." onPin={done} onClose={noop} />)
    expect(html).toContain('Clock in')
    expect(html).toContain('Ana Cruz')
    expect(html).toContain('Enter your PIN to clock in.')
    expect(html.match(/data-pin-dot/g)).toHaveLength(4)
    expect(html).toContain('aria-label="Close"')
  })

  it('says who clocked in or out, and when, including a repeat', () => {
    const punch = (over: Partial<Punch> = {}): Punch => ({ action: 'in', name: 'John Reyes', shift: shift(), repeat: false, ...over })
    expect(punchLine(punch())).toBe('John Reyes clocked in at 9:58 AM.')
    expect(punchLine(punch({ repeat: true }))).toBe('John Reyes was already clocked in, since 9:58 AM.')
    const out = shift({ clockOut: '2026-10-15T10:02:00Z' })
    expect(punchLine(punch({ action: 'out', shift: out }))).toBe('John Reyes clocked out at 6:02 PM · 8h 04m on this shift.')
    expect(punchLine(punch({ action: 'out', shift: out, repeat: true }))).toBe('John Reyes already clocked out at 6:02 PM · 8h 04m on this shift.')
  })
})

describe('My records', () => {
  const records: MyHours = {
    name: 'John Reyes',
    openShift: { _id: 's1', clockIn: '2026-10-15T01:58:00Z' },
    shifts: [
      shift(),
      shift({ _id: 's3', clockIn: '2026-10-13T23:43:00Z', clockOut: '2026-10-14T07:46:00Z', editedAt: '2026-10-14T12:00:00Z' }),
      shift({ _id: 's2', clockIn: '2026-10-11T23:45:00Z', clockOut: '2026-10-12T07:44:00Z' }),
    ],
  }
  const card = (over: Partial<Parameters<typeof MyRecordsCard>[0]> = {}) =>
    renderToStaticMarkup(<MyRecordsCard records={records} period="week" now={NOW} error={null} onPeriod={noop} onDone={noop} {...over} />)

  it('lists each shift on one line, oldest first: the date, time in – time out, and the hours', () => {
    const html = renderToStaticMarkup(<RecordsTable shifts={records.shifts} now={NOW} />)
    expect(html).toContain('>Date<')
    expect(html).toContain('Time in – Time out')
    expect(html).toContain('Total hours')
    const at = (text: string) => html.indexOf(text)
    expect(at('Monday, October 12')).toBeGreaterThan(-1)
    expect(at('Monday, October 12')).toBeLessThan(at('Wednesday, October 14'))
    expect(at('Wednesday, October 14')).toBeLessThan(at('Thursday, October 15'))
    expect(html).toContain('7:45 AM – ')
    expect(html).toContain('3:44 PM')
    expect(html).toContain('7h 59m')
    expect(html).toContain('>Edited</span>')
    expect(html).toContain('on shift')
  })

  it('totals the shifts at the foot', () => {
    const html = renderToStaticMarkup(<RecordsTable shifts={records.shifts} now={NOW} />)
    expect(html).toContain('Total · 3 shifts')
    expect(html).toContain('18h 16m')
  })

  it('shows the person and their running shift, with nothing to edit', () => {
    const html = card()
    expect(html).toContain('John Reyes')
    expect(html).toContain('On shift since 9:58 AM')
    expect(html).toContain('2:14:05')
    expect(html).not.toContain('>Edit</button>')
    expect(html).not.toContain('>Delete</button>')
    expect(html).toContain('>Done</button>')
  })

  it('shows the period picked, why another could not be read, and an empty period', () => {
    const html = card({ period: 'lastweek', error: 'Incorrect PIN. Try again.' })
    expect(html).toMatch(/aria-pressed="true"[^>]*>Last week</)
    expect(html).toContain('Mon, Oct 5 – Sun, Oct 11')
    expect(html).toContain('Incorrect PIN. Try again.')
    expect(card({ records: { name: 'Ana Cruz', openShift: null, shifts: [] } })).toContain('No shifts in this period.')
  })
})
