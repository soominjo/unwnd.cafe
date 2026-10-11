import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/sales/payments'
import { formatPeso, pesosTyped, type SplitState } from './payState'

interface SplitPaymentProps {
  due: number
  split: SplitState
  onChange: (split: SplitState) => void
  disabled?: boolean
}

const LABEL = 'text-[10px] font-semibold uppercase tracking-[0.26em] text-foreground/55'

function MethodButtons({ value, label, onChange, disabled }: { value: PaymentMethod; label: string; onChange: (m: PaymentMethod) => void; disabled: boolean }) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-3 overflow-hidden rounded-lg border border-foreground/20">
      {PAYMENT_METHODS.map((method, i) => (
        <button
          key={method}
          type="button"
          aria-pressed={value === method}
          disabled={disabled}
          onClick={() => onChange(method)}
          className={`min-h-[42px] px-1 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed ${i > 0 ? 'border-l border-foreground/20' : ''} ${
            value === method ? 'bg-foreground text-cream' : 'bg-white text-foreground hover:bg-foreground/5'
          }`}
        >
          {PAYMENT_METHOD_LABELS[method]}
        </button>
      ))}
    </div>
  )
}

/** Two methods for one order: the first part as typed, the rest worked out for the second. */
export default function SplitPayment({ due, split, onChange, disabled = false }: SplitPaymentProps) {
  const first = split.firstAmount
  const rest = first !== null && first > 0 && first < due ? due - first : null
  return (
    <div className="space-y-2.5">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem] sm:items-end">
        <div className="min-w-0 space-y-1.5">
          <p className={LABEL}>First part</p>
          <MethodButtons value={split.first} label="First part paid by" disabled={disabled} onChange={m => onChange({ ...split, first: m })} />
        </div>
        <label htmlFor="split-first-amount" className="flex min-h-[44px] items-center gap-2 rounded-md border border-foreground/18 bg-white px-3 focus-within:border-foreground/60">
          <span className="font-semibold text-foreground/50">₱</span>
          <input
            id="split-first-amount"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="Amount"
            value={split.firstText}
            disabled={disabled}
            onChange={e => onChange({ ...split, firstText: e.target.value, firstAmount: pesosTyped(e.target.value) })}
            className="min-w-0 flex-1 bg-transparent py-2 text-[15px] tabular-nums text-foreground placeholder:text-foreground/35 focus:outline-none"
          />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem] sm:items-end">
        <div className="min-w-0 space-y-1.5">
          <p className={LABEL}>The rest</p>
          <MethodButtons value={split.rest} label="The rest paid by" disabled={disabled} onChange={m => onChange({ ...split, rest: m })} />
        </div>
        <div className="flex min-h-[44px] flex-col justify-center sm:items-end">
          <span className="text-[17px] font-bold tabular-nums text-foreground">{rest !== null ? formatPeso(rest) : '—'}</span>
          <span className="text-[11px] text-foreground/55">worked out for you</span>
        </div>
      </div>
      {rest !== null && first !== null && split.first !== split.rest && (
        <p className="text-[13px] font-semibold text-emerald-700">
          ✓ {formatPeso(first)} + {formatPeso(rest)} = {formatPeso(due)}, the full total
        </p>
      )}
    </div>
  )
}
