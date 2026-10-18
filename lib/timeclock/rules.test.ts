import { describe, it, expect } from 'vitest'
import { PIN_LENGTH } from '@/app/pos/PinPad'
import {
  MAX_SHIFT_MS,
  STAFF_PIN_LENGTH,
  cleanStaffName,
  countOnShift,
  groupByDay,
  isDocId,
  isStaffPin,
  readInstant,
  readRange,
  shiftMs,
  shiftTimesProblem,
  staffNameProblem,
  staffPinProblem,
  startedBeforeToday,
  totalsByStaff,
  type TimeShift,
} from './rules'

const NOW = Date.parse('2026-10-15T15:00:00Z') // Thu, Oct 15, 11:00 PM in Manila

const shift = (id: string, staffId: string, clockIn: string, clockOut: string | null, staffName = staffId): TimeShift => ({
  _id: id, staffId, staffName, clockIn, clockOut, editedAt: null,
})

describe('what the routes accept', () => {
  it('takes document ids the POS creates, never a draft or a path', () => {
    expect(isDocId('kq3Fz9_x-1')).toBe(true)
    expect(isDocId('drafts.john')).toBe(false)
    expect(isDocId('../sales')).toBe(false)
    expect(isDocId(42)).toBe(false)
  })

  it('reads a UTC instant and stores it the way toISOString writes it', () => {
    expect(readInstant('2026-10-15T01:58Z')).toBe('2026-10-15T01:58:00.000Z')
    expect(readInstant('2026-10-15T01:58:00.000Z')).toBe('2026-10-15T01:58:00.000Z')
    expect(readInstant('2026-10-15T09:58:00+08:00')).toBeNull()
    expect(readInstant('2026-10-15T25:00:00Z')).toBeNull()
    expect(readInstant(null)).toBeNull()
  })

  it('reads a range of at most two months, from before to', () => {
    expect(readRange('2026-10-11T16:00:00Z', '2026-10-18T16:00:00Z')).toEqual({ from: '2026-10-11T16:00:00.000Z', to: '2026-10-18T16:00:00.000Z' })
    expect(readRange('2026-10-18T16:00:00Z', '2026-10-11T16:00:00Z')).toBeNull()
    expect(readRange('2026-01-01T00:00:00Z', '2026-10-01T00:00:00Z')).toBeNull()
    expect(readRange('2026-10-11', '2026-10-18')).toBeNull()
    expect(readRange(undefined, '2026-10-18T16:00:00Z')).toBeNull()
  })
})

describe('staff PINs', () => {
  it('are as long as the POS PIN pad takes', () => {
    expect(STAFF_PIN_LENGTH).toBe(PIN_LENGTH)
  })

  it('are exactly four digits', () => {
    expect(isStaffPin('0427')).toBe(true)
    expect(staffPinProblem('0427')).toBeNull()
    for (const pin of ['427', '04271', '04a7', ' 0427', '']) expect(staffPinProblem(pin)).toBe('A PIN is 4 digits.')
    expect(isStaffPin(427)).toBe(false)
  })
})

describe('staff names', () => {
  it('saves a name trimmed, with single spaces', () => {
    expect(cleanStaffName('  John   Reyes ')).toBe('John Reyes')
  })

  it('takes 2 to 60 letters, numbers and simple punctuation, with at least one letter', () => {
    expect(staffNameProblem('Ana Cruz')).toBeNull()
    expect(staffNameProblem("Ma. Lourdes O'Neil-Santos")).toBeNull()
    expect(staffNameProblem('A')).toBe('Enter a name: 2 to 60 characters.')
    expect(staffNameProblem('x'.repeat(61))).toBe('Enter a name: 2 to 60 characters.')
    expect(staffNameProblem('John ←')).toBe('Use letters, numbers and simple punctuation only.')
    expect(staffNameProblem('123')).toBe('Use letters, numbers and simple punctuation only.')
  })
})

describe('who is on shift, and for how long', () => {
  it('counts an open shift up to now and a closed one to its time out', () => {
    expect(shiftMs({ clockIn: '2026-10-15T13:00:00Z', clockOut: null }, NOW)).toBe(2 * 3600e3)
    expect(shiftMs({ clockIn: '2026-10-15T01:00:00Z', clockOut: '2026-10-15T09:04:00Z' }, NOW)).toBe(8 * 3600e3 + 4 * 60e3)
  })

  it('counts the people on shift, for the header', () => {
    expect(countOnShift([
      { staffId: 'a', name: 'Ana Cruz', hasPin: true, openShift: { _id: 's1', clockIn: '2026-10-15T13:00:00Z' } },
      { staffId: 'j', name: 'John Reyes', hasPin: true, openShift: null },
    ])).toBe(1)
  })

  it('flags a shift begun on an earlier café day as a forgotten clock-out', () => {
    expect(startedBeforeToday('2026-10-14T01:51:00Z', NOW)).toBe(true)
    // 5:30 AM in Manila today is today, though it was yesterday in UTC.
    expect(startedBeforeToday('2026-10-14T21:30:00Z', NOW)).toBe(false)
  })

  it('keeps a closing shift that runs past midnight as tonight’s, until the café day turns over at 5:00 AM', () => {
    const fridayEvening = '2026-10-16T08:50:00Z' // Fri, Oct 16, 4:50 PM in Manila
    expect(startedBeforeToday(fridayEvening, Date.parse('2026-10-16T16:30:00Z'))).toBe(false) // Sat 12:30 AM
    expect(startedBeforeToday(fridayEvening, Date.parse('2026-10-16T20:59:00Z'))).toBe(false) // Sat 4:59 AM
    expect(startedBeforeToday(fridayEvening, Date.parse('2026-10-16T21:00:00Z'))).toBe(true) // Sat 5:00 AM
  })
})

