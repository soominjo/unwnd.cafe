'use client'

import { useState, type FormEvent } from 'react'
import {
  MAX_STAFF_NAME_LENGTH,
  STAFF_PIN_LENGTH,
  cleanStaffName,
  staffNameProblem,
  staffPinProblem,
  type BoardRow,
} from '@/lib/timeclock/rules'
import { ActionButton, InlineConfirm } from '../sales/ui'

interface StaffAdminProps {
  board: BoardRow[]
  /** Each resolves to null when it worked, else why not. */
  onAdd: (name: string, pin: string) => Promise<string | null>
  onChangePin: (row: BoardRow, pin: string) => Promise<string | null>
  onRemove: (row: BoardRow) => Promise<string | null>
}

const PIN_INPUT = 'h-10 w-28 rounded-md border border-foreground/25 bg-white px-2.5 text-sm max-sm:text-base tracking-[0.3em] tabular-nums'
const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, STAFF_PIN_LENGTH)

// Staff on the Manager page: who is on the time clock, and their PINs. A PIN can't be read back,
// only replaced. Removing someone keeps their shifts; someone on shift clocks out first.
export default function StaffAdmin({ board, onAdd, onChangePin, onRemove }: StaffAdminProps) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [adding, setAdding] = useState(false)
  // The person whose PIN is being changed, and the new one typed.
  const [pinFor, setPinFor] = useState<string | null>(null)
  const [newPin, setNewPin] = useState('')
  const [savingPin, setSavingPin] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    const cleaned = cleanStaffName(name)
    const problem = staffNameProblem(cleaned) ?? staffPinProblem(pin)
    if (problem) {
      setError(problem)
      return
    }
    setAdding(true)
    setNotice(null)
    const failed = await onAdd(cleaned, pin)
    setAdding(false)
    setError(failed)
    if (failed === null) {
      setName('')
      setPin('')
      setNotice(`${cleaned} can clock in now. Tell them their PIN.`)
    }
  }

  function startPinChange(row: BoardRow) {
    setPinFor(row.staffId)
    setNewPin('')
    setConfirmingId(null)
    setError(null)
    setNotice(null)
  }

  async function savePin(e: FormEvent, row: BoardRow) {
    e.preventDefault()
    const problem = staffPinProblem(newPin)
    if (problem) {
      setError(problem)
      return
    }
    setSavingPin(true)
    const failed = await onChangePin(row, newPin)
    setSavingPin(false)
    setError(failed)
    if (failed === null) {
      setPinFor(null)
      setNewPin('')
      setNotice(`${row.name}’s PIN is changed. Tell them the new one.`)
    }
  }

  function askToRemove(row: BoardRow) {
    if (row.openShift) {
      setError(`${row.name} is on shift. Clock them out first.`)
      return
    }
    setError(null)
    setNotice(null)
    setPinFor(null)
    setConfirmingId(row.staffId)
  }

  async function remove(row: BoardRow) {
    setRemovingId(row.staffId)
    const failed = await onRemove(row)
    setRemovingId(null)
    setConfirmingId(null)
    setError(failed)
    if (failed === null) setNotice(`${row.name} is off the time clock. Their records stay.`)
  }

  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60">Staff on the time clock</h3>
      {notice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      <div className="grid gap-2.5 rounded-lg border border-border bg-white/80 px-3.5 py-3">
        <ul className="grid">
          {board.length === 0 && <li className="py-1.5 text-sm text-foreground/60">Nobody yet. Add the first name and PIN below.</li>}
          {board.map(row => (
            <li key={row.staffId} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 py-2 text-sm last:border-b-0">
              {confirmingId === row.staffId ? (
                <div className="w-full">
                  <InlineConfirm
                    message={`Remove ${row.name} from the time clock? Their records stay.`}
                    confirmLabel="Remove"
                    onCancel={() => setConfirmingId(null)}
                    onConfirm={() => void remove(row)}
                  />
                </div>
              ) : pinFor === row.staffId ? (
                <form onSubmit={e => void savePin(e, row)} className="flex w-full flex-wrap items-center gap-2">
                  <span className="font-semibold">{row.name}</span>
                  <label htmlFor={`pin-${row.staffId}`} className="sr-only">{`New PIN for ${row.name}`}</label>
                  <input
                    id={`pin-${row.staffId}`}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="New PIN"
                    value={newPin}
                    onChange={e => {
                      setNewPin(digitsOnly(e.target.value))
                      setError(null)
                    }}
                    className={PIN_INPUT}
                  />
                  <ActionButton tone="ghost" onClick={() => setPinFor(null)}>Cancel</ActionButton>
                  <ActionButton tone="primary" type="submit" busy={savingPin}>Save PIN</ActionButton>
                </form>
              ) : (
                <>
                  <span>
                    <span className="font-semibold">{row.name}</span>
                    <span className="ml-2 text-xs text-foreground/60">
                      {row.openShift && <span className="font-semibold text-emerald-800">on shift · </span>}
                      {row.hasPin ? 'PIN set' : <span className="font-semibold text-amber-700">No PIN yet</span>}
                    </span>
                  </span>
                  <span className="flex gap-1.5">
                    <ActionButton tone="neutral" onClick={() => startPinChange(row)}>{row.hasPin ? 'Change PIN' : 'Set PIN'}</ActionButton>
                    <ActionButton tone="danger" busy={removingId === row.staffId} onClick={() => askToRemove(row)}>Remove</ActionButton>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={e => void add(e)} className="flex flex-wrap gap-2">
          <label htmlFor="add-staff-name" className="sr-only">Full name</label>
          <input
            id="add-staff-name"
            value={name}
            maxLength={MAX_STAFF_NAME_LENGTH}
            autoComplete="off"
            placeholder="Full name"
            onChange={e => {
              setName(e.target.value)
              setError(null)
            }}
            className="h-10 min-w-0 flex-1 basis-52 rounded-md border border-foreground/25 bg-white px-2.5 text-sm max-sm:text-base"
          />
          <label htmlFor="add-staff-pin" className="sr-only">Their PIN, 4 digits</label>
          <input
            id="add-staff-pin"
            inputMode="numeric"
            autoComplete="off"
            placeholder="PIN"
            value={pin}
            onChange={e => {
              setPin(digitsOnly(e.target.value))
              setError(null)
            }}
            className={PIN_INPUT}
          />
          <ActionButton tone="primary" type="submit" busy={adding} disabled={!name.trim() || pin === ''}>Add staff</ActionButton>
        </form>
        {error && <p role="alert" className="text-[13px] text-red-700">{error}</p>}
        <p className="text-xs text-foreground/45">
          Each PIN is 4 digits and belongs to one person, and it can’t be the manager PIN. The POS keeps only a fingerprint of it, so a forgotten PIN gets a new one here.
        </p>
      </div>
    </section>
  )
}
