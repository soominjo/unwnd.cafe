// Time clock times: stored as UTC instants (ISO strings), read and grouped in Manila time
// (UTC+8, no daylight saving). Weeks run Monday to Sunday, the same as on Sales.

export const MANILA_TIME_ZONE = 'Asia/Manila'
const OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export const TIMECLOCK_PERIODS = ['week', 'lastweek', 'month', 'lastmonth'] as const
export type TimeclockPeriod = (typeof TIMECLOCK_PERIODS)[number]

export const PERIOD_LABELS: Record<TimeclockPeriod, string> = {
  week: 'This week',
  lastweek: 'Last week',
  month: 'This month',
  lastmonth: 'Last month',
}

/** An instant: an ISO string as stored, or epoch milliseconds such as Date.now(). */
export type Instant = string | number

/** From (inclusive) and to (exclusive), as UTC ISO strings for the API. */
export interface IsoRange {
  from: string
  to: string
}

const toMs = (at: Instant): number => (typeof at === 'number' ? at : Date.parse(at))
const iso = (ms: number): string => new Date(ms).toISOString()
// An instant shifted so that its UTC fields read as Manila wall-clock time, and back.
const toWall = (ms: number): Date => new Date(ms + OFFSET_MS)
const fromWall = (wallMs: number): number => wallMs - OFFSET_MS

/** The Manila midnight that starts the day `ms` falls on. */
export function manilaDayStart(ms: number): number {
  const wall = toWall(ms)
  return fromWall(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()))
}

/** Monday 12:00 AM, Manila time, of the week `ms` falls in. */
export function manilaWeekStart(ms: number): number {
  const sinceMonday = (toWall(ms).getUTCDay() + 6) % 7
  return manilaDayStart(ms) - sinceMonday * DAY_MS
}

function manilaMonthStart(ms: number, monthsAway: number): number {
  const wall = toWall(ms)
  return fromWall(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth() + monthsAway, 1))
}

export function isTimeclockPeriod(value: string): value is TimeclockPeriod {
  return (TIMECLOCK_PERIODS as readonly string[]).includes(value)
}

/** The shifts Records shows for a period: those whose time in falls inside it. */
export function periodRange(period: TimeclockPeriod, now: number): IsoRange {
  const week = manilaWeekStart(now)
  switch (period) {
    case 'week':
      return { from: iso(week), to: iso(week + 7 * DAY_MS) }
    case 'lastweek':
      return { from: iso(week - 7 * DAY_MS), to: iso(week) }
    case 'month':
      return { from: iso(manilaMonthStart(now, 0)), to: iso(manilaMonthStart(now, 1)) }
    case 'lastmonth':
      return { from: iso(manilaMonthStart(now, -1)), to: iso(manilaMonthStart(now, 0)) }
  }
}

/** What the Staff tab reads: last week and this week, for each person's "This week" and last week's total. */
export function staffWeeksRange(now: number): IsoRange {
  const week = manilaWeekStart(now)
  return { from: iso(week - 7 * DAY_MS), to: iso(week + 7 * DAY_MS) }
}

export function isInRange(at: Instant, range: IsoRange): boolean {
  const ms = toMs(at)
  return ms >= Date.parse(range.from) && ms < Date.parse(range.to)
}

/** "2026-10-15": the Manila calendar day an instant falls on. Sorts like the days it names. */
export function manilaDayKey(at: Instant): string {
  return toWall(toMs(at)).toISOString().slice(0, 10)
}

function format(at: Instant, options: Intl.DateTimeFormatOptions): string {
  return new Date(toMs(at)).toLocaleString('en-PH', { timeZone: MANILA_TIME_ZONE, ...options })
}

/** "9:58 AM" */
export const formatClock = (at: Instant): string => format(at, { hour: 'numeric', minute: '2-digit' })

/** "9:58:12 AM": the clock at the top of the Staff tab. */
export const formatClockSeconds = (at: Instant): string => format(at, { hour: 'numeric', minute: '2-digit', second: '2-digit' })

/** "Thu, Oct 15" */
export const formatDay = (at: Instant): string => format(at, { weekday: 'short', month: 'short', day: 'numeric' })

/** "Thursday, October 15" */
export const formatLongDay = (at: Instant): string => format(at, { weekday: 'long', month: 'long', day: 'numeric' })

/** When a shift began, the way a person says it: "9:58 AM" today, "yesterday, 9:51 AM", else "Tue, Oct 13, 9:51 AM". */
export function formatSince(at: Instant, now: number): string {
  const day = manilaDayKey(at)
  if (day === manilaDayKey(now)) return formatClock(at)
  if (day === manilaDayKey(now - DAY_MS)) return `yesterday, ${formatClock(at)}`
  return `${formatDay(at)}, ${formatClock(at)}`
}

/** A shift's end: the time alone, or with the day when the shift ended on a later day than it began. */
export function formatEnd(clockOut: Instant, clockIn: Instant): string {
  return manilaDayKey(clockOut) === manilaDayKey(clockIn) ? formatClock(clockOut) : `${formatDay(clockOut)}, ${formatClock(clockOut)}`
}

/** "8h 04m", or "42m" under an hour: whole minutes, rounded down. */
export function formatHours(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60000))
  const hours = Math.floor(minutes / 60)
  return hours > 0 ? `${hours}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`
}

/** "2:14:05": the running timer of a shift. */
export function formatTimer(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const mm = String(Math.floor(seconds / 60) % 60).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${Math.floor(seconds / 3600)}:${mm}:${ss}`
}

/** "2026-10-15T09:58": an instant as a datetime-local input shows it, in Manila time. */
export function toManilaInput(at: Instant): string {
  return toWall(toMs(at)).toISOString().slice(0, 16)
}

const INPUT_VALUE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/

/** The instant a datetime-local value means in Manila (seconds dropped), or null when it is not a whole, real date and time. */
export function fromManilaInput(value: string): string | null {
  const match = INPUT_VALUE.exec(value)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number)
  const wall = new Date(Date.UTC(year, month - 1, day, hour, minute))
  // Date.UTC rolls an impossible value (Feb 30, 24:00) into the next day: refuse it instead.
  if (wall.getUTCMonth() !== month - 1 || wall.getUTCDate() !== day || wall.getUTCHours() !== hour || wall.getUTCMinutes() !== minute) return null
  return iso(fromWall(wall.getTime()))
}
