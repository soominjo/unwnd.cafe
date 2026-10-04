'use client'

import { useRef, useState } from 'react'
import { variantClass, groupOrderItems, groupSaleItems } from './utils'
import { lineBadges } from './discounts'
import QtyBadge from './QtyBadge'
import LoyaltyBar from './LoyaltyBar'
import { LOYALTY_CARD_SIZE, formatStamps, stampCount } from '@/lib/loyalty'
import type { OrderItem, DiscountLine } from './types'
import type { OpenOrder } from './addToOrder'
import { formatPHClock } from './sales/dateRange'
import { MAX_NOTES_LENGTH } from '@/lib/sales/validateSaleInput'

/** A linked loyalty card, shown to the customer with the stamps this order adds. */
export interface ReviewLoyalty {
  name: string
  cardNumber: number
  savedOnCard: number
  orderStamps: number
}

interface OrderReviewModalProps {
  orderItems: OrderItem[]
  itemCount: number
  total: number
  grandTotal: number
  discountLines: DiscountLine[]
  discountAmount: number
  payment: number | null
  notes: string
  loyalty: ReviewLoyalty | null
  /** The order is being saved: every way out locks until it is. */
  saving: boolean
  submitError: string | null
  onCancel: () => void
  /** Saves the order, then opens its print preview: the kitchen ticket and the receipt, or ✕ to skip printing. */
  onComplete: () => void
  /** Adding to a saved order: its lines show above the new ones, and its total is part of what is due. */
  savedOrder?: OpenOrder | null
  /** The order can no longer take the items: what the cashier can do instead. */
  refusal?: { actionLabel: string; onAction: () => void } | null
  /** Lets the cashier add or fix the customer's name right before saving; without it the name only shows. */
  onNotesChange?: (value: string) => void
  /** The order is on a loyalty card: its name is the card holder's and stays as it is. */
  nameFixed?: boolean
}

