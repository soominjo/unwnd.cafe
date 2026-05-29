'use client'

import { useState, useMemo, useCallback, memo } from 'react'
import Link from 'next/link'
import { MENU } from './menuData'
import { variantClass } from './utils'
import type { MenuItem, OrderItem, Variant } from './types'

interface Addon {
  id:    string
  name:  string
  label: string
  price: number
}

const ADDONS: Addon[] = [
  { id: 'addon__syrup',     name: 'Syrup',           label: '+20 Syrup',    price: 20 },
  { id: 'addon__whitechoc', name: 'White Choc Pump',  label: '+20 WCP',     price: 20 },
  { id: 'addon__espresso',  name: 'Espresso Shot',    label: '+30 Espresso', price: 30 },
]

export default function POSClient() {
  const [activeCategory, setActiveCategory] = useState(0)
  const [orderItems, setOrderItems]         = useState<OrderItem[]>([])
  const [showConfirm, setShowConfirm]       = useState(false)
  const [mobileDrawer, setMobileDrawer]     = useState(false)
  const [payment, setPayment]               = useState<number | null>(null)
  const [customInput, setCustomInput]       = useState('')
  const [isSubmitting, setIsSubmitting]     = useState(false)
  const [submitError, setSubmitError]       = useState<string | null>(null)
  const [notes, setNotes]                   = useState('')

  const total = useMemo(
    () => orderItems.reduce((sum, i) => sum + i.price * i.qty, 0),
    [orderItems]
  )

  const itemCount = useMemo(
    () => orderItems.reduce((sum, i) => sum + i.qty, 0),
    [orderItems]
  )

  const addItem = useCallback((item: MenuItem, variant: Variant | null) => {
    const price =
      variant === 'ice' ? item.priceIce! :
      variant === 'hot' ? item.priceHot! :
      item.priceFixed!
    const lineId = `${item.id}__${variant ?? 'fixed'}`
    setOrderItems(prev => {
      const existing = prev.find(i => i.lineId === lineId)
      if (existing) {
        return prev.map(i => i.lineId === lineId ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, { lineId, name: item.name, variant, price, qty: 1 }]
    })
  }, [])

  const addAddon = useCallback((addon: Addon) => {
    setOrderItems(prev => {
      const existing = prev.find(i => i.lineId === addon.id)
      if (existing) {
        return prev.map(i => i.lineId === addon.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, { lineId: addon.id, name: addon.name, variant: null, price: addon.price, qty: 1 }]
    })
  }, [])

  function adjustQty(lineId: string, delta: number) {
    setOrderItems(prev =>
      prev
        .map(i => i.lineId === lineId ? { ...i, qty: i.qty + delta } : i)
        .filter(i => i.qty > 0)
    )
  }

  function clearOrder() {
    setOrderItems([])
    setShowConfirm(false)
    setMobileDrawer(false)
    setPayment(null)
    setCustomInput('')
    setSubmitError(null)
    setNotes('')
  }

  async function completeSale() {
    if (isSubmitting) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total,
          paymentAmount: payment ?? total,
          items: orderItems,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setSubmitError(data.error ?? 'Failed to save sale. Try again.')
        return
      }
      clearOrder()
      const bc = new BroadcastChannel('pos-sales-update')
      bc.postMessage({ type: 'sale-completed' })
      bc.close()
    } catch {
      setSubmitError('Network error. Check connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSetPayment(amount: number | null, raw: string) {
    setPayment(amount)
    setCustomInput(raw)
  }

  const category = MENU[activeCategory]

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden select-none">

      {/* ── Header ── */}
      <header className="bg-foreground flex items-center justify-between px-6 py-4 shrink-0">
        <Link href="/" className="font-serif text-2xl lowercase tracking-tight text-cream hover:text-cream/70 transition-colors">unwnd. pos</Link>
        <div className="flex items-center gap-4">
          <a
            href="/pos/sales"
            className="hidden lg:block text-xs uppercase tracking-[0.2em] text-cream/55 hover:text-cream/85 transition-colors"
          >
            Sales ↗
          </a>
          <button
            className="lg:hidden flex items-center gap-3 text-sm text-cream/85 hover:text-cream transition-colors py-2 px-4 border border-cream/30 rounded-sm"
            onClick={() => setMobileDrawer(true)}
          >
            {itemCount > 0 && (
              <span className="bg-cream text-foreground text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                {itemCount}
              </span>
            )}
            Order ›
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: menu */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">

          {/* Category tabs */}
          <div className="flex gap-2 px-6 py-4 border-b border-foreground/10 shrink-0 overflow-x-auto scrollbar-none">
            {MENU.map((cat, i) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(i)}
                className={`px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest whitespace-nowrap rounded-sm transition-all duration-200 ${
                  activeCategory === i
                    ? 'bg-foreground text-cream border border-foreground'
                    : 'text-foreground border border-foreground/30 hover:border-foreground/60 bg-transparent'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
            {category.items.map(item => (
              <ItemCard key={item.id} item={item} onAdd={addItem} />
            ))}
          </div>
        </div>

        {/* Right: order panel — desktop only */}
        <aside className="hidden lg:flex w-100 xl:w-110 flex-col border-l border-foreground/10 bg-white shrink-0">
          <OrderPanel
            items={orderItems}
            total={total}
            payment={payment}
            customInput={customInput}
            notes={notes}
            onAdjust={adjustQty}
            onClear={clearOrder}
            onCharge={() => setShowConfirm(true)}
            onSetPayment={handleSetPayment}
            onAddAddon={addAddon}
            onNotesChange={setNotes}
          />
        </aside>
      </div>

      {/* ── Mobile: floating order button ── */}
      {itemCount > 0 && !mobileDrawer && (
        <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
          <button
            onClick={() => setMobileDrawer(true)}
            className="bg-foreground text-cream text-sm uppercase tracking-widest font-bold px-8 py-4 rounded-full shadow-2xl flex items-center gap-3"
          >
            <span className="bg-cream text-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
              {itemCount}
            </span>
            View Order · ₱{total.toFixed(0)}
          </button>
        </div>
      )}

      {/* ── Mobile: order drawer ── */}
      {mobileDrawer && (
        <div className="lg:hidden fixed inset-0 z-40 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileDrawer(false)} />
          <div className="relative z-50 bg-white border-t border-foreground/10 flex flex-col max-h-[85vh] rounded-t-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-foreground/10 shrink-0">
              <span className="text-sm font-bold uppercase tracking-widest text-foreground">Your Order</span>
              <button
                className="text-foreground/50 hover:text-foreground text-2xl leading-none w-10 h-10 flex items-center justify-center transition-colors"
                onClick={() => setMobileDrawer(false)}
              >
                ✕
              </button>
            </div>
            <OrderPanel
              items={orderItems}
              total={total}
              payment={payment}
              customInput={customInput}
              notes={notes}
              onAdjust={adjustQty}
              onClear={clearOrder}
              onCharge={() => { setMobileDrawer(false); setShowConfirm(true) }}
              onSetPayment={handleSetPayment}
              onAddAddon={addAddon}
              onNotesChange={setNotes}
            />
          </div>
        </div>
      )}

      {/* ── Confirm modal ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConfirm(false)} />
          <div className="relative z-50 bg-white border border-foreground/12 p-8 w-full max-w-md rounded-sm shadow-2xl">
            <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/55 mb-3">Total Due</p>
            <p className="font-serif text-7xl tracking-tight text-foreground mb-1">₱{total.toFixed(0)}</p>
            <p className="text-foreground/55 text-sm mb-6">
              {itemCount} item{itemCount !== 1 ? 's' : ''} · {orderItems.length} line{orderItems.length !== 1 ? 's' : ''}
            </p>

            {/* Order summary */}
            <div className="border-t border-foreground/10 pt-4 mb-6 space-y-2.5 max-h-48 overflow-y-auto">
              {orderItems.map(item => (
                <div key={item.lineId} className="flex justify-between text-sm">
                  <span className="text-foreground/75">
                    {item.name}
                    {item.variant && (
                      <span className={`ml-1.5 text-[10px] uppercase font-semibold tracking-wider ${variantClass(item.variant)}`}>
                        ({item.variant})
                      </span>
                    )}
                    {item.qty > 1 && (
                      <span className="text-foreground/45 ml-1">×{item.qty}</span>
                    )}
                  </span>
                  <span className="tabular-nums font-semibold text-foreground">₱{(item.price * item.qty).toFixed(0)}</span>
                </div>
              ))}
            </div>

            {/* Change summary */}
            {payment !== null && (
              <div className="border-t border-foreground/10 pt-4 mb-6 flex items-baseline justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/55">Payment</p>
                  <p className="font-semibold tabular-nums text-foreground mt-1">₱{payment.toFixed(0)}</p>
                </div>
                {payment >= total ? (
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/55">Change</p>
                    <p className="font-serif text-4xl tracking-tight text-foreground tabular-nums mt-1">
                      ₱{(payment - total).toFixed(0)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-red-500 uppercase tracking-widest font-semibold">
                    Short ₱{(total - payment).toFixed(0)}
                  </p>
                )}
              </div>
            )}

            {notes.trim() && (
              <div className="border-t border-foreground/10 pt-4 mb-4">
                <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/55 mb-2">Notes</p>
                <span className="inline-block bg-[#d4ede1] text-[#1f5c3c] text-xs px-2.5 py-1.5 rounded-lg rounded-tl-none leading-snug max-w-full wrap-break-word">
                  {notes.trim()}
                </span>
              </div>
            )}

            {submitError && (
              <p className="text-xs text-red-500 uppercase tracking-widest mb-4 font-medium">{submitError}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); setSubmitError(null) }}
                disabled={isSubmitting}
                className="flex-1 border border-foreground/15 text-foreground/60 text-xs uppercase tracking-widest py-4 hover:border-foreground/30 hover:text-foreground/80 transition-colors rounded-sm disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={completeSale}
                disabled={isSubmitting}
                className="flex-2 bg-foreground text-cream text-xs uppercase tracking-widest py-4 font-bold hover:bg-foreground/90 active:scale-[0.99] transition-all rounded-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Saving…' : 'Order Complete ✓'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Item Card ────────────────────────────────────────────────────────────────

const ItemCard = memo(function ItemCard({
  item,
  onAdd,
}: {
  item: MenuItem
  onAdd: (item: MenuItem, variant: Variant | null) => void
}) {
  const isFood = item.priceFixed !== null
  const hasHot = item.priceHot !== null
  const hasIce = item.priceIce !== null

  return (
    <div className="bg-white text-foreground flex flex-col overflow-hidden border border-foreground/10 hover:border-foreground/22 hover:shadow-md transition-all duration-200 rounded-xl">

      {/* Name + subtitle */}
      <div className="flex-1 px-5 pt-5 pb-5">
        <p className="font-bold text-[1.05rem] leading-snug tracking-tight text-foreground">
          {item.name}
        </p>
        {item.subtitle && (
          <p className="text-[11px] text-foreground/55 mt-2.5 leading-relaxed line-clamp-2">
            {item.subtitle}
          </p>
        )}
      </div>

      {/* Action row */}
      {isFood ? (
        <button
          onClick={() => onAdd(item, null)}
          className="flex items-center justify-between px-5 py-5 bg-foreground text-cream hover:bg-foreground/85 active:bg-foreground/95 transition-colors rounded-b-xl"
        >
          <span className="text-[11px] uppercase tracking-widest text-cream/65 font-semibold">Add</span>
          <span className="font-bold text-xl tracking-tight">₱{item.priceFixed}</span>
        </button>
      ) : (
        <div className={`grid ${hasHot && hasIce ? 'grid-cols-2' : 'grid-cols-1'} gap-2 px-2 pb-2`}>
          {hasHot && (
            <button
              onClick={() => onAdd(item, 'hot')}
              className="flex flex-col items-center justify-center gap-1.5 py-5 bg-foreground text-cream hover:bg-foreground/85 active:bg-foreground/95 transition-colors rounded-xl"
            >
              <span className="text-[11px] uppercase tracking-widest text-cream/65 font-semibold">Hot</span>
              <span className="font-bold text-xl tracking-tight">₱{item.priceHot}</span>
            </button>
          )}
          {hasIce && (
            <button
              onClick={() => onAdd(item, 'ice')}
              className="flex flex-col items-center justify-center gap-1.5 py-5 bg-[#1A5535] text-cream hover:bg-[#164829] active:bg-[#123d22] transition-colors rounded-xl"
            >
              <span className="text-[11px] uppercase tracking-widest text-cream/65 font-semibold">Ice</span>
              <span className="font-bold text-xl tracking-tight">₱{item.priceIce}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
})

// ─── Order Panel ──────────────────────────────────────────────────────────────

function OrderPanel({
  items,
  total,
  payment,
  customInput,
  notes,
  onAdjust,
  onClear,
  onCharge,
  onSetPayment,
  onAddAddon,
  onNotesChange,
}: {
  items: OrderItem[]
  total: number
  payment: number | null
  customInput: string
  notes: string
  onAdjust: (lineId: string, delta: number) => void
  onClear: () => void
  onCharge: () => void
  onSetPayment: (amount: number | null, raw: string) => void
  onAddAddon: (addon: Addon) => void
  onNotesChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Panel header */}
      <div className="px-6 py-3 border-b border-foreground/10 shrink-0">
        <p className="text-[10px] uppercase tracking-[0.28em] text-foreground/60 font-semibold">Current Order</p>
      </div>

      {/* Order items */}
      <div className="flex-1 overflow-y-auto px-6 py-2 space-y-0.5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-12 gap-2">
            <p className="text-foreground/20 text-4xl font-light">—</p>
            <p className="text-foreground/40 text-sm">No items added yet</p>
          </div>
        ) : (
          items.map(item => {
            const isAddon = item.lineId.startsWith('addon__')
            return (
              <div
                key={item.lineId}
                className="flex items-center gap-3 py-2.5 border-b border-foreground/[0.07] last:border-0"
              >
                <div className="flex-1 min-w-0">
                  {isAddon ? (
                    <p className="text-[0.85rem] font-medium leading-tight text-foreground/60">
                      + {item.name}
                    </p>
                  ) : (
                    <p className="text-[0.9rem] font-semibold leading-tight text-foreground">{item.name}</p>
                  )}
                  {item.variant && (
                    <p className={`text-[10px] uppercase tracking-wider mt-0.5 font-bold ${
                      variantClass(item.variant)}`}>
                      {item.variant}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onAdjust(item.lineId, -1)}
                      className="w-8 h-8 flex items-center justify-center text-foreground/50 hover:text-foreground border border-foreground/12 hover:border-foreground/30 rounded-sm text-base transition-colors"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm tabular-nums font-bold text-foreground">{item.qty}</span>
                    <button
                      onClick={() => onAdjust(item.lineId, 1)}
                      className="w-8 h-8 flex items-center justify-center text-foreground/50 hover:text-foreground border border-foreground/12 hover:border-foreground/30 rounded-sm text-base transition-colors"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-sm tabular-nums w-16 text-right font-bold text-foreground">
                    ₱{(item.price * item.qty).toFixed(0)}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Add-ons */}
      <div className="px-6 py-2 border-t border-foreground/10 shrink-0">
        <p className="text-[10px] uppercase tracking-[0.25em] text-foreground/45 font-semibold mb-2">Add-ons</p>
        <div className="flex gap-2">
          {ADDONS.map(addon => (
            <button
              key={addon.id}
              onClick={() => onAddAddon(addon)}
              disabled={items.length === 0}
              className="flex-1 px-2 py-1.5 text-[11px] font-semibold border border-foreground/20 text-foreground/65 hover:border-foreground/45 hover:text-foreground hover:bg-foreground/4 rounded-sm transition-all disabled:opacity-25 disabled:cursor-not-allowed whitespace-nowrap text-center"
            >
              {addon.label}
            </button>
          ))}
        </div>
      </div>

      {/* Footer: total + payment + actions */}
      <div className="px-6 pt-3 pb-3 border-t border-foreground/10 shrink-0 space-y-2.5">

        {/* Total */}
        <div className="flex justify-between items-center">
          <span className="text-xs uppercase tracking-widest text-foreground/60 font-semibold">Total</span>
          <span className="font-serif text-4xl tabular-nums text-foreground">₱{total.toFixed(0)}</span>
        </div>

        {/* Payment presets — full width */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.25em] text-foreground/60 font-semibold">Payment</p>
          <div className="flex gap-1.5">
            {[500, 1000, 2000].map(amt => (
              <button
                key={amt}
                onClick={() => onSetPayment(amt, String(amt))}
                disabled={items.length === 0}
                className={`flex-1 py-2 text-xs font-bold tabular-nums rounded-sm border transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed ${
                  payment === amt
                    ? 'bg-foreground text-cream border-foreground'
                    : 'border-foreground/15 text-foreground hover:border-foreground/35 hover:bg-foreground/4'
                }`}
              >
                ₱{amt}
              </button>
            ))}
          </div>
        </div>

        {/* Custom amount + Notes side by side */}
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder="Custom amount"
            value={customInput}
            disabled={items.length === 0}
            onChange={e => {
              const raw = e.target.value
              const val = parseFloat(raw)
              onSetPayment(isNaN(val) ? null : val, raw)
            }}
            className="flex-1 border border-foreground/13 rounded-sm px-2.5 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/40 disabled:opacity-30 bg-transparent"
          />
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Notes / name…"
              value={notes}
              disabled={items.length === 0}
              maxLength={100}
              onChange={e => onNotesChange(e.target.value)}
              className={`w-full border border-foreground/13 rounded-sm px-2.5 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/40 disabled:opacity-30 bg-transparent ${notes.length > 70 ? 'pr-7' : ''}`}
            />
            {notes.length > 70 && (
              <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] tabular-nums pointer-events-none ${notes.length >= 95 ? 'text-red-400' : 'text-foreground/30'}`}>
                {100 - notes.length}
              </span>
            )}
          </div>
        </div>

        {/* Change / Short indicator */}
        {payment !== null && items.length > 0 && (
          payment >= total ? (
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] uppercase tracking-[0.25em] text-foreground/60 font-semibold">Change</span>
              <span className="font-serif text-2xl tracking-tight text-foreground tabular-nums">
                ₱{(payment - total).toFixed(0)}
              </span>
            </div>
          ) : (
            <p className="text-xs text-red-500 uppercase tracking-widest font-semibold">
              Short ₱{(total - payment).toFixed(0)}
            </p>
          )
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-0.5">
          <button
            onClick={onClear}
            disabled={items.length === 0}
            className="flex-none border border-foreground/13 text-foreground/55 text-xs uppercase tracking-widest py-3 px-4 hover:border-foreground/25 hover:text-foreground/75 transition-colors disabled:opacity-30 disabled:cursor-not-allowed rounded-sm font-semibold"
          >
            Clear
          </button>
          <button
            onClick={onCharge}
            disabled={items.length === 0}
            className="flex-1 bg-foreground text-cream text-sm uppercase tracking-widest py-3.5 font-bold hover:bg-foreground/90 active:scale-[0.99] transition-all disabled:opacity-30 disabled:cursor-not-allowed rounded-sm"
          >
            Charge ₱{total.toFixed(0)}
          </button>
        </div>
      </div>
    </div>
  )
}
