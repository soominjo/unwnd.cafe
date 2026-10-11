import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, samePesos, type PaymentMethod } from '@/lib/sales/payments'
import CashAmounts from './CashAmounts'
import SplitPayment from './SplitPayment'
import { endSplit, formatPeso, pickMethod, startSplit, type PayState } from './payState'

interface PaymentPickerProps {
  /** What this payment covers: the order, or the new lines while adding to a saved one. */
  due: number
  pay: PayState
  onChange: (pay: PayState) => void
  /** While the order saves: nothing on it changes. */
  disabled?: boolean
}

/** What each method covers, under its name. */
const METHOD_HINTS: Record<PaymentMethod, string> = { cash: 'Bills and coins', ewallet: 'GCash · Maya', card: 'Debit · Credit' }

const NOTE = 'rounded-lg bg-foreground/[0.045] px-3 py-2.5 text-[13.5px] text-foreground'

/**
 * "How are they paying?": Cash, E-wallet or Card (compact tiles, words only), then what that
 * method needs. "Split payment" swaps the tiles for two parts. A ₱0 order asks for nothing.
 */
export default function PaymentPicker({ due, pay, onChange, disabled = false }: PaymentPickerProps) {
  if (samePesos(due, 0)) {
    return <p className={NOTE}>Nothing to pay: the order comes to ₱0.</p>
  }
  return (
    <div className="space-y-3">
      <div className="flex min-h-[30px] flex-wrap items-center justify-between gap-2">
        <p id="payment-question" className="text-[10px] font-semibold uppercase tracking-[0.26em] text-foreground/55">How are they paying?</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(pay.split ? endSplit(pay) : startSplit(pay))}
          className="px-0.5 py-1 text-[12.5px] font-bold text-sky-700 underline underline-offset-[3px] hover:text-sky-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pay.split ? 'Back to one method' : 'Split payment'}
        </button>
      </div>

      {pay.split ? (
        <SplitPayment due={due} split={pay.split} disabled={disabled} onChange={split => onChange({ ...pay, split })} />
      ) : (
        <div role="group" aria-labelledby="payment-question" className="grid grid-cols-3 gap-2">
          {PAYMENT_METHODS.map(method => {
            const chosen = pay.method === method
            return (
              <button
                key={method}
                type="button"
                aria-pressed={chosen}
                disabled={disabled}
                onClick={() => onChange(pickMethod(pay, method))}
                className={`relative flex min-h-[54px] flex-col items-center justify-center rounded-lg border-[1.5px] px-1.5 py-1.5 text-center transition-colors disabled:cursor-not-allowed ${
                  chosen ? 'border-foreground bg-foreground text-cream' : 'border-foreground/20 bg-white text-foreground hover:border-foreground/40'
                }`}
              >
                <span className="text-[14.5px] font-bold leading-tight">{PAYMENT_METHOD_LABELS[method]}</span>
                <span className={`text-[11px] leading-tight ${chosen ? 'text-cream/75' : 'text-foreground/55'}`}>{METHOD_HINTS[method]}</span>
                {chosen && (
                  <span aria-hidden="true" className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-cream text-[10px] font-black text-foreground">
                    ✓
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {!pay.split && pay.method === 'cash' && <CashAmounts due={due} pay={pay} onChange={onChange} disabled={disabled} />}
      {!pay.split && pay.method === 'ewallet' && (
        <p className={NOTE}>
          Ask for <b>{formatPeso(due)}</b> by GCash or Maya. Tap Complete + Print once it shows in the app.
        </p>
      )}
      {!pay.split && pay.method === 'card' && (
        <p className={NOTE}>
          Charge <b>{formatPeso(due)}</b> on the card terminal. Tap Complete + Print once it’s approved.
        </p>
      )}
    </div>
  )
}
