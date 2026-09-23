'use client'

import type { Addon, DiscountLine, LineDiscountKind, LineDiscountScope, OrderItem } from './types'
import { variantClass } from './utils'
import CustomizeSection from './CustomizeSection'
import AddonsSection from './AddonsSection'
import DiscountSection from './DiscountSection'

export type ItemModalMode = 'customize' | 'addons' | 'discount'

const TITLES: Record<ItemModalMode, string> = {
  customize: 'Customize',
  addons: 'Add-ons',
  discount: 'Discount',
}

interface ItemActionModalProps {
  mode: ItemModalMode
  item: OrderItem
  /** Add-on lines attached to this item. */
  attachedAddons: OrderItem[]
  /** Add-ons that may attach to this item (already filtered by its category). */
  addonOptions: Addon[]
  /** The whole order's discount rows; this item's rows are picked out of it. */
  discountLines: DiscountLine[]
  /** Pre-discount order total. */
  subtotal: number
  /** What the customer owes after every discount. */
  grandTotal: number
  onPickDiscount: (kind: LineDiscountKind, scope: LineDiscountScope) => void
  onSaveNote: (note: string) => void
  onAddAddon: (addon: Addon) => void
  onClose: () => void
}

// One standard-size modal for everything the cashier does to a single line —
// Customize, Add-ons, Discount — opened from that line's buttons. It always
// shows the item, its price line and add-ons, and the order's subtotal and
// total, so a discount or add-on can be checked against the money on the spot.
// A preset or add-on tap applies and closes (one tap, as before); discount
// chips keep it open so the two kinds can be stacked.
export default function ItemActionModal({
  mode,
  item,
  attachedAddons,
  addonOptions,
  discountLines,
  subtotal,
  grandTotal,
  onPickDiscount,
  onSaveNote,
  onAddAddon,
  onClose,
}: ItemActionModalProps) {
  const lineRows = discountLines.filter(d => d.lineId === item.lineId)
  const addonsTotal = attachedAddons.reduce((sum, a) => sum + a.price * a.qty, 0)
  const discountAmount = subtotal - grandTotal

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-modal-title"
        className="relative z-61 bg-white border border-foreground/12 w-full max-w-md rounded-sm shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Header: what this modal is, and the ✕ */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-foreground/10 shrink-0">
          <p id="item-modal-title" className="text-[10px] uppercase tracking-[0.3em] text-foreground/55 font-semibold">
            {TITLES[mode]}
          </p>
          <button
            onClick={onClose}
            title="Close"
            className="text-foreground/50 hover:text-foreground text-xl leading-none w-9 h-9 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto">
          {/* The item: name, variant, and a large unit price × qty. Attached add-ons follow, since
              they are part of what a discount is taken off. Discounts themselves are shown once,
              in the Discount section's computation rows, not repeated here. */}
          <div className="px-5 py-4 border-b border-foreground/10">
            <p className="text-lg font-bold leading-tight text-foreground">{item.name}</p>
            <div className="flex items-baseline gap-3 mt-2">
              {item.variant && (
                <span className={`text-xs uppercase tracking-wider font-bold ${variantClass(item.variant)}`}>{item.variant}</span>
              )}
              <span className="text-2xl font-semibold tabular-nums text-foreground">₱{item.price} × {item.qty}</span>
            </div>
            {attachedAddons.map(addon => (
              <div key={addon.lineId} className="flex items-center justify-between mt-2 text-sm">
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 font-semibold text-sky-700">
                  <span className="text-sky-500">+</span>
                  {addon.name}
                  {addon.qty > 1 && <span className="tabular-nums">×{addon.qty}</span>}
                </span>
                <span className="tabular-nums text-foreground/50">₱{addon.price * addon.qty}</span>
              </div>
            ))}
          </div>

          {/* The section this modal was opened for */}
          <div className="px-5 py-4">
            {mode === 'customize' && (
              <CustomizeSection note={item.note} onSave={onSaveNote} onPresetChosen={onClose} />
            )}
            {mode === 'addons' && (
              <AddonsSection options={addonOptions} onAdd={addon => { onAddAddon(addon); onClose() }} />
            )}
            {mode === 'discount' && (
              <DiscountSection item={item} addonsTotal={addonsTotal} lineRows={lineRows} onPick={onPickDiscount} />
            )}
          </div>
        </div>

        {/* Order money, always in view: what the customer will owe with everything applied */}
        <div className="border-t border-foreground/10 px-5 py-3 space-y-1.5 text-sm shrink-0">
          <div className="flex justify-between text-foreground/55">
            <span className="text-xs uppercase tracking-widest">Subtotal</span>
            <span className="tabular-nums">₱{subtotal}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600 font-semibold">
              <span className="text-xs uppercase tracking-widest">Discount</span>
              <span className="tabular-nums">−₱{discountAmount}</span>
            </div>
          )}
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-xs uppercase tracking-widest font-semibold text-foreground/70">Total</span>
            <span className="font-display font-bold text-3xl tabular-nums text-foreground">₱{grandTotal}</span>
          </div>
        </div>

        <div className="px-5 pb-4 shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-foreground text-cream text-xs uppercase tracking-widest py-3 font-bold hover:bg-foreground/90 active:scale-[0.99] transition-all rounded-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