const NAME_CHIP = 'inline-block max-w-full truncate bg-[#d4ede1] text-[#1f5c3c] text-sm font-semibold px-4 py-1.5 rounded-full'

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
  discountLines,
  discountAmount,
  payment,
  notes,
  loyalty,
  saving,
  submitError,
  onCancel,
  onComplete,
  savedOrder = null,
  refusal = null,
  onNotesChange,
  nameFixed = false,
}: OrderReviewModalProps) {
  const { parentItems, addonsByParent, orphanAddons } = groupOrderItems(orderItems)
  // What the customer owes: the whole order when items are being added to a saved one.
  const totalDue = (savedOrder?.total ?? 0) + grandTotal
  const short = payment !== null && payment < totalDue
  const savedAt = savedOrder ? formatPHClock(savedOrder.createdAt) : ''
  // Nothing new to put on a saved order (its cart was emptied after an earlier save went through).
  const nothingToSave = savedOrder !== null && orderItems.length === 0

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col min-h-0">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-foreground/10 shrink-0">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.3em] text-foreground/55 font-semibold">Review Your Order</p>
            <p className="text-foreground/45 text-sm mt-1">
              {savedOrder
                ? `Adding to the ${savedAt} order · ${itemCount} new item${itemCount !== 1 ? 's' : ''}`
                : `${itemCount} item${itemCount !== 1 ? 's' : ''} · ${orderItems.length} line${orderItems.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          {onNotesChange && !nameFixed ? (
            <div className="flex-1 flex justify-center min-w-0">
              <ReviewNameField name={notes} onChange={onNotesChange} />
            </div>
          ) : notes.trim() && (
            <div className="flex-1 flex justify-center min-w-0">
              <span className={NAME_CHIP}>{notes.trim()}</span>
            </div>
          )}
          <button
            onClick={onCancel}
            disabled={saving}
            title="Cancel"
            className="text-foreground/50 hover:text-foreground text-xl leading-none w-10 h-10 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            ✕
          </button>
        </div>

        {/* A linked loyalty card: the customer sees the stamps this order adds */}
        {loyalty && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3 border-b border-foreground/10 bg-emerald-50/40 shrink-0">
            <p className="text-sm font-semibold text-foreground">Loyalty card No. {loyalty.cardNumber}</p>
            <div className="flex-1 min-w-40 max-w-xs">
              <LoyaltyBar saved={loyalty.savedOnCard} pending={loyalty.orderStamps} />
            </div>
            <p className="text-sm text-foreground/60 tabular-nums">
              {loyalty.orderStamps > 0 && (
                <span className="font-semibold text-foreground">+{stampCount(loyalty.orderStamps)} this order · </span>
              )}
              {formatStamps(Math.min(loyalty.savedOnCard + loyalty.orderStamps, LOYALTY_CARD_SIZE))} of {LOYALTY_CARD_SIZE}
            </p>
          </div>
        )}

        {/* Scrollable body: item list + notes */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-3">
          {savedOrder && <SavedPart order={savedOrder} savedAt={savedAt} />}
          <div className="divide-y divide-foreground/[0.07]">
            {parentItems.map(item => {
              const addons = addonsByParent.get(item.lineId) ?? []
              return (
                <div key={item.lineId} className="py-3.5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-base font-semibold leading-tight text-foreground flex items-center flex-wrap gap-x-3 gap-y-1">
                        <span>{item.name}</span>
                        {item.qty > 1 && <QtyBadge qty={item.qty} />}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {item.variant && (
                          <span className={`text-xs uppercase tracking-wider font-bold ${variantClass(item.variant)}`}>
                            {item.variant}
                          </span>
                        )}
                        {lineBadges(discountLines, item).map(badge => (
                          <span key={badge.kind} className="text-xs text-emerald-600 font-semibold tracking-wide">{badge.text}</span>
                        ))}
                      </div>
                      {item.note && (
                        <p className="text-xs text-amber-600 font-semibold tracking-wide mt-1">📝 {item.note}</p>
                      )}
                    </div>
                    <span className="text-base tabular-nums font-bold text-foreground shrink-0">
                      ₱{(item.price * item.qty).toFixed(0)}
                    </span>
                  </div>
                  {addons.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {addons.map(addon => (
                        <div key={addon.lineId} className="flex items-center justify-between gap-3">
                          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                            <span className="text-sky-500">+</span>
                            {addon.name}
                            {addon.qty > 1 && <span className="tabular-nums">×{addon.qty}</span>}
                          </span>
                          <span className="text-xs tabular-nums text-foreground/50 shrink-0">
                            ₱{(addon.price * addon.qty).toFixed(0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {orphanAddons.map(addon => (
              <div key={addon.lineId} className="flex items-center justify-between gap-4 py-3.5">
                <span className="text-base font-semibold text-foreground/70 flex items-center flex-wrap gap-x-3 gap-y-1">
                  <span>{addon.name}</span>
                  {addon.qty > 1 && <QtyBadge qty={addon.qty} />}
                </span>
                <span className="text-base tabular-nums font-bold text-foreground shrink-0">
                  ₱{(addon.price * addon.qty).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pinned footer — totals, payment/change, and actions never scroll out of view */}
        <div className="shrink-0 border-t border-foreground/10 bg-white px-6 pt-4 pb-5">
          {discountAmount > 0 && (
            <div className="space-y-1.5 pb-4">
              <div className="flex justify-between text-xs text-foreground/50">
                <span className="uppercase tracking-widest">Subtotal</span>
                <span className="tabular-nums">₱{total.toFixed(0)}</span>
              </div>
              {discountLines.map(d => (
                <div key={`${d.lineId}:${d.kind}`} className="flex justify-between text-xs text-emerald-600 font-semibold gap-2">
                  <span className="uppercase tracking-widest truncate">{d.label} ({d.name})</span>
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
                  ₱{totalDue.toFixed(0)}
                </p>
                {savedOrder && (
                  <p className="text-sm text-foreground/55 tabular-nums mt-1">
                    {`Already ordered ₱${savedOrder.total.toFixed(0)} · added now ₱${grandTotal.toFixed(0)}`}
                  </p>
                )}
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
                      ₱{(totalDue - payment).toFixed(0)}
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-foreground/55 font-semibold">Change</p>
                    <p className="font-display font-semibold text-3xl tracking-tight text-foreground tabular-nums mt-1">
                      ₱{(payment - totalDue).toFixed(0)}
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
              {refusal ? (
                <button
                  onClick={refusal.onAction}
                  className="w-full bg-foreground text-cream text-base uppercase tracking-widest py-4 font-bold hover:bg-foreground/90 active:scale-[0.99] transition-all rounded-sm"
                >
                  {refusal.actionLabel}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => onComplete()}
                    disabled={saving || nothingToSave}
                    className="w-full bg-foreground text-cream text-base uppercase tracking-widest py-4 font-bold hover:bg-foreground/90 active:scale-[0.99] transition-all rounded-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving…' : savedOrder ? '🖨 Save + Print' : '🖨 Complete + Print'}
                  </button>
                  <p className="text-xs text-foreground/45 text-center">
                    {savedOrder
                      ? `Saves onto the ${savedAt} order: no new order is made. A preview then prints, or closing it skips printing.`
                      : 'After saving, a preview prints the kitchen ticket and the receipt; closing it skips printing.'}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// The customer's name at the top of the review: a forgotten one is added here, or a wrong one
// fixed, without going back to the order panel. It changes the same name field as the panel.
function ReviewNameField({ name, onChange }: { name: string; onChange: (value: string) => void }) {
  const [editing, setEditing] = useState(false)
  // Set on Done, so focus returns to the name's button rather than the page.
  const refocus = useRef(false)
  const shown = name.trim()

  function focusOnReturn(button: HTMLButtonElement | null) {
    if (!button || !refocus.current) return
    refocus.current = false
    button.focus()
  }

  if (editing) {
    return (
      <form
        className="flex items-center gap-2 min-w-0"
        onSubmit={e => {
          e.preventDefault()
          refocus.current = true
          setEditing(false)
        }}
      >
        <input
          autoFocus
          aria-label="Customer name"
          placeholder="Customer name"
          value={name}
          maxLength={MAX_NOTES_LENGTH}
          onChange={e => onChange(e.target.value)}
          className="min-w-0 w-56 rounded-full border border-foreground/25 px-4 py-1.5 text-sm text-foreground focus:outline-none focus:border-foreground/50"
        />
        <button type="submit" className="h-9 px-3 rounded-full bg-foreground text-cream text-xs font-bold uppercase tracking-widest shrink-0">
          Done
        </button>
      </form>
    )
  }
  if (!shown) {
    return (
      <button
        ref={focusOnReturn}
        type="button"
        onClick={() => setEditing(true)}
        className="h-9 px-4 rounded-full border border-dashed border-foreground/30 text-sm font-semibold text-foreground/60 hover:border-foreground/50 hover:text-foreground"
      >
        + Add name
      </button>
    )
  }
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1.5">
      <span className={NAME_CHIP}>{shown}</span>
      <button
        ref={focusOnReturn}
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Edit the customer’s name"
        className="h-9 px-3 shrink-0 rounded-full text-xs font-bold uppercase tracking-widest text-foreground/55 hover:text-foreground hover:bg-foreground/5"
      >
        Edit
      </button>
    </span>
  )
}

// The saved part of an order items are being added to: quieter than the new lines below it,
// which are what the customer is checking now.
function SavedPart({ order, savedAt }: { order: OpenOrder; savedAt: string }) {
  const { topLevel, addonsByParent } = groupSaleItems(order.items)
  return (
    <div className="pb-3">
      <p className="pt-1 pb-1 text-xs uppercase tracking-[0.25em] text-foreground/45 font-semibold">Already ordered · {savedAt}</p>
      {topLevel.map(item => (
        <div key={item.lineId} className="py-1.5 text-foreground/55">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm leading-tight flex items-center flex-wrap gap-x-2">
              <span>{item.name}</span>
              {item.variant && <span className={`text-[11px] uppercase tracking-wider font-bold ${variantClass(item.variant)}`}>{item.variant}</span>}
              {item.qty > 1 && <span className="text-xs font-bold tabular-nums">×{item.qty}</span>}
            </p>
            <span className="text-sm tabular-nums shrink-0">₱{(item.price * item.qty).toFixed(0)}</span>
          </div>
          {(addonsByParent.get(item.lineId) ?? []).map(addon => (
            <div key={addon.lineId} className="flex justify-between gap-4 pl-3 text-xs">
              <span>+ {addon.name}{addon.qty > 1 ? ` ×${addon.qty}` : ''}</span>
              <span className="tabular-nums">₱{(addon.price * addon.qty).toFixed(0)}</span>
            </div>
          ))}
        </div>
      ))}
      {order.discounts.map(d => (
        <div key={`${d.lineId}:${d.name}`} className="flex justify-between gap-4 text-xs text-emerald-600/80 font-semibold">
          <span className="truncate">{d.name}</span>
          <span className="tabular-nums shrink-0">−₱{d.amount}</span>
        </div>
      ))}
      <p className="pt-4 text-xs uppercase tracking-[0.25em] text-sky-700 font-semibold">Adding now</p>
    </div>
  )
}
