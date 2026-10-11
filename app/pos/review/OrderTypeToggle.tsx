import { ORDER_TYPES, ORDER_TYPE_LABELS, type OrderType } from '@/lib/sales/payments'
import { BagIcon, CupIcon } from '../sales/icons'

interface OrderTypeToggleProps {
  value: OrderType
  onChange: (value: OrderType) => void
  /** While the order saves: nothing on it changes. */
  disabled?: boolean
}

/** "Dine in or take out?" on the review screen: two compact buttons, the chosen one filled. */
export default function OrderTypeToggle({ value, onChange, disabled = false }: OrderTypeToggleProps) {
  return (
    <div className="space-y-2">
      <p id="order-type-question" className="text-[10px] font-semibold uppercase tracking-[0.26em] text-foreground/55">
        Dine in or take out?
      </p>
      <div role="group" aria-labelledby="order-type-question" className="grid grid-cols-2 overflow-hidden rounded-lg border border-foreground/20">
        {ORDER_TYPES.map((type, i) => {
          const chosen = value === type
          const Icon = type === 'take-out' ? BagIcon : CupIcon
          return (
            <button
              key={type}
              type="button"
              aria-pressed={chosen}
              disabled={disabled}
              onClick={() => onChange(type)}
              className={`flex min-h-[42px] items-center justify-center gap-2 text-[13px] font-bold transition-colors disabled:cursor-not-allowed ${
                i > 0 ? 'border-l border-foreground/20' : ''
              } ${chosen ? 'bg-foreground text-cream' : 'bg-white text-foreground hover:bg-foreground/5'}`}
            >
              <Icon width={16} height={16} />
              {ORDER_TYPE_LABELS[type]}
            </button>
          )
        })}
      </div>
      {value === 'take-out' && (
        <p className="flex items-center gap-1.5 text-xs text-foreground/60">
          <BagIcon width={14} height={14} className="shrink-0" />
          The kitchen ticket will say TAKE OUT.
        </p>
      )}
    </div>
  )
}
