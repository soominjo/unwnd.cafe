import { describe, it, expect } from 'vitest'
import {
  formatClock,
  formatDay,
  formatEnd,
  formatHours,
  formatLongDay,
  formatSince,
  formatTimer,
  fromManilaInput,
  manilaDayKey,
  manilaWeekStart,
  periodRange,
  toManilaInput,
} from './time'

const at = (iso: string) => Date.parse(iso)
const NOW = at('2026-10-15T15:00:00Z') // Thu, Oct 15, 2026, 11:00 PM in Manila

describe('weeks and periods, in Manila time', () => {
  it('starts the week on Monday 12:00 AM Manila, which is Sunday 4:00 PM UTC', () => {
    expect(new Date(manilaWeekStart(NOW)).toISOString()).toBe('2026-10-11T16:00:00.000Z')
  })

  it('puts Monday 12:30 AM Manila in the new week, though it is still Sunday in UTC', () => {
    expect(new Date(manilaWeekStart(at('2026-10-18T16:30:00Z'))).toISOString()).toBe('2026-10-18T16:00:00.000Z')
  })

  it('keeps Sunday 11:59 PM Manila in the old week', () => {
    expect(new Date(manilaWeekStart(at('2026-10-18T15:59:00Z'))).toISOString()).toBe('2026-10-11T16:00:00.000Z')
  })

  it('gives this week, last week, this month and last month as UTC ranges', () => {
    expect(periodRange('week', NOW)).toEqual({ from: '2026-10-11T16:00:00.000Z', to: '2026-10-18T16:00:00.000Z' })
    expect(periodRange('lastweek', NOW)).toEqual({ from: '2026-10-04T16:00:00.000Z', to: '2026-10-11T16:00:00.000Z' })
    expect(periodRange('month', NOW)).toEqual({ from: '2026-09-30T16:00:00.000Z', to: '2026-10-31T16:00:00.000Z' })
    expect(periodRange('lastmonth', NOW)).toEqual({ from: '2026-08-31T16:00:00.000Z', to: '2026-09-30T16:00:00.000Z' })
  })

  it('counts Nov 1, 12:10 AM Manila as November, not October', () => {
    expect(periodRange('month', at('2026-10-31T16:10:00Z')).from).toBe('2026-10-31T16:00:00.000Z')
  })
})

describe('days and times as staff read them', () => {
  it('names the Manila day an instant falls on', () => {
    expect(manilaDayKey('2026-10-15T15:59:00Z')).toBe('2026-10-15')
    expect(manilaDayKey('2026-10-15T16:00:00Z')).toBe('2026-10-16')
    expect(manilaDayKey(NOW)).toBe('2026-10-15')
  })

  it('writes times and days the way the POS does', () => {
    expect(formatClock('2026-10-15T01:58:00Z')).toBe('9:58 AM')
    expect(formatDay('2026-10-15T01:58:00Z')).toBe('Thu, Oct 15')
    expect(formatLongDay('2026-10-15T01:58:00Z')).toBe('Thursday, October 15')
  })

  it('says when a shift began: today, yesterday, or an earlier day', () => {
    expect(formatSince('2026-10-15T01:58:00Z', NOW)).toBe('9:58 AM')
    expect(formatSince('2026-10-14T01:51:00Z', NOW)).toBe('yesterday, 9:51 AM')
    expect(formatSince('2026-10-13T01:51:00Z', NOW)).toBe('Tue, Oct 13, 9:51 AM')
  })

  it('adds the day to a time out on a later day than the time in', () => {
    expect(formatEnd('2026-10-15T10:03:00Z', '2026-10-15T01:51:00Z')).toBe('6:03 PM')
    expect(formatEnd('2026-10-15T16:30:00Z', '2026-10-15T10:00:00Z')).toBe('Fri, Oct 16, 12:30 AM')
  })

  it('writes hours as hours and minutes, rounded down to the minute', () => {
    expect(formatHours(8 * 3600e3 + 4 * 60e3 + 59e3)).toBe('8h 04m')
    expect(formatHours(42 * 60e3)).toBe('42m')
    expect(formatHours(-5)).toBe('0m')
  })

  it('runs the timer in hours, minutes and seconds, past 24 hours too', () => {
    expect(formatTimer(2 * 3600e3 + 14 * 60e3 + 5e3)).toBe('2:14:05')
    expect(formatTimer(26 * 3600e3)).toBe('26:00:00')
  })
})

describe('the date and time fields of the shift editor', () => {
  it('shows an instant in Manila time and reads it back', () => {
    expect(toManilaInput('2026-10-15T01:58:00.000Z')).toBe('2026-10-15T09:58')
    expect(fromManilaInput('2026-10-15T09:58')).toBe('2026-10-15T01:58:00.000Z')
    expect(fromManilaInput('2026-10-15T09:58:30')).toBe('2026-10-15T01:58:00.000Z')
  })

  it('refuses a value that is not a whole, real date and time', () => {
    expect(fromManilaInput('')).toBeNull()
    expect(fromManilaInput('2026-10-15')).toBeNull()
    expect(fromManilaInput('2026-02-30T09:00')).toBeNull()
    expect(fromManilaInput('2026-10-15T24:00')).toBeNull()
  })
})
