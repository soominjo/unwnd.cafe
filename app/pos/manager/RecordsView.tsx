'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MAX_SHIFT_MS,
  groupByDay,
  shiftMs,
  startedBeforeToday,
  totalsByStaff,
  type ShiftTimes,
  type StaffTotal,
  type TimeShift,
} from '@/lib/timeclock/rules'
import {
  formatClock,
  formatDay,
  formatEnd,
  formatHours,
  formatLongDay,
  formatSince,
  periodRange,
  type TimeclockPeriod,
} from '@/lib/timeclock/time'
import { ActionButton, Badge, EmptyState, ErrorBanner, InlineConfirm, Skeleton } from '../sales/ui'
import { latestOnly } from '../timeclock/latestOnly'
import PeriodChips from '../timeclock/PeriodChips'
import { readTimeClock, sendTimeClock, type TimeClockData } from '../timeclock/sendTimeClock'
import ShiftEditor from './ShiftEditor'

type LoadState = 'loading' | 'ready' | 'failed'

const shiftUrl = (id: string) => `/api/timeclock/shifts/${encodeURIComponent(id)}`

// Hours on the Manager page: everyone's hours for a week or a month, every shift with Edit and
// Delete, and a forgotten clock-out flagged at the top with Set time out.
export default function RecordsView({ now }: { now: number }) {
  const [period, setPeriod] = useState<TimeclockPeriod>('week')
  const [data, setData] = useState<TimeClockData | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tapping through the periods quickly: only the last one asked for is shown.
  const read = useMemo(() => latestOnly(readTimeClock), [])

  const load = useCallback((which: TimeclockPeriod) => read(periodRange(which, Date.now())).then(answer => {
    if (!answer.latest) return
    if (answer.value) setData(answer.value)
    setLoadState(answer.value ? 'ready' : 'failed')
  }), [read])

  useEffect(() => {
    void load(period)
  }, [load, period])

  function changePeriod(next: TimeclockPeriod) {
    setPeriod(next)
    setLoadState('loading')
    setEditingId(null)
    setDeletingId(null)
  }

  async function saveShift(shift: TimeShift, times: ShiftTimes): Promise<string | null> {
    setBusy(true)
    const reply = await sendTimeClock(shiftUrl(shift._id), 'PATCH', { clockIn: times.clockIn, clockOut: times.clockOut })
    setBusy(false)
    if (reply.message === null) setEditingId(null)
    if (reply.message === null || reply.unsure || reply.gone) await load(period)
    return reply.message
  }

  async function deleteShift(shift: TimeShift) {
    setBusy(true)
    setError(null)
    const reply = await sendTimeClock(shiftUrl(shift._id), 'DELETE')
    setBusy(false)
    setDeletingId(null)
    if (reply.message !== null && !reply.gone) setError(`Not deleted: ${reply.message}`)
    await load(period)
  }

  const board = data?.board ?? null
  const shifts = data?.shifts ?? []
  // Shifts still open from an earlier day: most likely forgotten clock-outs. Each is fixed in
  // its own alert, so the list below leaves it out of editing.
  const forgotten: TimeShift[] = (board ?? []).flatMap(row => (row.openShift && startedBeforeToday(row.openShift.clockIn, now)
    ? [{ _id: row.openShift._id, staffId: row.staffId, staffName: row.name, clockIn: row.openShift.clockIn, clockOut: null, editedAt: null }]
    : []))
  const forgottenIds = new Set(forgotten.map(shift => shift._id))

  function shiftLine(shift: TimeShift) {
    if (editingId === shift._id && !forgottenIds.has(shift._id)) {
      return <ShiftEditor key={shift._id} shift={shift} now={now} busy={busy} onSave={times => saveShift(shift, times)} onCancel={() => setEditingId(null)} />
    }
    if (deletingId === shift._id) {
      return (
        <div key={shift._id} className="border-t border-border/70 bg-white px-3.5 py-3">
          <InlineConfirm
            message={`Delete ${shift.staffName}’s shift on ${formatDay(shift.clockIn)} (${formatHours(shiftMs(shift, now))})? It comes off their hours.`}
            confirmLabel="Delete"
            onCancel={() => setDeletingId(null)}
            onConfirm={() => void deleteShift(shift)}
          />
        </div>
      )
    }
    return (
      <ShiftRow
        key={shift._id}
        shift={shift}
        now={now}
        onEdit={() => {
          setDeletingId(null)
          setEditingId(shift._id)
        }}
        onDelete={() => {
          setEditingId(null)
          setDeletingId(shift._id)
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <PeriodChips value={period} now={now} onChange={changePeriod} />

      {loadState === 'failed' && (
        <ErrorBanner
          message={data ? 'Could not refresh the hours. Showing them as last read.' : 'Could not load the hours.'}
          actionLabel="Try again"
          onDismiss={() => {
            setLoadState('loading')
            void load(period)
          }}
        />
      )}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {forgotten.map(shift => (
        <div key={shift._id} role="status" className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
            <span>{`${shift.staffName} is still clocked in from ${formatSince(shift.clockIn, now)}.`}</span>
            {editingId !== shift._id && <ActionButton tone="neutral" onClick={() => setEditingId(shift._id)}>Set time out</ActionButton>}
          </div>
          {editingId === shift._id && (
            <ShiftEditor shift={shift} now={now} busy={busy} onSave={times => saveShift(shift, times)} onCancel={() => setEditingId(null)} />
          )}
        </div>
      ))}

      {!data ? (
        loadState === 'loading' && <Skeleton rows={2} height="h-20" />
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-2.5">
            {totalsByStaff(shifts, data.board, now).map(total => (
              <TotalCard key={total.staffId} total={total} removed={!data.board.some(row => row.staffId === total.staffId)} />
            ))}
          </div>

          <section className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60">Shifts</h3>
            {shifts.length === 0 ? (
              <EmptyState title="No shifts in this period." />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-white/80">
                {groupByDay(shifts).map(day => (
                  <section key={day.day} className="border-t border-border/70 first:border-t-0">
                    <h4 className="bg-foreground/3 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/60">
                      {formatLongDay(day.shifts[0].clockIn)}
                    </h4>
                    {day.shifts.map(shiftLine)}
                  </section>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

/** One person's hours in the period. */
export function TotalCard({ total, removed }: { total: StaffTotal; removed: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-white/80 px-3.5 py-3">
      <p className="break-words text-[13px] font-semibold">
        {total.name}
        {removed && <Badge tone="neutral" className="ml-1.5">Removed</Badge>}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{formatHours(total.ms)}</p>
      <p className="text-xs text-foreground/60">
        {`${total.count} shift${total.count === 1 ? '' : 's'}`}
        {total.openSince && <span className="font-semibold text-emerald-800"> · on shift</span>}
      </p>
    </div>
  )
}

interface ShiftRowProps {
  shift: TimeShift
  now: number
  onEdit: () => void
  onDelete: () => void
}

/** One shift in the list: who, when, how long, and Edit and Delete. */
export function ShiftRow({ shift, now, onEdit, onDelete }: ShiftRowProps) {
  const length = shiftMs(shift, now)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-border/70 px-3.5 py-2.5 text-[13.5px] tabular-nums sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_4.5rem_auto]">
      <span className="break-words font-semibold">{shift.staffName}</span>
      <span className="col-span-2 row-start-2 text-foreground/65 sm:col-span-1 sm:row-start-auto">
        {`${formatClock(shift.clockIn)} – `}
        {shift.clockOut ? formatEnd(shift.clockOut, shift.clockIn) : <span className="font-semibold text-emerald-800">on shift</span>}
        {shift.editedAt && <Badge tone="neutral" className="ml-1.5">Edited</Badge>}
        {length > MAX_SHIFT_MS && <Badge tone="pending" className="ml-1.5">Over 16h · check</Badge>}
      </span>
      <span className="text-right font-display font-semibold">{formatHours(length)}</span>
      <span className="col-span-2 flex gap-1.5 sm:col-span-1 sm:justify-end">
        <ActionButton tone="neutral" onClick={onEdit}>Edit</ActionButton>
        <ActionButton tone="danger" onClick={onDelete}>Delete</ActionButton>
      </span>
    </div>
  )
}