describe('what a manager can set a shift to', () => {
  const open = { wasOpen: true, now: NOW, others: [] }
  const closed = { wasOpen: false, now: NOW, others: [] }

  it('takes an ordinary shift, and an open one left open', () => {
    expect(shiftTimesProblem({ clockIn: '2026-10-15T01:00:00Z', clockOut: '2026-10-15T09:00:00Z' }, closed)).toBeNull()
    expect(shiftTimesProblem({ clockIn: '2026-10-15T13:00:00Z', clockOut: null }, open)).toBeNull()
  })

  it('needs a time out on a shift that was already closed', () => {
    expect(shiftTimesProblem({ clockIn: '2026-10-15T01:00:00Z', clockOut: null }, closed)).toBe('Enter the time out.')
  })

  it('refuses times out of order, in the future, or more than 16 hours apart', () => {
    expect(shiftTimesProblem({ clockIn: '2026-10-15T09:00:00Z', clockOut: '2026-10-15T09:00:00Z' }, closed)).toBe('Time out must be after time in.')
    expect(shiftTimesProblem({ clockIn: '2026-10-15T16:00:00Z', clockOut: '2026-10-15T17:00:00Z' }, closed)).toBe("Time in can't be in the future.")
    expect(shiftTimesProblem({ clockIn: '2026-10-15T14:00:00Z', clockOut: '2026-10-15T15:30:00Z' }, closed)).toBe("Time out can't be in the future.")
    const longOut = new Date(Date.parse('2026-10-14T01:00:00Z') + MAX_SHIFT_MS + 60e3).toISOString()
    expect(shiftTimesProblem({ clockIn: '2026-10-14T01:00:00Z', clockOut: longOut }, closed)).toBe('A shift can be 16 hours at most. Check the dates.')
  })

  it('lets the tablet’s clock run up to a minute ahead of the server’s', () => {
    expect(shiftTimesProblem({ clockIn: '2026-10-15T14:00:00Z', clockOut: '2026-10-15T15:00:30Z' }, closed)).toBeNull()
  })

  it('refuses a shift that overlaps another of the same person’s, but not one that starts as it ends', () => {
    const others = [{ clockIn: '2026-10-14T23:38:00Z', clockOut: '2026-10-15T07:52:00Z' }]
    expect(shiftTimesProblem({ clockIn: '2026-10-15T07:00:00Z', clockOut: '2026-10-15T10:00:00Z' }, { ...closed, others }))
      .toBe('That overlaps their shift from Thu, Oct 15, 7:38 AM.')
    expect(shiftTimesProblem({ clockIn: '2026-10-15T07:52:00Z', clockOut: '2026-10-15T10:00:00Z' }, { ...closed, others })).toBeNull()
  })

  it('counts an open shift of theirs as running until now', () => {
    const others = [{ clockIn: '2026-10-15T13:00:00Z', clockOut: null }]
    expect(shiftTimesProblem({ clockIn: '2026-10-15T12:00:00Z', clockOut: '2026-10-15T14:00:00Z' }, { ...closed, others }))
      .toBe('That overlaps their shift from Thu, Oct 15, 9:00 PM.')
  })

  it('refuses a time in that is not a date', () => {
    expect(shiftTimesProblem({ clockIn: 'soon', clockOut: '2026-10-15T09:00:00Z' }, closed)).toBe('Enter the time in.')
  })
})

describe('hours per person', () => {
  const staff = [{ staffId: 'g', name: 'Genessis Contreras' }, { staffId: 'j', name: 'John Reyes' }]

  it('adds up each person’s shifts, the open one up to now, in the order of the staff list', () => {
    const totals = totalsByStaff([
      shift('1', 'j', '2026-10-15T13:00:00Z', null),
      shift('2', 'j', '2026-10-14T23:43:00Z', '2026-10-15T07:46:00Z'),
      shift('3', 'g', '2026-10-15T01:51:00Z', '2026-10-15T10:03:00Z'),
    ], staff, NOW)
    expect(totals).toEqual([
      { staffId: 'g', name: 'Genessis Contreras', ms: 8 * 3600e3 + 12 * 60e3, count: 1, openSince: null },
      { staffId: 'j', name: 'John Reyes', ms: 10 * 3600e3 + 3 * 60e3, count: 2, openSince: '2026-10-15T13:00:00Z' },
    ])
  })

  it('lists someone removed who has shifts in the period, under the name they clocked in with', () => {
    const totals = totalsByStaff([shift('4', 'gone', '2026-10-13T04:00:00Z', '2026-10-13T13:00:00Z', 'Ana Cruz')], staff, NOW)
    expect(totals.map(total => [total.name, total.count])).toEqual([['Genessis Contreras', 0], ['John Reyes', 0], ['Ana Cruz', 1]])
  })

  it('groups shifts by the Manila day they began on', () => {
    const days = groupByDay([
      shift('1', 'j', '2026-10-15T13:00:00Z', null),
      shift('2', 'g', '2026-10-14T16:30:00Z', '2026-10-15T01:00:00Z'),
      shift('3', 'g', '2026-10-14T01:51:00Z', '2026-10-14T10:03:00Z'),
    ])
    expect(days.map(day => [day.day, day.shifts.map(s => s._id)])).toEqual([['2026-10-15', ['1', '2']], ['2026-10-14', ['3']]])
  })
})
