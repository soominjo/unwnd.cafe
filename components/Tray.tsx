'use client'

import { useCartStore } from '@/store/useCartStore'
import { AnimatePresence, motion } from 'framer-motion'

export default function Tray() {
  const items = useCartStore((s) => s.items)
  const total = useCartStore((s) => s.totalPrice())
  const isTrayOpen = useCartStore((s) => s.isTrayOpen)
  const closeTray = useCartStore((s) => s.closeTray)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)

  return (
    <AnimatePresence>
      {isTrayOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeTray}
            className="fixed inset-0 z-50 bg-black/20"
          />

          {/* Panel */}
          <motion.aside
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-sm bg-white flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-7 border-b border-border">
              <h2 className="text-xs uppercase tracking-[0.25em]">Your Tray</h2>
              <button
                onClick={closeTray}
                aria-label="Close tray"
                className="text-muted hover:text-foreground transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {items.length === 0 ? (
                <p className="text-muted text-sm font-light mt-8 text-center">
                  Your tray is empty.
                </p>
              ) : (
                <ul className="space-y-6">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-light">{item.name}</p>
                        <p className="text-[11px] text-muted mt-0.5 uppercase tracking-wider">
                          qty {item.quantity} · ${item.price.toFixed(2)} ea
                        </p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-sm font-medium">
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeItem(item.id)}
                          aria-label={`Remove ${item.name}`}
                          className="text-muted hover:text-foreground transition-colors text-sm"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="px-8 py-7 border-t border-border space-y-6">
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-muted">
                    Estimated Total
                  </span>
                  <span className="text-2xl font-serif">${total.toFixed(2)}</span>
                </div>
                <button
                  onClick={clearCart}
                  className="w-full border border-black py-3 text-[11px] uppercase tracking-[0.2em] hover:bg-black hover:text-white transition-all duration-300"
                >
                  Clear Tray
                </button>
                <p className="text-[10px] text-muted text-center">
                  Prices are estimates only. Order &amp; pay at the counter.
                </p>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
