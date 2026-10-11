import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/sales/payments'
import { METHOD_COLORS } from './paymentColors'

interface MethodFixProps {
  amount: number
  /** The method it was taken under: the other two are offered. */
  current: PaymentMethod
  busy: boolean
  /** Why the last move was not saved, if it wasn't. */
  error: string | null
  onPick: (method: PaymentMethod) => void
  onCancel: () => void
}

const BUTTON = 'inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-50'

/** A payment taken under the wrong method: "Move ₱200 to [Cash] [Card] Cancel". */
export default function MethodFix({ amount, current, busy, error, onPick, onCancel }: MethodFixProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-y border-sky-200 bg-sky-50 px-3 py-2 text-[13px] text-foreground">
      <span>Move ₱{amount.toLocaleString('en-PH')} to</span>
      {PAYMENT_METHODS.filter(m => m !== current).map(method => (
        <button key={method} type="button" disabled={busy} onClick={() => onPick(method)} className={`${BUTTON} border-foreground/20 bg-white text-foreground hover:border-foreground/45`}>
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: METHOD_COLORS[method] }} />
          {PAYMENT_METHOD_LABELS[method]}
        </button>
      ))}
      <button type="button" disabled={busy} onClick={onCancel} className={`${BUTTON} border-transparent text-foreground/55 hover:bg-foreground/5 hover:text-foreground`}>
        Cancel
      </button>
      {busy && <span className="text-[11px] uppercase tracking-widest text-foreground/45">Saving…</span>}
      {error && <span role="alert" className="text-xs font-semibold text-red-700">{error}</span>}
    </div>
  )
}
