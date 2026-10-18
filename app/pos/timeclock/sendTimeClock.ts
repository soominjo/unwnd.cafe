import type { BoardRow, MyHours, TimeShift } from '@/lib/timeclock/rules'
import type { IsoRange } from '@/lib/timeclock/time'

/** What the time clock says when a change did not go through. */
export const TIME_CLOCK_MESSAGES = {
  signedOut: 'Signed out. Reload the page.',
  // The change may have been saved before the reply was lost; the time clock is read again to show it.
  noReply: 'No reply. Check the list before trying again.',
  // The reply was not the POS's own, such as a gateway error page.
  failed: 'The server could not be reached. Try again.',
} as const

export interface TimeClockReply<T> {
  /** null when the change was saved, else what to show. */
  message: string | null
  data?: T
  /** No reply came, so the change may or may not have been saved. */
  unsure?: true
  /** The server has no such shift or person: deleted or removed already, on another device say. */
  gone?: true
}

/** Sends one change: a clock in or out, a shift fixed or deleted, someone added or removed. */
export async function sendTimeClock<T = unknown>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<TimeClockReply<T>> {
  let res: Response
  try {
    res = await fetchImpl(url, body
      ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { method })
  } catch {
    return { message: TIME_CLOCK_MESSAGES.noReply, unsure: true }
  }
  const json = (await res.json().catch(() => null)) as { success?: unknown; error?: unknown; data?: unknown } | null
  if (res.ok && json?.success === true) return { message: null, data: json.data as T }
  if (res.status === 401) return { message: TIME_CLOCK_MESSAGES.signedOut }
  // Anything else: the route's own reason when there is one, such as "Incorrect PIN. Try again."
  const reason = typeof json?.error === 'string' && json.error ? json.error : null
  if (res.status === 404 && reason) return { message: reason, gone: true }
  return { message: reason ?? TIME_CLOCK_MESSAGES.failed }
}

/** One person's own hours in `range`, by their PIN: My records on the Time clock page. */
export function readMyHours(pin: string, range: IsoRange, fetchImpl: typeof fetch = fetch): Promise<TimeClockReply<MyHours>> {
  return sendTimeClock<MyHours>('/api/timeclock/mine', 'POST', { pin, from: range.from, to: range.to }, fetchImpl)
}

export interface TimeClockData {
  board: BoardRow[]
  /** The shifts that began in the range asked for; none when no range was asked for. */
  shifts: TimeShift[]
}

/** How long a read may take: the panel says it could not load rather than spin. */
export const READ_TIMEOUT_MS = 6000

/**
 * Everyone on the time clock, plus the shifts that began in `range` when one is given. Never
 * throws: null when the time clock could not be read in time.
 */
export async function readTimeClock(range?: IsoRange, fetchImpl: typeof fetch = fetch): Promise<TimeClockData | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS)
  try {
    const query = range ? `?${new URLSearchParams({ from: range.from, to: range.to })}` : ''
    const res = await fetchImpl(`/api/timeclock${query}`, { cache: 'no-store', signal: controller.signal })
    const json = (await res.json()) as { success?: unknown; data?: Partial<TimeClockData> } | null
    const data = res.ok && json?.success === true ? json.data : undefined
    return data && Array.isArray(data.board) && Array.isArray(data.shifts) ? { board: data.board, shifts: data.shifts } : null
  } catch {
    // The request failed or timed out, or the reply was not JSON.
    return null
  } finally {
    clearTimeout(timer)
  }
}
