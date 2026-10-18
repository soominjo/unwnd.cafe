'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { startedBeforeToday, type BoardRow, type ClockAction, type TimeShift } from '@/lib/timeclock/rules'
import { formatClock, formatClockSeconds, formatHours, formatLongDay, formatSince, formatTimer } from '@/lib/timeclock/time'
import { ActionButton, EmptyState, ErrorBanner, Skeleton } from '../sales/ui'
import { latestOnly } from './latestOnly'
import PinDialog from './PinDialog'
import { TIME_CLOCK_MESSAGES, readTimeClock, sendTimeClock } from './sendTimeClock'

/** What the punch route answers. */
export interface Punch {
  action: ClockAction
  name: string
  shift: TimeShift
  /** Clocked in already, or clocked out within the last minute: shown again, nothing changed. */
  repeat: boolean
}

/** How long "John Reyes clocked in at 9:58 AM." stays at the top. */
export const NOTICE_MS = 8 * 1000
/** With no reply, the punch may or may not have landed; entering the PIN again can't clock anyone twice. */
export const NO_REPLY_PUNCH = "No reply. Enter your PIN again: it won't clock you twice."

// Clock in or out: everyone on the time clock, each with one button. Tapping it asks for that
// person's PIN; once it is taken, the button turns into the other one. Each person has their own
// button, PIN and shift, so two people arriving together tap one after the other.
export default function ClockView({ now }: { now: number }) {
  const [board, setBoard] = useState<BoardRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [asking, setAsking] = useState<{ row: BoardRow; action: ClockAction } | null>(null)
  const [notice, setNotice] = useState<{ punch: Punch; at: number } | null>(null)
  // Reads started close together: only the last one asked for is shown.
  const read = useMemo(() => latestOnly(() => readTimeClock()), [])

  const load = useCallback(() => read().then(answer => {
    if (!answer.latest) return
    if (answer.value) setBoard(answer.value.board)
    setFailed(answer.value === null)
  }), [read])

  useEffect(() => {
    void load()
  }, [load])

  const closeDialog = useCallback(() => setAsking(null), [])

  async function punch(pin: string): Promise<string | null> {
    if (!asking) return null
    const { row, action } = asking
    const reply = await sendTimeClock<Punch>('/api/timeclock/punch', 'POST', { staffId: row.staffId, action, pin })
    if (reply.unsure) {
      void load()
      return NO_REPLY_PUNCH
    }
    if (reply.message !== null || !reply.data) {
      // Someone removed, or clocked out on another device: the list catches up.
      void load()
      return reply.message ?? TIME_CLOCK_MESSAGES.failed
    }
    const done = reply.data
    const openShift = done.shift.clockOut ? null : { _id: done.shift._id, clockIn: done.shift.clockIn }
    setBoard(rows => rows && rows.map(r => (r.staffId === row.staffId ? { ...r, openShift } : r)))
    setNotice({ punch: done, at: Date.now() })
    setAsking(null)
    return null
  }

  const verb = asking?.action === 'out' ? 'clock out' : 'clock in'
  return (
    <div className="space-y-3">
      {failed && (
        <ErrorBanner
          message={board ? 'Could not refresh the time clock. Showing it as last read.' : 'Could not load the time clock.'}
          actionLabel="Try again"
          onDismiss={() => void load()}
        />
      )}
      {notice && now - notice.at < NOTICE_MS && (
        <p
          role="status"
          className={`rounded-md border px-4 py-3 text-sm font-medium ${notice.punch.action === 'in' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-border bg-white/80 text-foreground'}`}
        >
          {punchLine(notice.punch)}
        </p>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60" suppressHydrationWarning>{formatLongDay(now)}</p>
        <p className="font-display text-xl font-semibold tabular-nums" suppressHydrationWarning>{formatClockSeconds(now)}</p>
      </div>
      {board === null ? (
        !failed && <Skeleton rows={3} height="h-16" />
      ) : board.length === 0 ? (
        <EmptyState title="No staff on the time clock yet." hint="The manager adds names and PINs on the Manager page." />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border bg-white/80">
          {board.map(row => (
            <ClockRow key={row.staffId} row={row} now={now} onTap={() => setAsking({ row, action: row.openShift ? 'out' : 'in' })} />
          ))}
        </ul>
      )}
      <p className="px-0.5 text-xs leading-relaxed text-foreground/45">
        Arriving together? Each person taps their own button and enters their own PIN, one after the other. Each shift keeps its own time.
      </p>
      {asking && (
        <PinDialog
          title={asking.action === 'out' ? 'Clock out' : 'Clock in'}
          name={asking.row.name}
          note={`Enter your PIN to ${verb}.`}
          onPin={punch}
          onClose={closeDialog}
        />
      )}
    </div>
  )
}

/** One person: on shift or not, a running timer while they are, and the one button. */
export function ClockRow({ row, now, onTap }: { row: BoardRow; now: number; onTap: () => void }) {
  const open = row.openShift
  const status = open ? `On shift since ${formatSince(open.clockIn, now)}` : row.hasPin ? 'Off the clock' : 'No PIN yet · ask the manager'
  return (
    <li className={`border-t border-border/70 px-4 py-3.5 first:border-t-0 ${open ? 'bg-emerald-50/70' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 ${open ? 'border-emerald-600 bg-emerald-600 ring-4 ring-emerald-600/15' : 'border-foreground/25'}`}
          />
          <div className="min-w-0">
            <p className="break-words text-base font-semibold">{row.name}</p>
            <p className="text-xs text-foreground/60">{status}</p>
          </div>
        </div>
        {open && (
          <p
            title="Time on this shift"
            className="order-last w-full pl-5.5 font-display text-xl font-semibold tabular-nums text-emerald-800 sm:order-none sm:w-auto sm:pl-0 sm:text-2xl"
          >
            {formatTimer(now - Date.parse(open.clockIn))}
          </p>
        )}
        {open
          ? <ActionButton tone="danger" className="min-w-32 bg-white" onClick={onTap}>Clock out</ActionButton>
          : <ActionButton tone="primary" className="min-w-32" disabled={!row.hasPin} onClick={onTap}>Clock in</ActionButton>}
      </div>
      {open && startedBeforeToday(open.clockIn, now) && (
        <p className="ml-5.5 mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
          {`Clocked in since ${formatSince(open.clockIn, now)}. Clock out now, then ask the manager to set the real time out.`}
        </p>
      )}
    </li>
  )
}

/** "John Reyes clocked in at 9:58 AM.", "… clocked out at 6:02 PM · 8h 04m on this shift.", or the repeat of either. */
export function punchLine(punch: Punch): string {
  const { name, shift, repeat } = punch
  if (punch.action === 'in' || !shift.clockOut) {
    return repeat ? `${name} was already clocked in, since ${formatClock(shift.clockIn)}.` : `${name} clocked in at ${formatClock(shift.clockIn)}.`
  }
  const hours = formatHours(Date.parse(shift.clockOut) - Date.parse(shift.clockIn))
  return `${name} ${repeat ? 'already clocked out' : 'clocked out'} at ${formatClock(shift.clockOut)} · ${hours} on this shift.`
}
