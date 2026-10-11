import { PAYMENT_METHOD_LABELS, samePesos } from '@/lib/sales/payments'
import { formatPeso, type PayCheck, type PayState } from './payState'

interface PaymentReadoutProps {
  due: number
  pay: PayState
  check: PayCheck
}

const LABEL = 'text-xs font-semibold uppercase tracking-[0.3em] text-foreground/55'

/** Under the total: the change, how much is short, the method, or a split's two parts. */
export default function PaymentReadout({ due, pay, check }: PaymentReadoutProps) {
  if (samePesos(due, 0)) return <Readout label="Payment" detail="Nothing to pay" />
  if (pay.split) {
    if (!check.ok) return <Readout label="Split" detail="Two methods" />
    return (
      <div className="space-y-1">
        <p className={LABEL}>Split</p>
        <p className="text-[17px] font-bold text-foreground">
          {check.payments.map(p => `${PAYMENT_METHOD_LABELS[p.method]} ${formatPeso(p.amount)}`).join(' + ')}
        </p>
        <p className="text-[12.5px] font-semibold text-emerald-700">✓ Comes to the full total</p>
      </div>
    )
  }
  if (!pay.method) return <Readout label="Payment" detail="Not chosen yet" />
  if (pay.method === 'cash') {
    if (!check.ok) {
      return (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-red-600">Short</p>
          <p className="font-display text-3xl font-bold tabular-nums text-red-600">{formatPeso(check.short ?? 0)}</p>
        </div>
      )
    }
    return (
      <div className="space-y-1">
        <p className={LABEL}>Change</p>
        <p className="font-display text-3xl font-semibold tracking-tight text-foreground">{formatPeso(check.change)}</p>
        <p className="text-[12.5px] text-foreground/55">{pay.received === null ? 'Exact amount' : `Cash received ${formatPeso(pay.received)}`}</p>
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <p className={LABEL}>Paid by</p>
      <p className="text-[22px] font-bold text-foreground">{PAYMENT_METHOD_LABELS[pay.method]}</p>
      <p className="text-[12.5px] text-foreground/55">Exact amount, no change</p>
    </div>
  )
}

function Readout({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="space-y-1">
      <p className={LABEL}>{label}</p>
      <p className="text-[15px] font-medium text-foreground/55">{detail}</p>
    </div>
  )
}
