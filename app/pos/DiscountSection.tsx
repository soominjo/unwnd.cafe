'use client'

import type { DiscountLine, LineDiscountKind, LineDiscountScope, LineDiscounts } from './types'
import { DISCOUNT_RATE_LABELS, DISCOUNT_SHORT_NAMES, SCOPE_LABELS } from './discounts'

// A 2 × 2 grid: kinds across, scopes down — ALL on the first row, SOLO on the
// second — so the two chips for one kind sit in the same column.
const CHIPS: { kind: LineDiscountKind; scope: LineDiscountScope }[] = [
  { kind: 'pwd', scope: 'all' },
  { kind: 'review', scope: 'all' },
  { kind: 'pwd', scope: 'solo' },
  { kind: 'review', scope: 'solo' },
]

interface DiscountSectionProps {
  /** The discounts the line carries right now, by kind. */
  current: LineDiscounts | undefined
  /** This line's rows from the order breakdown — label and peso amount for each kind on it. */
  lineRows: DiscountLine[]
  /** Tapping the active chip clears that kind; the other scope switches it; the other kind stacks. */
  onPick: (kind: LineDiscountKind, scope: LineDiscountScope) => void
}

// The Discount section of the per-item modal. Stays open after a tap (the modal
// does not close on pick) so PWD/Senior and the review promo can be stacked and
// the amounts below update live.
export default function DiscountSection({ current, lineRows, onPick }: DiscountSectionProps) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-foreground/50">
        ALL = every unit ordered · SOLO = one unit only · both kinds can stack · tap an active chip to remove it
      </p>
      <div className="grid grid-cols-2 gap-2">
        {CHIPS.map(({ kind, scope }) => {
          const active = current?.[kind] === scope
          return (
            <button
              key={`${kind}-${scope}`}
              onClick={() => onPick(kind, scope)}
              aria-pressed={active}
              className={`px-3 py-2.5 text-xs font-semibold rounded-full border transition-colors whitespace-nowrap ${
                active
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'border-foreground/15 text-foreground/65 hover:border-emerald-400 hover:text-emerald-600'
              }`}
            >
              {DISCOUNT_SHORT_NAMES[kind]} {DISCOUNT_RATE_LABELS[kind]} · {SCOPE_LABELS[scope]}
            </button>
          )
        })}
      </div>
      {lineRows.length > 0 ? (
        <div className="space-y-1 border-t border-foreground/10 pt-2">
          {lineRows.map(d => (
            <div key={d.kind} className="flex justify-between text-xs text-emerald-700 font-semibold">
              <span>{d.label}</span>
              <span className="tabular-nums">−₱{d.amount}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-foreground/40">No discount on this item yet.</p>
      )}
    </div>
  )
}
