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

// Fullscreen, tablet-legible review screen shown to the customer before the
// cashier taps charge. The item list scrolls on its own (left / top) while
// the total, payment, change, and action buttons live in a panel that never
// scrolls out of view (right on tablet+, pinned to the bottom on phones) —
// a long order should never hide what the customer actually owes.
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
    <div className="fixed inset-0 z-50 bg-white flex flex-col md:flex-row">

      {/* Left: header + scrollable item list */}
      <div className="flex-1 flex flex-col min-h-0 md:border-r border-foreground/10">
        <div className="flex items-center justify-between px-6 py-5 border-b border-foreground/10 shrink-0">
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
            className="text-foreground/50 hover:text-foreground text-2xl leading-none w-11 h-11 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="divide-y divide-foreground/[0.07]">
            {parentItems.map(item => (
              <Fragment key={item.lineId}>
                <div className="flex items-start justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold leading-tight text-foreground">
                      {item.name}
                      {item.qty > 1 && <span className="text-foreground/45 ml-2 text-base">×{item.qty}</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {item.variant && (
                        <span className={`text-xs uppercase tracking-wider font-bold ${variantClass(item.variant)}`}>
                          {item.variant}
                        </span>
                      )}
                      {item.pwdDiscounted && (
                        <span className="text-xs text-emerald-600 font-semibold tracking-wide">PWD/Senior −20%</span>
                      )}
                    </div>
                  </div>
                  <span className="text-lg tabular-nums font-bold text-foreground shrink-0">
                    ₱{(item.price * item.qty).toFixed(0)}
                  </span>
                </div>
                {(addonsByParent.get(item.lineId) ?? []).map(addon => (
                  <div key={addon.lineId} className="flex items-center justify-between gap-4 py-2.5 pl-5 border-l-2 border-l-foreground/10 ml-1">
                    <span className="text-base text-foreground/60">
                      + {addon.name}
                      {addon.qty > 1 && <span className="text-foreground/40 ml-1.5">×{addon.qty}</span>}
                    </span>
                    <span className="text-base tabular-nums text-foreground/50 shrink-0">
                      ₱{(addon.price * addon.qty).toFixed(0)}
                    </span>
                  </div>
                ))}
              </Fragment>
            ))}
            {orphanAddons.map(addon => (
              <div key={addon.lineId} className="flex items-center justify-between gap-4 py-4">
                <span className="text-lg font-semibold text-foreground/70">
                  {addon.name}
                  {addon.qty > 1 && <span className="text-foreground/45 ml-2 text-base">×{addon.qty}</span>}
                </span>
                <span className="text-lg tabular-nums font-bold text-foreground shrink-0">
                  ₱{(addon.price * addon.qty).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: totals, payment/change, notes, and actions — always fully visible */}
      <div className="w-full md:w-100 lg:w-110 shrink-0 flex flex-col min-h-0 border-t md:border-t-0 border-foreground/10 bg-background/40">
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-8">

          {/* Totals */}
          <div className="space-y-5">
            {discountAmount > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-foreground/50">
                  <span className="uppercase tracking-widest">Subtotal</span>
                  <span className="tabular-nums">₱{total.toFixed(0)}</span>
                </div>
                {foodDiscountLines.map(d => (
                  <div key={d.lineId} className="flex justify-between text-sm text-emerald-600 font-semibold gap-2">
                    <span className="uppercase tracking-widest truncate">PWD Food −20% ({d.name})</span>
                    <span className="tabular-nums shrink-0">−₱{d.amount}</span>
                  </div>
                ))}
                {drinkDiscountLines.map(d => (
                  <div key={d.lineId} className="flex justify-between text-sm text-emerald-600 font-semibold gap-2">
                    <span className="uppercase tracking-widest truncate">PWD Drink −20% ({d.name})</span>
                    <span className="tabular-nums shrink-0">−₱{d.amount}</span>
                  </div>
                ))}
              </div>
            )}
            <div className={discountAmount > 0 ? 'border-t border-foreground/10 pt-5' : ''}>
              <p className="text-sm uppercase tracking-[0.3em] text-foreground/55 font-semibold">Total Due</p>
              <p className="font-display font-bold text-6xl lg:text-7xl tracking-tight text-foreground tabular-nums mt-1">
                ₱{grandTotal.toFixed(0)}
              </p>
            </div>
          </div>

          {/* Payment / change */}
          <div className="border-t border-foreground/10 pt-6 flex items-baseline justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-foreground/55 font-semibold">Payment</p>
              <p className="font-display text-2xl font-semibold tabular-nums text-foreground mt-1.5">
                {payment !== null ? `₱${payment.toFixed(0)}` : '—'}
              </p>
            </div>
            {payment === null ? (
              <p className="text-sm text-foreground/40 uppercase tracking-widest font-semibold text-right">Awaiting payment</p>
            ) : short ? (
              <div className="text-right">
                <p className="text-sm uppercase tracking-[0.3em] text-red-500 font-semibold">Short</p>
                <p className="text-3xl text-red-500 font-bold tabular-nums mt-1.5">
                  ₱{(grandTotal - payment).toFixed(0)}
                </p>
              </div>
            ) : (
              <div className="text-right">
                <p className="text-sm uppercase tracking-[0.3em] text-foreground/55 font-semibold">Change</p>
                <p className="font-display font-semibold text-5xl tracking-tight text-foreground tabular-nums mt-1.5">
                  ₱{(payment - grandTotal).toFixed(0)}
                </p>
              </div>
            )}
          </div>

          {notes.trim() && (
            <div className="border-t border-foreground/10 pt-6">
              <p className="text-sm uppercase tracking-[0.3em] text-foreground/55 font-semibold mb-2.5">Notes</p>
              <span className="inline-block bg-[#d4ede1] text-[#1f5c3c] text-base px-3 py-2 rounded-lg rounded-tl-none leading-snug max-w-full wrap-break-word">
                {notes.trim()}
              </span>
            </div>
          )}
        </div>

        {/* Pinned action footer — never scrolls away, even if the totals above grow tall */}
        <div className="px-6 py-5 border-t border-foreground/10 shrink-0 space-y-3">
          {submitError && (
            <p className="text-sm text-red-500 uppercase tracking-widest font-medium text-center">{submitError}</p>
          )}
          <button
            onClick={onCompletePlain}
            disabled={isSubmitting}
            className="w-full bg-foreground text-cream text-lg uppercase tracking-widest py-5 font-bold hover:bg-foreground/90 active:scale-[0.99] transition-all rounded-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pendingAction === 'plain' ? 'Saving…' : 'Order Complete ✓'}
          </button>
          <button
            onClick={onCompleteReceipt}
            disabled={isSubmitting}
            className="w-full border border-foreground/20 text-foreground/70 text-sm uppercase tracking-widest py-3.5 font-semibold hover:border-foreground/35 hover:text-foreground hover:bg-foreground/4 active:scale-[0.99] transition-all rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pendingAction === 'receipt' ? 'Saving…' : '🖨 Complete + Print Receipt'}
          </button>
          <p className="text-xs text-foreground/35 text-center">Only if the customer asks for one</p>
        </div>
      </div>
    </div>
  )
}
