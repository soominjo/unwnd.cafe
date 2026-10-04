import { LOYALTY_CARD_SIZE, LOYALTY_TEN_OFF_AT, barSteps, formatStamps, type BarHalf } from '@/lib/loyalty'

interface LoyaltyBarProps {
  /** Stamps already on the card in progress. */
  saved: number
  /** Stamps the order on screen adds. */
  pending: number
  /** A thinner bar without the 10% / FREE marks, for lists. */
  compact?: boolean
}

const HALF_CLASSES: Record<BarHalf, string> = {
  saved: 'bg-foreground',
  new: 'bg-amber-400',
  empty: 'bg-foreground/10',
}

// A loyalty card as one thin bar of 11 steps: stamps already saved in green, this
// order's in amber, a half stamp filling half a step. Steps 6 and 11 are outlined until
// full: 10% off and the free drink.
export default function LoyaltyBar({ saved, pending, compact = false }: LoyaltyBarProps) {
  const { steps, overflow } = barSteps(saved, pending)
  return (
    <div className="space-y-1">
      <div
        role="img"
        aria-label={`${formatStamps(saved)} of ${LOYALTY_CARD_SIZE} stamps${pending > 0 ? `, plus ${formatStamps(pending)} from this order` : ''}`}
        className={`grid grid-cols-11 ${compact ? 'h-2 gap-0.5' : 'h-3 gap-[3px]'}`}
      >
        {steps.map(({ first, second }, i) => {
          const n = i + 1
          const goal = n === LOYALTY_TEN_OFF_AT || n === LOYALTY_CARD_SIZE
          return (
            <span
              key={n}
              data-step={first === second ? first : `${first}-${second}`}
              className="relative flex overflow-hidden rounded-sm"
            >
              <span className={`flex-1 ${HALF_CLASSES[first]}`} />
              <span className={`flex-1 ${HALF_CLASSES[second]}`} />
              {goal && second === 'empty' && <span className="absolute inset-0 rounded-sm ring-1 ring-inset ring-emerald-500" />}
            </span>
          )
        })}
      </div>
      {!compact && (
        <div aria-hidden="true" className="grid grid-cols-11 gap-[3px] text-[9px] font-bold tracking-wide text-emerald-700">
          <span className="col-start-6 text-center">10%</span>
          <span className="col-start-11 text-center">FREE</span>
        </div>
      )}
      {overflow > 0 && <p className="text-[11px] font-semibold text-emerald-700">Fills the card, plus {formatStamps(overflow)} on a new card.</p>}
    </div>
  )
}
