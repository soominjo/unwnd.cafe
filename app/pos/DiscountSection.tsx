'use client'

import type { DiscountLine, LineDiscountKind, LineDiscountScope, LineDiscounts, OrderItem } from './types'
import {
  DISCOUNT_RATES,
  DISCOUNT_RATE_LABELS,
  DISCOUNT_SHORT_NAMES,
  SCOPE_LABELS,
  lineDiscountBase,
} from './discounts'

// SOLO only, side by side: each discount covers one unit of the line (one PWD/Senior customer,
// one review). Lines saved with ALL on older orders keep their rows; the POS no longer offers it.
const CHIPS: { kind: LineDiscountKind; scope: LineDiscountScope }[] = [
  { kind: 'pwd', scope: 'solo' },
  { kind: 'review', scope: 'solo' },
]

interface DiscountSectionProps {
  item: OrderItem
  /** Price × qty of the add-ons attached to the item — part of every base. */
  addonsTotal: number
  /** This line's rows from the order breakdown — label and peso amount for each kind on it. */
  lineRows: DiscountLine[]
  /** Tapping the active chip clears that kind; the other kind stacks. */
  onPick: (kind: LineDiscountKind, scope: LineDiscountScope) => void
  /** The loyalty 10% is on the order: one 10% per order, so Google Review can't be added. */
  reviewLocked: boolean
  /** 1 when one unit of this line is the loyalty free drink; other discounts cover the rest. */
  freeUnits: number
}

// The Discount section of the per-item modal. Stays open after a tap (the modal
// does not close on pick) so PWD/Senior and the review promo can be stacked and
// the computation below updates live.
export default function DiscountSection({ item, addonsTotal, lineRows, onPick, reviewLocked, freeUnits }: DiscountSectionProps) {
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
              disabled={kind === 'review' && reviewLocked}
              className={`px-3 py-3 text-sm font-semibold rounded-full border transition-colors whitespace-nowrap disabled:opacity-35 disabled:cursor-not-allowed ${
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
      {reviewLocked && (
        <p className="text-xs text-foreground/50">The loyalty 10% is on this order, so Google Review can’t be added too.</p>
      )}
      {lineRows.length > 0 ? (
        <div className="space-y-1.5 border-t border-foreground/10 pt-3">
          {lineRows.map(d => {
            if (d.kind === 'free') {
              return (
                <div key={d.kind} className="flex justify-between items-baseline gap-3 text-sm text-emerald-700 font-semibold">
                  <span>
                    {d.label}
                    <span className="text-foreground/45 font-normal"> · one {item.name}</span>
                  </span>
                  <span className="tabular-nums shrink-0">−₱{d.amount}</span>
                </div>
              )
            }
            const rate = Math.round(DISCOUNT_RATES[d.kind] * 100)
            const base = Math.round(lineDiscountBase(item, addonsTotal, d.scope, freeUnits))
            return (
              <div key={d.kind} className="flex justify-between items-baseline gap-3 text-sm text-emerald-700 font-semibold">
                <span>
                  {d.label}
                  <span className="text-foreground/45 font-normal">
                    {' '}· {rate}% of ₱{base}
                    {/* This mode does not list the add-ons, so say where the extra pesos in the base came from. */}
                    {addonsTotal > 0 && ' incl. add-ons'}
                  </span>
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
