'use client'

import type { LineDiscountKind } from './types'
import { DISCOUNT_LABELS } from './discounts'

const KINDS: LineDiscountKind[] = ['pwd', 'review']

interface DiscountPickerRowProps {
  itemName: string
  /** The discount the line carries right now, if any. */
  current: LineDiscountKind | undefined
  /** Tapping the chip already active clears the discount; the parent closes the row after any tap. */
  onPick: (kind: LineDiscountKind) => void
}

// Inline "attached to the selected item" picker for the one discount a line can
// carry — same mechanic and look as the Customize row: whichever item's "%" was
// tapped is what a chip applies to, rendered in normal flow inside the panel.
export default function DiscountPickerRow({ itemName, current, onPick }: DiscountPickerRowProps) {
  return (
    <div className="px-6 py-2 border-t border-foreground/10 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-[0.25em] text-foreground/45 font-semibold">Discount</p>
        <p className="text-[10px] text-emerald-600 font-semibold truncate max-w-[55%] text-right">→ {itemName}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {KINDS.map(kind => {
          const active = current === kind
          return (
            <button
              key={kind}
              onClick={() => onPick(kind)}
              aria-pressed={active}
              className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-full border transition-colors ${
                active
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'border-foreground/15 text-foreground/65 hover:border-emerald-400 hover:text-emerald-600'
              }`}
            >
              {DISCOUNT_LABELS[kind]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
