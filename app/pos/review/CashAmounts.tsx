import { cashSuggestions, formatPeso, pesosTyped, type PayState } from './payState'

interface CashAmountsProps {
  due: number
  pay: PayState
  onChange: (pay: PayState) => void
  disabled?: boolean
}

const CHIP = 'flex min-h-[48px] flex-col items-center justify-center rounded-md border px-1 text-sm font-bold tabular-nums leading-tight transition-colors disabled:cursor-not-allowed'
const chipTone = (on: boolean) => (on ? 'border-foreground bg-foreground text-cream' : 'border-foreground/18 bg-white text-foreground hover:border-foreground/40')

/**
 * What a cash customer handed over: Exact, the next ₱50 and ₱100 and the usual bills, or any
 * amount typed in Other. Something typed that isn't an amount counts as nothing handed over, so
 * the screen shows it as short rather than taking it as exact.
 */
export default function CashAmounts({ due, pay, onChange, disabled = false }: CashAmountsProps) {
  const exact = pay.received === null && pay.receivedText === ''
  return (
    <div className="space-y-2">
      <p id="cash-received-label" className="text-[10px] font-semibold uppercase tracking-[0.26em] text-foreground/55">Cash received</p>
      <div role="group" aria-labelledby="cash-received-label" className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5">
        <button type="button" aria-pressed={exact} disabled={disabled} onClick={() => onChange({ ...pay, received: null, receivedText: '' })} className={`${CHIP} ${chipTone(exact)}`}>
          <span className={`text-[9.5px] font-semibold uppercase tracking-[0.16em] ${exact ? 'text-cream/75' : 'text-foreground/55'}`}>Exact</span>
          {formatPeso(due)}
        </button>
        {cashSuggestions(due).map(amount => {
          const on = pay.receivedText === '' && pay.received === amount
          return (
            <button key={amount} type="button" aria-pressed={on} disabled={disabled} onClick={() => onChange({ ...pay, received: amount, receivedText: '' })} className={`${CHIP} ${chipTone(on)}`}>
              {formatPeso(amount)}
            </button>
          )
        })}
      </div>
      <label htmlFor="cash-received-other" className="flex min-h-[46px] items-center gap-2 rounded-md border border-foreground/18 bg-white px-3 focus-within:border-foreground/60">
        <span className="font-semibold text-foreground/50">₱</span>
        <input
          id="cash-received-other"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="Other amount"
          value={pay.receivedText}
          disabled={disabled}
          onChange={e => {
            const text = e.target.value
            onChange({ ...pay, receivedText: text, received: pesosTyped(text) ?? (text.trim() ? 0 : null) })
          }}
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] max-sm:text-base tabular-nums text-foreground placeholder:text-foreground/35 focus:outline-none"
        />
      </label>
    </div>
  )
}
