import { LOYALTY_CARD_SIZE, LOYALTY_TEN_OFF_AT, barSteps, type BarStep } from '@/lib/loyalty'

interface LoyaltyBarProps {
  /** Stamps already on the card in progress. */
  saved: number
  /** Stamps the order on screen adds. */
  pending: number
  /** A thinner bar without the 10% / FREE marks, for lists. */
  compact?: boolean
}

const STEP_CLASSES: Record<BarStep, string> = {
  saved: 'bg-foreground',
  new: 'bg-amber-400',
  empty: 'bg-foreground/10',
}

// A loyalty card as one thin bar of 11 steps: stamps already saved in green, this
// order's in amber. Steps 6 and 11 are outlined while empty: 10% off and the free drink.
export default function LoyaltyBar({ saved, pending, compact = false }: LoyaltyBarProps) {
  const { steps, overflow } = barSteps(saved, pending)
  return (
    <div className="space-y-1">
      <div
        role="img"
        aria-label={`${saved} of ${LOYALTY_CARD_SIZE} stamps${pending > 0 ? `, plus ${pending} from this order` : ''}`}
        className={`grid grid-cols-11 ${compact ? 'h-2 gap-0.5' : 'h-3 gap-[3px]'}`}
      >
        {steps.map((step, i) => {
          const n = i + 1
          const goal = n === LOYALTY_TEN_OFF_AT || n === LOYALTY_CARD_SIZE
          return (
            <span
              key={n}
              data-step={step}
              className={`rounded-sm ${STEP_CLASSES[step]} ${goal && step === 'empty' ? 'ring-1 ring-inset ring-emerald-500' : ''}`}
            />
          )
        })}
      </div>
      {!compact && (
        <div aria-hidden="true" className="grid grid-cols-11 gap-[3px] text-[9px] font-bold tracking-wide text-emerald-700">
          <span className="col-start-6 text-center">10%</span>
          <span className="col-start-11 text-center">FREE</span>
        </div>
      )}
      {overflow > 0 && <p className="text-[11px] font-semibold text-emerald-700">Fills the card, plus {overflow} on a new card.</p>}
    </div>
  )
}
