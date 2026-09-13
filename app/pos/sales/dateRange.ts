// Period filtering and time formatting for the sales screen. Every range is
// computed in Philippine time (UTC+8, no daylight saving) and handed to the API
// as UTC ISO strings.

export const VALID_PERIODS = ['today', 'yesterday', 'week', 'month', 'year', 'custom'] as const

export type Period = (typeof VALID_PERIODS)[number]
export type PresetPeriod = Exclude<Period, 'custom'>

export const PERIOD_OPTIONS: ReadonlyArray<{ key: Period; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
]

export interface DateRange {
  from: string
  to: string
}

const PH_OFFSET_MS = 8 * 60 * 60 * 1000
const PH_TIME_ZONE = 'Asia/Manila'

export function isPeriod(value: string): value is Period {
  return (VALID_PERIODS as readonly string[]).includes(value)
}

export function periodLabel(period: Period): string {
  return PERIOD_OPTIONS.find((option) => option.key === period)?.label ?? 'Today'
}

/** "Now" shifted so that its UTC fields read as Philippine wall-clock time. */
function phNow(): Date {
  return new Date(Date.now() + PH_OFFSET_MS)
}

/** Midnight of a PH-shifted date (optionally some days away), still PH-shifted. */
function startOfDay(ph: Date, dayOffset = 0): Date {
  return new Date(Date.UTC(ph.getUTCFullYear(), ph.getUTCMonth(), ph.getUTCDate() + dayOffset))
}

/** Converts PH-shifted bounds back to real UTC instants for the API. */
function toRange(startPH: Date, endPH: Date): DateRange {
  return {
    from: new Date(startPH.getTime() - PH_OFFSET_MS).toISOString(),
    to: new Date(endPH.getTime() - PH_OFFSET_MS).toISOString(),
  }
}

export function getPHDateRange(period: PresetPeriod): DateRange {
  const now = phNow()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()

  switch (period) {
    case 'today':
      return toRange(startOfDay(now), startOfDay(now, 1))
    case 'yesterday':
      return toRange(startOfDay(now, -1), startOfDay(now))
    case 'week': {
      // Weeks run Monday to Sunday.
      const day = now.getUTCDay()
      const sinceMonday = day === 0 ? 6 : day - 1
      return toRange(startOfDay(now, -sinceMonday), startOfDay(now, 7 - sinceMonday))
    }
    case 'month':
      return toRange(new Date(Date.UTC(year, month, 1)), new Date(Date.UTC(year, month + 1, 1)))
    case 'year':
      return toRange(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year + 1, 0, 1)))
  }
}

/** Returns null when a custom range is selected but one of its dates is still missing. */
export function computeDateRange(period: Period, customFrom: string, customTo: string): DateRange | null {
  if (period !== 'custom') return getPHDateRange(period)
  if (!customFrom || !customTo) return null
  const [y1, m1, d1] = customFrom.split('-').map(Number)
  const [y2, m2, d2] = customTo.split('-').map(Number)
  return toRange(new Date(Date.UTC(y1, m1 - 1, d1)), new Date(Date.UTC(y2, m2 - 1, d2 + 1)))
}

/** Calendar days spanned by a custom range, inclusive of both ends. */
function customRangeDays(customFrom: string, customTo: string): number {
  const [y1, m1, d1] = customFrom.split('-').map(Number)
  const [y2, m2, d2] = customTo.split('-').map(Number)
  const ms = Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)
  return Math.round(ms / (24 * 60 * 60 * 1000)) + 1
}

/** Longest custom range, in days, that still counts as "detailed" (see isDetailedPeriod). */
const MAX_DETAILED_DAYS = 2

/**
 * Whether the period is short enough to browse individual orders (Recent/Completed).
 * Today and Yesterday always qualify; Week/Month/Year never do (they're always
 * longer than MAX_DETAILED_DAYS); a Custom range qualifies only if it's short.
 * Longer ranges show only the aggregated Top Items/Top Customers view instead —
 * fetching and paginating every order in a month- or year-long range isn't worth it
 * when the aggregate is what's actually useful at that scale.
 */
export function isDetailedPeriod(period: Period, customFrom: string, customTo: string): boolean {
  if (period === 'today' || period === 'yesterday') return true
  if (period !== 'custom') return false
  if (!customFrom || !customTo) return false
  return customRangeDays(customFrom, customTo) <= MAX_DETAILED_DAYS
}

/** Today's date in PH time as YYYY-MM-DD, for date-input bounds. */
export function todayPH(): string {
  const ph = phNow()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${ph.getUTCFullYear()}-${pad(ph.getUTCMonth() + 1)}-${pad(ph.getUTCDate())}`
}

export function formatPHTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: PH_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
