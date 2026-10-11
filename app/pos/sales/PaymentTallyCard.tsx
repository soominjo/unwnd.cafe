'use client'

import { useState } from 'react'
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/sales/payments'
import { wholeShares, type PaymentLine, type PaymentTally } from '@/lib/sales/paymentTally'
import { METHOD_COLORS } from './paymentColors'
import PaymentLinesList, { lineKey } from './PaymentLinesList'
import { AlertIcon, CheckIcon } from './icons'

type RowId = PaymentMethod | 'notRecorded'

interface PaymentTallyCardProps {
  tally: PaymentTally
  revenue: number
  /** Every payment in the period, or null on a long period (they aren't listed then). */
  lines: PaymentLine[] | null
  /** Moves one payment to another method: resolves to null when done, else to why not. */
  onChangeMethod: (saleId: string, paymentKey: string, method: PaymentMethod) => Promise<string | null>
}

const LABELS: Record<RowId, string> = { ...PAYMENT_METHOD_LABELS, notRecorded: 'Not recorded' }
const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`
const ordersText = (n: number) => `${n} ${n === 1 ? 'order' : 'orders'}`

/**
 * How the period was paid: a stacked bar and a row per method, which always add up to Revenue (what
 * no payment covers counts as Not recorded). On a day or a short range each method's row opens its
 * payments, newest first, to check against the drawer or the apps and to move one taken wrongly.
 */
export default function PaymentTallyCard({ tally, revenue, lines, onChangeMethod }: PaymentTallyCardProps) {
  const [open, setOpen] = useState<PaymentMethod | null>(null)
  const [fixingKey, setFixingKey] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tip, setTip] = useState<RowId | null>(null)

  const rows: RowId[] = [...PAYMENT_METHODS, ...(tally.notRecorded.amount > 0 ? ['notRecorded' as const] : [])]
  const amounts = rows.map(row => tally[row].amount)
  const shares = wholeShares(amounts)
  const counted = amounts.reduce((sum, a) => sum + a, 0)
  const off = Math.round(revenue - counted)
  // Where each bar segment starts and how wide it is, in percent of the bar: for its tooltip.
  const spans = rows.map((_, i) => ({
    start: counted > 0 ? (amounts.slice(0, i).reduce((s, a) => s + a, 0) / counted) * 100 : 0,
    width: counted > 0 ? (amounts[i] / counted) * 100 : 0,
  }))
  const tipAt = tip ? rows.indexOf(tip) : -1

  function toggle(method: PaymentMethod) {
    setOpen(open === method ? null : method)
    setFixingKey(null)
    setError(null)
  }

  async function move(line: PaymentLine, method: PaymentMethod) {
    const key = lineKey(line)
    setBusyKey(key)
    setError(null)
    const problem = await onChangeMethod(line.saleId, line.paymentKey, method)
    setBusyKey(null)
    if (problem) setError(problem)
    else setFixingKey(null)
  }

  return (
    <section aria-labelledby="tally-title" className="min-w-0 space-y-4 rounded-lg border border-border bg-white/80 p-4 sm:p-5">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <h2 id="tally-title" className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60">How they paid</h2>
        {off === 0 ? (
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <CheckIcon width={14} height={14} />
            Adds up to {peso(revenue)}, same as Revenue
          </p>
        ) : (
          <p role="alert" className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
            <AlertIcon width={14} height={14} />
            Off by {peso(Math.abs(off))}: check the orders on Recent Orders and Completed
          </p>
        )}
      </header>

      <div className="relative">
        <div role="group" aria-label="Share of revenue by method" className="flex h-5.5 gap-0.5">
          {rows.map((row, i) =>
            amounts[i] > 0 ? (
              <span
                key={row}
                tabIndex={0}
                aria-label={`${LABELS[row]}: ${peso(amounts[i])}, ${shares[i]}%, ${ordersText(tally[row].orders)}`}
                onPointerEnter={() => setTip(row)}
                onPointerLeave={() => setTip(null)}
                onFocus={() => setTip(row)}
                onBlur={() => setTip(null)}
                className="h-full min-w-1.5 last:rounded-r focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50"
                style={{ flexGrow: amounts[i], flexBasis: 0, background: METHOD_COLORS[row] }}
              />
            ) : null,
          )}
        </div>
        {tip && tipAt >= 0 && (
          <div
            role="tooltip"
            className="pointer-events-none absolute bottom-[calc(100%+8px)] z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-cream shadow-lg"
            style={{ left: `${Math.min(88, Math.max(12, spans[tipAt].start + spans[tipAt].width / 2))}%` }}
          >
            <p className="font-display text-[15px] font-bold leading-tight">{peso(amounts[tipAt])}</p>
            <p className="text-[11.5px] text-cream/75">{LABELS[tip]} · {shares[tipAt]}% · {ordersText(tally[tip].orders)}</p>
          </div>
        )}
      </div>

      <div>
        {rows.map((row, i) => {
          const opens = lines !== null && row !== 'notRecorded'
          const isOpen = opens && open === row
          const content = (
            <>
              <span aria-hidden="true" className="h-3 w-3 rounded-[3px]" style={{ background: METHOD_COLORS[row] }} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{LABELS[row]}</span>
                <span className="block text-[11.5px] text-foreground/55">{ordersText(tally[row].orders)}</span>
              </span>
              <span className="text-right text-[15px] font-bold tabular-nums text-foreground">{peso(amounts[i])}</span>
              <span className="text-right text-[12.5px] tabular-nums text-foreground/55">{shares[i]}%</span>
              <span aria-hidden="true" className={`text-foreground/40 transition-transform ${isOpen ? 'rotate-90' : ''}`}>{opens ? '›' : ''}</span>
            </>
          )
          const grid = 'grid w-full grid-cols-[12px_minmax(0,1fr)_auto_3.2rem_16px] items-center gap-3 rounded-md px-2 py-1.5 text-left min-h-12'
          return (
            <div key={row}>
              {opens ? (
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => toggle(row)}
                  className={`${grid} transition-colors ${isOpen ? 'bg-foreground/8 ring-1 ring-inset ring-foreground/15' : 'hover:bg-foreground/5'}`}
                >
                  {content}
                </button>
              ) : (
                <div className={grid}>{content}</div>
              )}
              {isOpen && lines && (
                <PaymentLinesList
                  method={row}
                  lines={lines.filter(line => line.method === row)}
                  fixingKey={fixingKey}
                  busyKey={busyKey}
                  error={error}
                  onEdit={key => {
                    setFixingKey(key)
                    setError(null)
                  }}
                  onMove={move}
                />
              )}
            </div>
          )
        })}
        <div className="mt-1 grid min-h-10 grid-cols-[12px_minmax(0,1fr)_auto_3.2rem_16px] items-center gap-3 border-t border-border px-2 pt-1">
          <span />
          <span className="text-sm font-semibold text-foreground">Total</span>
          <span className="text-right text-[15px] font-bold tabular-nums text-foreground">{peso(counted)}</span>
          <span className="text-right text-[12.5px] tabular-nums text-foreground/55">100%</span>
          <span />
        </div>
      </div>

      <p className="max-w-[72ch] text-xs text-foreground/55">
        {lines === null ? 'Pick Today, Yesterday or a few days to list each payment. ' : 'Tap a method to list its payments. '}
        Cash should match the drawer minus the starting float, E-wallet the GCash and Maya apps, and Card the terminal’s report.
        {tally.notRecorded.amount > 0 && ' Orders from before payments were recorded count as Not recorded, so the totals still add up.'}
      </p>
    </section>
  )
}
