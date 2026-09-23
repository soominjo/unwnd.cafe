'use client'

import type { LineDiscountKind, LineDiscountScope, LineDiscounts } from './types'
import { DISCOUNT_RATE_LABELS, DISCOUNT_SHORT_NAMES, SCOPE_LABELS } from './discounts'

// Laid out as a 2 × 2 grid: kinds across, scopes down — ALL on the first row,
// SOLO on the second — so the two chips for one kind sit in the same column.
const CHIPS: { kind: LineDiscountKind; scope: LineDiscountScope }[] = [
  { kind: 'pwd', scope: 'all' },
  { kind: 'review', scope: 'all' },
  { kind: 'pwd', scope: 'solo' },
  { kind: 'review', scope: 'solo' },
]

interface DiscountPickerRowProps {
  itemName: string
  /** The discounts the line carries right now, by kind. */
  current: LineDiscounts | undefined
  /** Tapping the active chip clears that kind; the other scope switches it; the other kind stacks. */
  onPick: (kind: LineDiscountKind, scope: LineDiscountScope) => void
}

// Inline "attached to the selected item" picker — same mechanic and look as the
// Customize row: whichever item's "%" was tapped is what a chip applies to,
// rendered in normal flow inside the panel. Stays open after a tap so PWD and
// the review promo can be stacked without reopening it.
export default function DiscountPickerRow({ itemName, current, onPick }: DiscountPickerRowProps) {
  return (
    <div className="px-6 py-2 border-t border-foreground/10 shrink-0">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] uppercase tracking-[0.25em] text-foreground/45 font-semibold">Discount</p>
        <p className="text-[10px] text-emerald-600 font-semibold truncate max-w-[55%] text-right">→ {itemName}</p>
      </div>
      <p className="text-[10px] text-foreground/40 mb-2">ALL = every unit ordered · SOLO = one unit only · both kinds can stack</p>
      <div className="grid grid-cols-2 gap-2">
        {CHIPS.map(({ kind, scope }) => {
          const active = current?.[kind] === scope
          return (
            <button
              key={`${kind}-${scope}`}
              onClick={() => onPick(kind, scope)}
              aria-pressed={active}
              className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-full border transition-colors whitespace-nowrap ${
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
    </div>
  )
}
