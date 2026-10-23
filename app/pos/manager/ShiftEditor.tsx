'use client'

import { useState, type FormEvent } from 'react'
import { shiftTimesProblem, type ShiftTimes, type TimeShift } from '@/lib/timeclock/rules'
import { formatDay, fromManilaInput, toManilaInput } from '@/lib/timeclock/time'
import { ActionButton } from '../sales/ui'

interface ShiftEditorProps {
  shift: TimeShift
  now: number
  busy: boolean
  /** Saves the times; resolves to null when saved, else why not. */
  onSave: (times: ShiftTimes) => Promise<string | null>
  onCancel: () => void
}

const FIELD = 'grid gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/60'
const INPUT = 'h-10 rounded-md border border-foreground/25 bg-white px-2.5 text-sm max-sm:text-base normal-case tracking-normal text-foreground'

// A manager's fix to one shift, in Manila time: most often the real time out of a forgotten
// clock-out. The server runs the same checks, and also looks for overlaps with their other shifts.
export default function ShiftEditor({ shift, now, busy, onSave, onCancel }: ShiftEditorProps) {
  const [inValue, setInValue] = useState(() => toManilaInput(shift.clockIn))
  const [outValue, setOutValue] = useState(() => (shift.clockOut ? toManilaInput(shift.clockOut) : ''))
  const [problem, setProblem] = useState<string | null>(null)
  const wasOpen = shift.clockOut === null
  const latest = toManilaInput(now)

  async function save(e: FormEvent) {
    e.preventDefault()
    const clockIn = fromManilaInput(inValue)
    if (clockIn === null) {
      setProblem('Enter the time in.')
      return
    }
    const clockOut = outValue ? fromManilaInput(outValue) : null
    if (outValue && clockOut === null) {
      setProblem('Enter the whole time out, or clear it.')
      return
    }
    const local = shiftTimesProblem({ clockIn, clockOut }, { wasOpen, now: Date.now(), others: [] })
    setProblem(local ?? (await onSave({ clockIn, clockOut })))
  }

  return (
    <form onSubmit={save} aria-label={`Edit the shift of ${shift.staffName}`} className="grid gap-2.5 border-t border-border/70 bg-white px-3.5 py-3">
      <p className="text-[13.5px] font-semibold">{`${shift.staffName} · ${formatDay(shift.clockIn)}`}</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-2.5">
        <label className={FIELD}>
          Time in
          <input
            type="datetime-local"
            value={inValue}
            max={latest}
            onChange={e => {
              setInValue(e.target.value)
              setProblem(null)
            }}
            className={INPUT}
          />
        </label>
        <label className={FIELD}>
          {wasOpen ? 'Time out · empty while on shift' : 'Time out'}
          <input
            type="datetime-local"
            value={outValue}
            max={latest}
            onChange={e => {
              setOutValue(e.target.value)
              setProblem(null)
            }}
            className={INPUT}
          />
        </label>
      </div>
      {problem && <p role="alert" className="text-[13px] text-red-700">{problem}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <ActionButton tone="ghost" onClick={onCancel}>Cancel</ActionButton>
        <ActionButton tone="primary" type="submit" busy={busy}>Save</ActionButton>
      </div>
      <p className="text-xs text-foreground/45">A saved change shows as Edited to the staff member too.</p>
    </form>
  )
}
