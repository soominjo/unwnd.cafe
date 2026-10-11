'use client'

import { Fragment, useState } from 'react'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/sales/payments'
import type { Sale } from '../types'
import { formatPHClock } from './dateRange'
import { PencilIcon } from './icons'
import MethodFix from './MethodFix'
import MovedNote from './MovedNote'
import { METHOD_COLORS } from './paymentColors'

interface OrderPaymentsProps {
  order: Sale
  /** Moves one payment to another method: resolves to null when done, else to why not. */
  onChangeMethod: (paymentKey: string, method: PaymentMethod) => Promise<string | null>
}

/**
 * How a Sales card's order was paid: a mark per payment (with its time when the order was paid in
 * two goes), each tappable to move it to the method it was really taken by and saying when one was
 * moved, and any part no payment covers. Nothing for an order from before payments were recorded.
 */
export default function OrderPayments({ order, onChangeMethod }: OrderPaymentsProps) {
  const [fixing, setFixing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const payments = order.payments ?? []
  if (payments.length === 0) return null

  const showTimes = new Set(payments.map(p => p.addedAt ?? '')).size > 1
  const unrecorded = order.total - payments.reduce((sum, p) => sum + p.amount, 0)
  const open = payments.find(p => p._key === fixing) ?? null

  async function move(method: PaymentMethod) {
    if (!open) return
    setBusy(true)
    setError(null)
    const problem = await onChangeMethod(open._key, method)
    setBusy(false)
    if (problem) setError(problem)
    else setFixing(null)
  }

  return (
    <div className="border-b border-border/70">
      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/45">Paid</span>
        {payments.map(p => {
          const paidAt = p.addedAt ?? order._createdAt
          const time = showTimes ? formatPHClock(paidAt) : null
          const label = PAYMENT_METHOD_LABELS[p.method]
          const amount = `₱${p.amount.toLocaleString('en-PH')}`
          return (
            <Fragment key={p._key}>
              <button
                type="button"
                aria-expanded={fixing === p._key}
                aria-label={`${amount} by ${label}${time ? ` at ${time}` : ''}. Change the method`}
                title="Change the method"
                onClick={() => {
                  setFixing(fixing === p._key ? null : p._key)
                  setError(null)
                }}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border bg-white px-2.5 text-xs font-semibold text-foreground transition-colors ${
                  fixing === p._key ? 'border-foreground ring-1 ring-foreground' : 'border-foreground/20 hover:border-foreground/45'
                }`}
              >
                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: METHOD_COLORS[p.method] }} />
                {label} {amount}
                {time && <span className="font-normal text-foreground/55">· {time}</span>}
                <PencilIcon width={11} height={11} className="opacity-50" />
              </button>
              <MovedNote payment={p} paidAt={paidAt} className="text-xs italic text-foreground/60" />
            </Fragment>
          )
        })}
        {unrecorded > 0.004 && <span className="text-xs italic text-foreground/45">₱{unrecorded.toLocaleString('en-PH')} not recorded</span>}
      </div>
      {open && (
        <MethodFix
          amount={open.amount}
          current={open.method}
          busy={busy}
          error={error}
          onPick={move}
          onCancel={() => {
            setFixing(null)
            setError(null)
          }}
        />
      )}
    </div>
  )
}
