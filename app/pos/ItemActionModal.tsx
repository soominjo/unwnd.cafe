'use client'

import { useEffect } from 'react'
import type { Addon, DiscountLine, LineDiscountKind, LineDiscountScope, OrderItem } from './types'
import { addonLineId, variantClass } from './utils'
import CustomizeSection from './CustomizeSection'
import AddonsSection from './AddonsSection'
import DiscountSection from './DiscountSection'

export type ItemModalMode = 'addons' | 'discount'

const TITLES: Record<ItemModalMode, string> = {
  addons: 'Add-ons & Customize',
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
  onPickDiscount: (kind: LineDiscountKind, scope: LineDiscountScope) => void
  onSaveNote: (note: string) => void
  onAddAddon: (addon: Addon) => void
  onClose: () => void
}

// One standard-size modal for what the cashier does to a single line, in two
// modes opened from that line's buttons: "+" for add-ons and customizations,
// "%" for discounts. Each mode shows only its own concern — the add-ons mode
// carries no discount figures, the discount mode no add-ons or notes — so
// neither screen is crowded. Every figure here is this item's, not the whole
// order's: the panel behind keeps the order total. Every tap applies straight
// away and leaves the modal open, so several add-ons, presets or discounts can
// be stacked; only Done, ✕, the backdrop or Escape close it.
export default function ItemActionModal({
  mode,
  item,
  attachedAddons,
  addonOptions,
  discountLines,
  onPickDiscount,
  onSaveNote,
  onAddAddon,
  onClose,
}: ItemActionModalProps) {
  const lineRows = discountLines.filter(d => d.lineId === item.lineId)
  const menuSubtotal = item.price * item.qty
  const addonsTotal = attachedAddons.reduce((sum, a) => sum + a.price * a.qty, 0)
  const itemTotal = menuSubtotal + addonsTotal
  // Only this line's own discounts. A whole-order discount belongs to the order,
  // not to any one item, so it is not folded in here.
  const lineDiscount = lineRows.reduce((sum, d) => sum + d.amount, 0)

  // Which add-ons are already on the line, so their buttons render filled.
  const attachedQty: Record<string, number> = {}
  for (const option of addonOptions) {
    const attached = attachedAddons.find(a => a.lineId === addonLineId(option.id, item.lineId))
    if (attached) attachedQty[option.id] = attached.qty
  }

  // Escape closes, for the cashier on a keyboard; touch users have the backdrop, ✕ and Done.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

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
            aria-label="Close"
            title="Close"
            className="text-foreground/50 hover:text-foreground text-xl leading-none w-11 h-11 -mr-2 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto">
          {/* The item: name, variant, and a large unit price × qty. Its attached add-ons
              follow in add-ons mode, where they are what the cashier is changing; the
              discount mode leaves them out and keeps to the discount alone. */}
          <div className="px-5 py-4 border-b border-foreground/10">
            <p className="text-lg font-bold leading-tight text-foreground">{item.name}</p>
            <div className="flex items-baseline gap-3 mt-2">
              {item.variant && (
                <span className={`text-xs uppercase tracking-wider font-bold ${variantClass(item.variant)}`}>{item.variant}</span>
              )}
              <span className="text-2xl font-semibold tabular-nums text-foreground">₱{item.price} × {item.qty}</span>
            </div>
            {mode === 'addons' && attachedAddons.map(addon => (
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
            {mode === 'addons' ? (
              <div className="space-y-4">
                <AddonsSection options={addonOptions} attachedQty={attachedQty} onAdd={onAddAddon} />
                <div className="border-t border-foreground/10 pt-4">
                  <CustomizeSection note={item.note} onSave={onSaveNote} />
                </div>
              </div>
            ) : (
              <DiscountSection item={item} addonsTotal={addonsTotal} lineRows={lineRows} onPick={onPickDiscount} />
            )}
          </div>
        </div>

        {/* What this item comes to: the menu lines, then its add-ons, then — while
            discounts are being picked — this line's own discount and what is left. */}
        <div className="border-t border-foreground/10 px-5 py-3 space-y-1.5 text-sm shrink-0">
          <div className="flex justify-between text-foreground/55">
            <span className="text-xs uppercase tracking-widest">Subtotal</span>
            <span className="tabular-nums">₱{menuSubtotal}</span>
          </div>
          <div className="flex justify-between text-foreground/55">
            <span className="text-xs uppercase tracking-widest">Add-ons</span>
            <span className="tabular-nums">₱{addonsTotal}</span>
          </div>
          {mode === 'discount' && (
            <div className="flex justify-between text-emerald-600 font-semibold">
              <span className="text-xs uppercase tracking-widest">Discount</span>
              <span className="tabular-nums">{lineDiscount > 0 ? `−₱${lineDiscount}` : '₱0'}</span>
            </div>
          )}
          <div className="flex justify-between items-baseline pt-1 border-t border-foreground/10">
            <span className="text-xs uppercase tracking-widest font-semibold text-foreground/70">
              {mode === 'discount' ? 'Total' : 'Item total'}
            </span>
            <span className="font-display font-bold text-3xl tabular-nums text-foreground">
              ₱{mode === 'discount' ? itemTotal - lineDiscount : itemTotal}
            </span>
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
