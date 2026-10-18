'use client'

import { useCallback, useMemo, useState } from 'react'
import { shiftMs, type MyHours, type TimeShift } from '@/lib/timeclock/rules'
import {
  formatClock,
  formatEnd,
  formatHours,
  formatLongDay,
  formatSince,
  formatTimer,
  periodRange,
  type TimeclockPeriod,
} from '@/lib/timeclock/time'
import PinPad from '../PinPad'
import { ActionButton, Badge, EmptyState } from '../sales/ui'
import { useIdleLock } from '../useIdleLock'
import { latestOnly } from './latestOnly'
import PadCard from './PadCard'
import PeriodChips from './PeriodChips'
import { TIME_CLOCK_MESSAGES, readMyHours } from './sendTimeClock'

/** My records closes after this long without a tap, so the next person can't read them. */
export const MY_RECORDS_IDLE_MS = 60 * 1000

// My records: a staff member's own shifts, after their PIN, as a plain timesheet. View only,
// with nobody else's hours; it closes on Done, after a minute without a tap, or when the screen
// goes off.
export default function MyRecordsView({ now }: { now: number }) {
  const [pin, setPin] = useState<string | null>(null)
  const [period, setPeriod] = useState<TimeclockPeriod>('week')
  const [records, setRecords] = useState<MyHours | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Tapping through the periods quickly: only the last one asked for is shown.
  const readPeriod = useMemo(() => latestOnly(readMyHours), [])

  const close = useCallback(() => {
    setPin(null)
    setRecords(null)
    setError(null)
    setPeriod('week')
  }, [])
  useIdleLock(pin !== null, close, MY_RECORDS_IDLE_MS)

  async function open(typed: string): Promise<string | null> {
    const reply = await readMyHours(typed, periodRange('week', Date.now()))
    if (reply.message !== null || !reply.data) return reply.message ?? TIME_CLOCK_MESSAGES.failed
    setPin(typed)
    setPeriod('week')
    setRecords(reply.data)
    setError(null)
    return null
  }

  async function changePeriod(next: TimeclockPeriod) {
    if (pin === null) return
    setPeriod(next)
    const answer = await readPeriod(pin, periodRange(next, Date.now()))
    if (!answer.latest) return
    const reply = answer.value
    if (reply.message !== null || !reply.data) {
      setError(reply.message ?? TIME_CLOCK_MESSAGES.failed)
      return
    }
    setRecords(reply.data)
    setError(null)
  }

  if (pin === null || records === null) {
    return (
      <PadCard title="My records" note="Enter your PIN to see your own records." hint="View only. Ask the manager to fix a time.">
        <PinPad onComplete={open} />
      </PadCard>
    )
  }
  return <MyRecordsCard records={records} period={period} now={now} error={error} onPeriod={next => void changePeriod(next)} onDone={close} />
}

interface MyRecordsCardProps {
  records: MyHours
  period: TimeclockPeriod
  now: number
  /** Why the last period could not be read; the records shown are the ones before it. */
  error: string | null
  onPeriod: (period: TimeclockPeriod) => void
  onDone: () => void
}

/** One person's status and their shifts for a period, read only. */
export function MyRecordsCard({ records, period, now, error, onPeriod, onDone }: MyRecordsCardProps) {
  const open = records.openShift
  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border px-4 py-3.5 ${open ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-white/80'}`}>
        <div className="min-w-0 flex-1">
          <p className="break-words text-lg font-semibold">{records.name}</p>
          <p className="text-[13px] text-foreground/60">{open ? `On shift since ${formatSince(open.clockIn, now)}` : 'Off the clock'}</p>
        </div>
        {open && (
          <p title="Time on this shift" className="font-display text-2xl font-semibold tabular-nums text-emerald-800">
            {formatTimer(now - Date.parse(open.clockIn))}
          </p>
        )}
        <ActionButton tone="primary" onClick={onDone}>Done</ActionButton>
      </div>

      <PeriodChips value={period} now={now} onChange={onPeriod} />
      {error && <p role="alert" className="text-[13px] text-red-700">{error}</p>}

      {records.shifts.length === 0 ? <EmptyState title="No shifts in this period." /> : <RecordsTable shifts={records.shifts} now={now} />}
      <p className="text-xs text-foreground/45">Only your own records show here, with nothing to edit. This closes by itself after a minute without a tap.</p>
    </div>
  )
}

const COLUMNS = 'grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1.35fr)_7rem]'

/**
 * Shifts as a timesheet, oldest first: the date, time in – time out, and the hours, one line each,
 * with the total at the foot. On a phone the times go under the date.
 */
export function RecordsTable({ shifts, now }: { shifts: TimeShift[]; now: number }) {
  const rows = [...shifts].sort((a, b) => Date.parse(a.clockIn) - Date.parse(b.clockIn))
  const total = rows.reduce((sum, shift) => sum + shiftMs(shift, now), 0)
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white/80">
      <div aria-hidden="true" className={`hidden ${COLUMNS} border-b border-border/70 bg-foreground/3 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/60 sm:grid`}>
        <span>Date</span>
        <span>Time in – Time out</span>
        <span className="text-right">Total hours</span>
      </div>
      <ul>
        {rows.map(shift => (
          <li key={shift._id} className={`${COLUMNS} items-center border-b border-border/70 px-4 py-3 text-[15px] tabular-nums last:border-b-0`}>
            <span className="font-semibold">{formatLongDay(shift.clockIn)}</span>
            <span className="col-start-1 row-start-2 text-foreground/65 sm:col-start-auto sm:row-start-auto">
              {`${formatClock(shift.clockIn)} – `}
              {shift.clockOut ? formatEnd(shift.clockOut, shift.clockIn) : <span className="font-semibold text-emerald-800">on shift</span>}
              {shift.editedAt && <Badge tone="neutral" className="ml-1.5" title="The manager changed this shift">Edited</Badge>}
            </span>
            <span className="row-span-2 text-right font-display font-semibold sm:row-span-1">{formatHours(shiftMs(shift, now))}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-3 border-t border-border bg-foreground/3 px-4 py-3 font-bold">
        <span className="text-sm">{`Total · ${rows.length} shift${rows.length === 1 ? '' : 's'}`}</span>
        <span className="font-display text-xl tabular-nums">{formatHours(total)}</span>
      </div>
    </div>
  )
}
