'use client'

import { Fragment } from 'react'
import { variantClass, groupOrderItems } from './utils'
import type { OrderItem, LineDiscount } from './types'

interface OrderReviewModalProps {
  orderItems: OrderItem[]
  itemCount: number
  total: number
  grandTotal: number
  foodDiscountLines: LineDiscount[]
  drinkDiscountLines: LineDiscount[]
  discountAmount: number
  payment: number | null
  notes: string
  isSubmitting: boolean
  pendingAction: 'plain' | 'receipt' | null
  submitError: string | null
  onCancel: () => void
  onCompletePlain: () => void
  onCompleteReceipt: () => void
}

// Full-height review page (not a floating modal) shown to the customer
// before the cashier taps charge, laid out as a single centered column.
// The item list scrolls on its own; the totals, payment, change, and action
// buttons live in a footer pinned to the bottom of the viewport — a long
// order should never hide what the customer actually owes.
export default function OrderReviewModal({
  orderItems,
  itemCount,
  total,
  grandTotal,
  foodDiscountLines,
  drinkDiscountLines,
  discountAmount,
  payment,
  notes,
  isSubmitting,
  pendingAction,
  submitError,
  onCancel,
  onCompletePlain,
  onCompleteReceipt,
}: OrderReviewModalProps) {
  const { parentItems, addonsByParent, orphanAddons } = groupOrderItems(orderItems)
  const short = payment !== null && payment < grandTotal

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col min-h-0">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-foreground/10 shrink-0">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-foreground/55 font-semibold">Review Your Order</p>
            <p className="text-foreground/45 text-sm mt-1">
              {itemCount} item{itemCount !== 1 ? 's' : ''} · {orderItems.length} line{orderItems.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            title="Cancel"
            className="text-foreground/50 hover:text-foreground text-xl leading-none w-10 h-10 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body: item list + notes */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3">
          <div className="divide-y divide-foreground/[0.07]">
            {parentItems.map(item => (
              <Fragment key={item.lineId}>
                <div className="flex items-start justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-base font-semibold leading-tight text-foreground flex items-center flex-wrap gap-x-3 gap-y-1">
                      <span>{item.name}</span>
                      {item.qty > 1 && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-400 text-foreground text-sm font-black tabular-nums tracking-wide shadow-sm">
                          ×{item.qty}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {item.variant && (
                        <span className={`text-xs uppercase tracking-wider font-bold ${variantClass(item.variant)}`}>
                          {item.variant}
                        </span>
                      )}
                      {item.pwdDiscounted && (
                        <span className="text-xs text-emerald-600 font-semibold tracking-wide">PWD/Senior −20%</span>
                      )}
                    </div>
                    {item.note && (
                      <p className="text-xs text-amber-600 font-semibold tracking-wide mt-1">📝 {item.note}</p>
                    )}
                  </div>
                  <span className="text-base tabular-nums font-bold text-foreground shrink-0">
                    ₱{(item.price * item.qty).toFixed(0)}
                  </span>
                </div>
                {(addonsByParent.get(item.lineId) ?? []).map(addon => (
                  <div key={addon.lineId} className="flex items-center justify-between gap-4 py-2 pl-4 border-l-2 border-l-foreground/10 ml-1">
                    <span className="text-sm text-foreground/60 inline-flex items-center flex-wrap gap-x-2 gap-y-1">
                      <span>+ {addon.name}</span>
                      {addon.qty > 1 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-400 text-foreground text-xs font-black tabular-nums tracking-wide shadow-sm">
                          ×{addon.qty}
                        </span>
                      )}
                    </span>
                    <span className="text-sm tabular-nums text-foreground/50 shrink-0">
                      ₱{(addon.price * addon.qty).toFixed(0)}
                    </span>
                  </div>
                ))}
              </Fragment>
            ))}
            {orphanAddons.map(addon => (
              <div key={addon.lineId} className="flex items-center justify-between gap-4 py-3.5">
                <span className="text-base font-semibold text-foreground/70 flex items-center flex-wrap gap-x-3 gap-y-1">
                  <span>{addon.name}</span>
                  {addon.qty > 1 && (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-400 text-foreground text-sm font-black tabular-nums tracking-wide shadow-sm">
                      ×{addon.qty}
                    </span>
                  )}
                </span>
                <span className="text-base tabular-nums font-bold text-foreground shrink-0">
                  ₱{(addon.price * addon.qty).toFixed(0)}
                </span>
              </div>
            ))}
          </div>

          {notes.trim() && (
            <div className="border-t border-foreground/10 mt-3 pt-4 pb-1">
              <p className="text-xs uppercase tracking-[0.3em] text-foreground/55 font-semibold mb-2">Notes</p>
              <span className="inline-block bg-[#d4ede1] text-[#1f5c3c] text-sm px-3 py-2 rounded-lg rounded-tl-none leading-snug max-w-full wrap-break-word">
                {notes.trim()}
              </span>
            </div>
          )}
        </div>

        {/* Pinned footer — totals, payment/change, and actions never scroll out of view */}
        <div className="shrink-0 border-t border-foreground/10 bg-white px-6 pt-4 pb-5">
          {discountAmount > 0 && (
            <div className="space-y-1.5 pb-4">
              <div className="flex justify-between text-xs text-foreground/50">
                <span className="uppercase tracking-widest">Subtotal</span>
                <span className="tabular-nums">₱{total.toFixed(0)}</span>
              </div>
              {foodDiscountLines.map(d => (
                <div key={d.lineId} className="flex justify-between text-xs text-emerald-600 font-semibold gap-2">
                  <span className="uppercase tracking-widest truncate">PWD Food −20% ({d.name})</span>
                  <span className="tabular-nums shrink-0">−₱{d.amount}</span>
                </div>
              ))}
              {drinkDiscountLines.map(d => (
                <div key={d.lineId} className="flex justify-between text-xs text-emerald-600 font-semibold gap-2">
                  <span className="uppercase tracking-widest truncate">PWD Drink −20% ({d.name})</span>
                  <span className="tabular-nums shrink-0">−₱{d.amount}</span>
                </div>
              ))}
            </div>
          )}

          <div className={`flex flex-col sm:flex-row sm:items-stretch gap-5 sm:gap-6 ${discountAmount > 0 ? 'border-t border-foreground/10 pt-4' : ''}`}>
            {/* Left: total due + payment/change */}
            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-foreground/55 font-semibold">Total Due</p>
                <p className="font-display font-bold text-5xl tracking-tight text-foreground tabular-nums mt-1">
                  ₱{grandTotal.toFixed(0)}
                </p>
              </div>

              <div className="border-t border-foreground/10 pt-4 flex items-baseline gap-8">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-foreground/55 font-semibold">Payment</p>
                  <p className="font-display text-xl font-semibold tabular-nums text-foreground mt-1">
                    {payment !== null ? `₱${payment.toFixed(0)}` : '—'}
                  </p>
                </div>
                {payment === null ? (
                  <p className="text-xs text-foreground/40 uppercase tracking-widest font-semibold">Awaiting payment</p>
                ) : short ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-red-500 font-semibold">Short</p>
                    <p className="text-2xl text-red-500 font-bold tabular-nums mt-1">
                      ₱{(grandTotal - payment).toFixed(0)}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-foreground/55 font-semibold">Change</p>
                    <p className="font-display font-semibold text-3xl tracking-tight text-foreground tabular-nums mt-1">
                      ₱{(payment - grandTotal).toFixed(0)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: actions, beside the totals */}
            <div className="sm:w-72 shrink-0 sm:border-l sm:border-foreground/10 sm:pl-6 flex flex-col justify-center gap-2.5">
              {submitError && (
                <p className="text-sm text-red-500 uppercase tracking-widest font-medium text-center">{submitError}</p>
              )}
              <button
                onClick={onCompletePlain}
                disabled={isSubmitting}
                className="w-full bg-foreground text-cream text-base uppercase tracking-widest py-4 font-bold hover:bg-foreground/90 active:scale-[0.99] transition-all rounded-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {pendingAction === 'plain' ? 'Saving…' : 'Order Complete ✓'}
              </button>
              <button
                onClick={onCompleteReceipt}
                disabled={isSubmitting}
                className="w-full border border-foreground/20 text-foreground/70 text-sm uppercase tracking-widest py-3 font-semibold hover:border-foreground/35 hover:text-foreground hover:bg-foreground/4 active:scale-[0.99] transition-all rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {pendingAction === 'receipt' ? 'Saving…' : '🖨 Complete + Print Receipt'}
              </button>
              <p className="text-xs text-foreground/35 text-center">Only if the customer asks for one</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
