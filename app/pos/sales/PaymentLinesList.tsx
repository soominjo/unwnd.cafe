import type { PaymentMethod } from '@/lib/sales/payments'
import type { PaymentLine } from '@/lib/sales/paymentTally'
import { formatPHClock } from './dateRange'
import { PencilIcon } from './icons'
import MethodFix from './MethodFix'
import MovedNote from './MovedNote'

interface PaymentLinesListProps {
  method: PaymentMethod
  /** This method's payments, newest first. */
  lines: PaymentLine[]
  /** The payment whose move row is open (`saleId:paymentKey`). */
  fixingKey: string | null
  busyKey: string | null
  error: string | null
  onEdit: (key: string | null) => void
  onMove: (line: PaymentLine, method: PaymentMethod) => void
}

/** What a method's total should match at closing. */
const CHECK_AGAINST: Record<PaymentMethod, string> = {
  cash: 'the cash in the drawer, minus the starting float',
  ewallet: 'the GCash and Maya apps',
  card: 'the card terminal’s report',
}

export const lineKey = (line: PaymentLine) => `${line.saleId}:${line.paymentKey}`

/** Every payment by one method, under its row in the tally: each with Edit, to move one taken wrongly. */
export default function PaymentLinesList({ method, lines, fixingKey, busyKey, error, onEdit, onMove }: PaymentLinesListProps) {
  if (lines.length === 0) {
    return <p className="ml-8 border-l-2 border-border py-2 pl-3 text-xs text-foreground/55">No payments by this method yet.</p>
  }
  return (
    <div className="ml-8 border-l-2 border-border">
      <ul className="divide-y divide-border/70">
        {lines.map(line => {
          const key = lineKey(line)
          return (
            <li key={key}>
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2 pl-3 pr-1 text-[13px]">
                <span className="min-w-0">
                  <span className="tabular-nums text-foreground/55">{formatPHClock(line.paidAt)}</span>
                  {' · '}
                  {line.name ? <span className="font-semibold text-foreground">{line.name}</span> : <span className="italic text-foreground/45">No name</span>}
                  {line.partOfMore && <span className="block text-[11.5px] text-foreground/55">part of the ₱{line.orderTotal.toLocaleString('en-PH')} order</span>}
                  <MovedNote payment={line} paidAt={line.paidAt} className="block text-[11.5px] italic text-foreground/60" />
                </span>
                <span className="font-semibold tabular-nums text-foreground">₱{line.amount.toLocaleString('en-PH')}</span>
                <button
                  type="button"
                  aria-expanded={fixingKey === key}
                  aria-label={`Edit the method of the ₱${line.amount.toLocaleString('en-PH')} payment${line.name ? ` from ${line.name}` : ''}`}
                  onClick={() => onEdit(fixingKey === key ? null : key)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-foreground/20 bg-white px-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/75 hover:border-foreground/45 hover:text-foreground"
                >
                  <PencilIcon width={12} height={12} />
                  Edit
                </button>
              </div>
              {fixingKey === key && (
                <MethodFix
                  amount={line.amount}
                  current={line.method}
                  busy={busyKey === key}
                  error={error}
                  onPick={m => onMove(line, m)}
                  onCancel={() => onEdit(null)}
                />
              )}
            </li>
          )
        })}
      </ul>
      <p className="py-2 pl-3 text-xs text-foreground/55">Check these against {CHECK_AGAINST[method]}.</p>
    </div>
  )
}
