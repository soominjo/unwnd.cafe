'use client'

import type { DiscountLine, LineDiscountKind, LineDiscountScope, LineDiscounts, OrderItem } from './types'
import {
  DISCOUNT_RATES,
  DISCOUNT_RATE_LABELS,
  DISCOUNT_SHORT_NAMES,
  SCOPE_LABELS,
  lineDiscountBase,
} from './discounts'

// A 2 × 2 grid: kinds across, scopes down — ALL on the first row, SOLO on the
// second — so the two chips for one kind sit in the same column.
const CHIPS: { kind: LineDiscountKind; scope: LineDiscountScope }[] = [
  { kind: 'pwd', scope: 'all' },
  { kind: 'review', scope: 'all' },
  { kind: 'pwd', scope: 'solo' },
  { kind: 'review', scope: 'solo' },
]

interface DiscountSectionProps {
  item: OrderItem
  /** Price × qty of the add-ons attached to the item — part of every base. */
  addonsTotal: number
  /** This line's rows from the order breakdown — label and peso amount for each kind on it. */
  lineRows: DiscountLine[]
  /** Tapping the active chip clears that kind; the other scope switches it; the other kind stacks. */
  onPick: (kind: LineDiscountKind, scope: LineDiscountScope) => void
}

// The Discount section of the per-item modal. Stays open after a tap (the modal
// does not close on pick) so PWD/Senior and the review promo can be stacked and
// the computation below updates live.
export default function DiscountSection({ item, addonsTotal, lineRows, onPick }: DiscountSectionProps) {
  const current: LineDiscounts | undefined = item.discounts
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {CHIPS.map(({ kind, scope }) => {
          const active = current?.[kind] === scope
          return (
            <button
              key={`${kind}-${scope}`}
              onClick={() => onPick(kind, scope)}
              aria-pressed={active}
              className={`px-3 py-3 text-sm font-semibold rounded-full border transition-colors whitespace-nowrap ${
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
        <div className="space-y-1.5 border-t border-foreground/10 pt-3">
          {lineRows.map(d => {
            const rate = Math.round(DISCOUNT_RATES[d.kind] * 100)
            const base = d.scope === 'order' ? null : Math.round(lineDiscountBase(item, addonsTotal, d.scope))
            return (
              <div key={d.kind} className="flex justify-between items-baseline gap-3 text-sm text-emerald-700 font-semibold">
                <span>
                  {d.label}
                  {base !== null && <span className="text-foreground/45 font-normal"> · {rate}% of ₱{base}</span>}
                </span>
                <span className="tabular-nums shrink-0">−₱{d.amount}</span>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-foreground/40">No discount on this item yet.</p>
      )}
    </div>
  )
}
