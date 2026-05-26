'use client'

import { useState, useMemo } from 'react'
import { MENU } from './menuData'
import type { MenuItem, OrderItem, Variant } from './types'

export default function POSClient() {
  const [activeCategory, setActiveCategory] = useState(0)
  const [orderItems, setOrderItems]         = useState<OrderItem[]>([])
  const [showConfirm, setShowConfirm]       = useState(false)
  const [mobileDrawer, setMobileDrawer]     = useState(false)
  const [payment, setPayment]               = useState<number | null>(null)
  const [customInput, setCustomInput]       = useState('')

  const total = useMemo(
    () => orderItems.reduce((sum, i) => sum + i.price * i.qty, 0),
    [orderItems]
  )

  const itemCount = useMemo(
    () => orderItems.reduce((sum, i) => sum + i.qty, 0),
    [orderItems]
  )

  function addItem(item: MenuItem, variant: Variant | null) {
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
  }

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
        <span className="font-serif text-2xl lowercase tracking-tight text-cream">unwnd. pos</span>
        <button
          className="lg:hidden flex items-center gap-3 text-base text-cream/80 hover:text-cream transition-colors py-2 px-4 border border-cream/25 rounded-sm"
          onClick={() => setMobileDrawer(true)}
        >
          {itemCount > 0 && (
            <span className="bg-cream text-foreground text-sm font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {itemCount}
            </span>
          )}
          Order ›
        </button>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: menu */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          <div className="flex gap-2 px-6 py-4 border-b border-border shrink-0 overflow-x-auto scrollbar-none">
            {MENU.map((cat, i) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(i)}
                className={`px-5 py-2.5 text-sm font-medium uppercase tracking-widest rounded-sm whitespace-nowrap transition-colors ${
                  activeCategory === i
                    ? 'bg-foreground text-cream'
                    : 'text-foreground/50 hover:text-foreground border border-border hover:border-foreground/30'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
            {category.items.map(item => (
              <ItemCard key={item.id} item={item} onAdd={addItem} />
            ))}
          </div>
        </div>

        {/* Right: order panel — desktop only */}
        <aside className="hidden lg:flex w-100 xl:w-110 flex-col border-l border-border bg-white shrink-0">
          <OrderPanel
            items={orderItems}
            total={total}
            payment={payment}
            customInput={customInput}
            onAdjust={adjustQty}
            onClear={clearOrder}
            onCharge={() => setShowConfirm(true)}
            onSetPayment={handleSetPayment}
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
          <div className="relative z-50 bg-white border-t border-border flex flex-col max-h-[85vh] rounded-t-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
              <span className="text-base font-semibold uppercase tracking-widest text-foreground">Your Order</span>
              <button
                className="text-foreground/40 hover:text-foreground text-2xl leading-none w-10 h-10 flex items-center justify-center transition-colors"
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
              onAdjust={adjustQty}
              onClear={clearOrder}
              onCharge={() => { setMobileDrawer(false); setShowConfirm(true) }}
              onSetPayment={handleSetPayment}
            />
          </div>
        </div>
      )}

      {/* ── Confirm modal ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConfirm(false)} />
          <div className="relative z-50 bg-white border border-border p-8 w-full max-w-md rounded-sm shadow-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-foreground/40 mb-3">Total Due</p>
            <p className="font-serif text-7xl tracking-tight text-foreground mb-1">₱{total.toFixed(0)}</p>
            <p className="text-foreground/40 text-sm mb-6">
              {itemCount} item{itemCount !== 1 ? 's' : ''} · {orderItems.length} line{orderItems.length !== 1 ? 's' : ''}
            </p>

            {/* Order summary */}
            <div className="border-t border-border pt-4 mb-6 space-y-2 max-h-48 overflow-y-auto">
              {orderItems.map(item => (
                <div key={item.lineId} className="flex justify-between text-sm text-foreground/70">
                  <span>
                    {item.name}
                    {item.variant && (
                      <span className={`ml-1 text-xs uppercase font-medium ${
                        item.variant === 'hot' ? 'text-red-500' : 'text-sky-500'
                      }`}>({item.variant})</span>
                    )}
                    {item.qty > 1 && <span className="text-foreground/40 ml-1">×{item.qty}</span>}
                  </span>
                  <span className="tabular-nums font-medium text-foreground">₱{(item.price * item.qty).toFixed(0)}</span>
                </div>
              ))}
            </div>

            {/* Change summary (read-only — set in the order panel) */}
            {payment !== null && (
              <div className="border-t border-border pt-4 mb-6 flex items-baseline justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-foreground/40">Payment</p>
                  <p className="font-semibold tabular-nums text-foreground mt-0.5">₱{payment.toFixed(0)}</p>
                </div>
                {payment >= total ? (
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-[0.3em] text-foreground/40">Change</p>
                    <p className="font-serif text-4xl tracking-tight text-foreground tabular-nums mt-0.5">
                      ₱{(payment - total).toFixed(0)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-red-500 uppercase tracking-widest">
                    Short ₱{(total - payment).toFixed(0)}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 border border-border text-foreground/50 text-sm uppercase tracking-widest py-4 hover:border-foreground/30 hover:text-foreground/70 transition-colors rounded-sm"
              >
                Cancel
              </button>
              <button
                onClick={clearOrder}
                className="flex-2 bg-foreground text-cream text-sm uppercase tracking-widest py-4 font-bold hover:bg-foreground/90 transition-colors rounded-sm"
              >
                Order Complete ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Item Card ────────────────────────────────────────────────────────────────

function ItemCard({
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
    <div className="bg-white border border-border rounded-sm p-4 flex flex-col gap-4 hover:border-foreground/20 hover:shadow-sm transition-all">
      <div className="flex-1">
        <p className="text-base font-semibold leading-snug text-foreground">{item.name}</p>
        <p className="text-xs text-foreground/40 mt-1 leading-relaxed">{item.subtitle}</p>
      </div>

      {isFood ? (
        <button
          onClick={() => onAdd(item, null)}
          className="w-full bg-[#1E5223] hover:bg-[#245f29] active:bg-[#2a6b30] text-cream py-4 rounded-sm transition-colors flex flex-col items-center gap-1"
        >
          <span className="text-xs text-cream/60 uppercase tracking-widest">Add</span>
          <span className="text-xl font-semibold tabular-nums">₱{item.priceFixed}</span>
        </button>
      ) : (
        <div className={`grid gap-2 ${hasHot && hasIce ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {hasHot && (
            <button
              onClick={() => onAdd(item, 'hot')}
              className="bg-[#1E5223] hover:bg-[#245f29] active:bg-[#2a6b30] text-cream py-4 rounded-sm transition-colors flex flex-col items-center gap-1"
            >
              <span className="text-xs text-cream/60 uppercase tracking-widest">Hot</span>
              <span className="text-xl font-semibold tabular-nums">₱{item.priceHot}</span>
            </button>
          )}
          {hasIce && (
            <button
              onClick={() => onAdd(item, 'ice')}
              className="bg-[#1a5535] hover:bg-[#1f6340] active:bg-[#24704a] text-cream py-4 rounded-sm transition-colors flex flex-col items-center gap-1"
            >
              <span className="text-xs text-cream/60 uppercase tracking-widest">Ice</span>
              <span className="text-xl font-semibold tabular-nums">₱{item.priceIce}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Order Panel ──────────────────────────────────────────────────────────────

function OrderPanel({
  items,
  total,
  payment,
  customInput,
  onAdjust,
  onClear,
  onCharge,
  onSetPayment,
}: {
  items: OrderItem[]
  total: number
  payment: number | null
  customInput: string
  onAdjust: (lineId: string, delta: number) => void
  onClear: () => void
  onCharge: () => void
  onSetPayment: (amount: number | null, raw: string) => void
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-5 border-b border-border shrink-0">
        <p className="text-xs uppercase tracking-[0.25em] text-foreground/40">Current Order</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-1">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 gap-3">
            <p className="text-foreground/15 text-4xl">—</p>
            <p className="text-foreground/25 text-sm">No items added yet</p>
          </div>
        ) : (
          items.map(item => (
            <div
              key={item.lineId}
              className="flex items-center gap-3 py-3.5 border-b border-border last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium leading-tight text-foreground">{item.name}</p>
                {item.variant && (
                  <p className={`text-xs uppercase tracking-wider mt-0.5 font-semibold ${
                    item.variant === 'hot' ? 'text-red-500' : 'text-sky-500'
                  }`}>
                    {item.variant}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onAdjust(item.lineId, -1)}
                    className="w-9 h-9 flex items-center justify-center text-foreground/40 hover:text-foreground border border-border hover:border-foreground/30 rounded-sm text-lg font-light transition-colors"
                  >
                    −
                  </button>
                  <span className="w-6 text-center text-base tabular-nums font-semibold text-foreground">{item.qty}</span>
                  <button
                    onClick={() => onAdjust(item.lineId, 1)}
                    className="w-9 h-9 flex items-center justify-center text-foreground/40 hover:text-foreground border border-border hover:border-foreground/30 rounded-sm text-lg font-light transition-colors"
                  >
                    +
                  </button>
                </div>
                <span className="text-base tabular-nums w-16 text-right font-semibold text-foreground">
                  ₱{(item.price * item.qty).toFixed(0)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="px-6 pt-5 pb-4 border-t border-border shrink-0 space-y-4">
        {/* Total */}
        <div className="flex justify-between items-center">
          <span className="text-sm uppercase tracking-widest text-foreground/40">Total</span>
          <span className="font-serif text-5xl tabular-nums text-foreground">₱{total.toFixed(0)}</span>
        </div>

        {/* Payment */}
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.25em] text-foreground/35">Payment</p>
          <div className="flex gap-2">
            {[500, 1000, 2000].map(amt => (
              <button
                key={amt}
                onClick={() => onSetPayment(amt, String(amt))}
                disabled={items.length === 0}
                className={`flex-1 py-2.5 text-sm font-semibold tabular-nums rounded-sm border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                  payment === amt
                    ? 'bg-foreground text-cream border-foreground'
                    : 'border-border text-foreground hover:border-foreground/40'
                }`}
              >
                ₱{amt}
              </button>
            ))}
          </div>
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
            className="w-full border border-border rounded-sm px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/25 focus:outline-none focus:border-foreground/50 disabled:opacity-30"
          />
          {payment !== null && items.length > 0 && (
            payment >= total ? (
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-[10px] uppercase tracking-[0.25em] text-foreground/35">Change</span>
                <span className="font-serif text-3xl tracking-tight text-foreground tabular-nums">
                  ₱{(payment - total).toFixed(0)}
                </span>
              </div>
            ) : (
              <p className="text-xs text-red-500 uppercase tracking-widest pt-1">
                Short ₱{(total - payment).toFixed(0)}
              </p>
            )
          )}
        </div>

        {/* Actions */}
        <button
          onClick={onClear}
          disabled={items.length === 0}
          className="w-full border border-border text-foreground/40 text-xs uppercase tracking-widest py-3 hover:border-foreground/25 hover:text-foreground/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed rounded-sm"
        >
          Clear Order
        </button>
        <button
          onClick={onCharge}
          disabled={items.length === 0}
          className="w-full bg-foreground text-cream text-base uppercase tracking-widest py-5 font-bold hover:bg-foreground/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed rounded-sm"
        >
          Charge ₱{total.toFixed(0)}
        </button>
      </div>
    </div>
  )
}
