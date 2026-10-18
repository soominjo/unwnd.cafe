import { formatClock, formatDay, manilaDayKey, type IsoRange } from './time'

// The time clock's rules, shared by the POS and the server: staff names and PINs, who is on
// shift, what a manager may change a shift to, and how the hours add up.

/** The longest shift a manager can save. A forgotten clock-out can run longer; Records flags it. */
export const MAX_SHIFT_MS = 16 * 60 * 60 * 1000
/** A time this far past the server's clock still counts as now: the tablet's clock may run a little ahead. */
export const FUTURE_SLACK_MS = 60 * 1000
/** The longest range one read covers: two months, enough for This month and Last month. */
export const MAX_RANGE_MS = 62 * 24 * 60 * 60 * 1000
export const MIN_STAFF_NAME_LENGTH = 2
export const MAX_STAFF_NAME_LENGTH = 60
/** As many digits as the POS's own PIN pad takes (PIN_LENGTH in app/pos/PinPad.tsx). */
export const STAFF_PIN_LENGTH = 4
// Letters (any script), accents, digits, spaces and . , ' ’ & ( ) - only, like loyalty card names.
const STAFF_NAME_CHARACTERS = /^[\p{L}\p{M}\p{N} .,'’&()-]+$/u
const HAS_LETTER = /\p{L}/u
const STAFF_PIN = new RegExp(String.raw`^\d{${STAFF_PIN_LENGTH}}$`)
/** A Sanity document id as the POS creates them: never a draft ("drafts.") or a path. */
const DOC_ID = /^[A-Za-z0-9_-]{1,100}$/
/** A UTC instant, as toISOString() writes it (seconds and milliseconds optional). */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/

export type ClockAction = 'in' | 'out'

export interface OpenShift {
  _id: string
  clockIn: string
}

/** One person on the time clock, and the shift they are on, if any. */
export interface BoardRow {
  staffId: string
  name: string
  /** A PIN is set, so they can clock in. The PIN itself never leaves the server. */
  hasPin: boolean
  openShift: OpenShift | null
}

export interface TimeShift {
  _id: string
  staffId: string
  /** Their name when they clocked in, so the record keeps it after they are removed. */
  staffName: string
  clockIn: string
  /** null while they are on shift. */
  clockOut: string | null
  /** When a manager last changed the shift, or null. Staff see it as "Edited". */
  editedAt: string | null
}

/** A shift's times as a manager sets them. */
export interface ShiftTimes {
  clockIn: string
  clockOut: string | null
}

/** What a staff member sees under My records: their own shifts only. */
export interface MyHours {
  name: string
  openShift: OpenShift | null
  shifts: TimeShift[]
}

export interface StaffTotal {
  staffId: string
  name: string
  ms: number
  count: number
  /** When their open shift began, if one of the shifts counted is still open. */
  openSince: string | null
}

export function isDocId(value: unknown): value is string {
  return typeof value === 'string' && DOC_ID.test(value)
}

/** A UTC instant as it is stored (toISOString), or null when the value is not one. */
export function readInstant(value: unknown): string | null {
  if (typeof value !== 'string' || !ISO_INSTANT.test(value)) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

/** A from/to pair of UTC instants, at most MAX_RANGE_MS apart, as stored; null when either is wrong. */
export function readRange(from: unknown, to: unknown): IsoRange | null {
  const start = readInstant(from)
  const end = readInstant(to)
  if (start === null || end === null) return null
  const span = Date.parse(end) - Date.parse(start)
  return span > 0 && span <= MAX_RANGE_MS ? { from: start, to: end } : null
}

export function isStaffPin(value: unknown): value is string {
  return typeof value === 'string' && STAFF_PIN.test(value)
}

/** Why a PIN can't be a staff PIN, or null when it can. Whether it is taken is the server's to say. */
export function staffPinProblem(pin: string): string | null {
  return isStaffPin(pin) ? null : `A PIN is ${STAFF_PIN_LENGTH} digits.`
}

/** A staff name as it is saved: trimmed, with single spaces. */
export function cleanStaffName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/** Why a name can't go on the time clock, or null when it can. */
export function staffNameProblem(raw: string): string | null {
  const name = cleanStaffName(raw)
  if (name.length < MIN_STAFF_NAME_LENGTH || name.length > MAX_STAFF_NAME_LENGTH) {
    return `Enter a name: ${MIN_STAFF_NAME_LENGTH} to ${MAX_STAFF_NAME_LENGTH} characters.`
  }
  if (!STAFF_NAME_CHARACTERS.test(name) || !HAS_LETTER.test(name)) return 'Use letters, numbers and simple punctuation only.'
  return null
}

/** How long a shift lasted, or has lasted so far while it is open. */
export function shiftMs(shift: Pick<TimeShift, 'clockIn' | 'clockOut'>, now: number): number {
  const end = shift.clockOut === null ? now : Date.parse(shift.clockOut)
  return Math.max(0, end - Date.parse(shift.clockIn))
}

export function countOnShift(rows: BoardRow[]): number {
  return rows.filter(row => row.openShift !== null).length
}

// The café's day turns over at 5:00 AM Manila, well after closing (midnight Friday to Sunday),
// so a closing shift still open at 12:30 AM belongs to that night.
const DAY_TURNOVER_MS = 5 * 60 * 60 * 1000

/** Clocked in on an earlier café day and still on shift: most likely a forgotten clock-out. */
export function startedBeforeToday(clockIn: string, now: number): boolean {
  return manilaDayKey(Date.parse(clockIn) - DAY_TURNOVER_MS) < manilaDayKey(now - DAY_TURNOVER_MS)
}

/**
 * Why a manager can't save these times on a shift, or null when they can. `wasOpen` says the
 * shift is still on (it may stay open); `others` are the same person's shifts that could overlap.
 */
export function shiftTimesProblem(
  times: ShiftTimes,
  { wasOpen, now, others }: { wasOpen: boolean; now: number; others: Pick<TimeShift, 'clockIn' | 'clockOut'>[] },
): string | null {
  const start = Date.parse(times.clockIn)
  if (Number.isNaN(start)) return 'Enter the time in.'
  if (times.clockOut === null && !wasOpen) return 'Enter the time out.'
  const end = times.clockOut === null ? now : Date.parse(times.clockOut)
  if (Number.isNaN(end)) return 'Enter the time out.'
  if (start > now + FUTURE_SLACK_MS) return "Time in can't be in the future."
  if (end > now + FUTURE_SLACK_MS) return "Time out can't be in the future."
  if (end <= start) return 'Time out must be after time in.'
  if (end - start > MAX_SHIFT_MS) return 'A shift can be 16 hours at most. Check the dates.'
  const clash = others.find(other => Date.parse(other.clockIn) < end && start < (other.clockOut === null ? now : Date.parse(other.clockOut)))
  if (clash) return `That overlaps their shift from ${formatDay(clash.clockIn)}, ${formatClock(clash.clockIn)}.`
  return null
}

/** Hours per person: everyone in `staff`, in that order, then anyone else with shifts (removed since). */
export function totalsByStaff(shifts: TimeShift[], staff: Pick<BoardRow, 'staffId' | 'name'>[], now: number): StaffTotal[] {
  const empty = (staffId: string, name: string): StaffTotal => ({ staffId, name, ms: 0, count: 0, openSince: null })
  const totals = new Map<string, StaffTotal>(staff.map(person => [person.staffId, empty(person.staffId, person.name)]))
  for (const shift of shifts) {
    const current = totals.get(shift.staffId) ?? empty(shift.staffId, shift.staffName)
    totals.set(shift.staffId, {
      ...current,
      ms: current.ms + shiftMs(shift, now),
      count: current.count + 1,
      openSince: shift.clockOut === null ? shift.clockIn : current.openSince,
    })
  }
  return [...totals.values()]
}

/** Shifts, newest first as the API sends them, grouped by the Manila day they began on. */
export function groupByDay(shifts: TimeShift[]): { day: string; shifts: TimeShift[] }[] {
  return shifts.reduce<{ day: string; shifts: TimeShift[] }[]>((days, shift) => {
    const day = manilaDayKey(shift.clockIn)
    const last = days[days.length - 1]
    return last && last.day === day
      ? [...days.slice(0, -1), { day, shifts: [...last.shifts, shift] }]
      : [...days, { day, shifts: [shift] }]
  }, [])
}
