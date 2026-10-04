'use client'

import { useState } from 'react'
import type { OpenSaleProblem } from '@/lib/sales/loadOpenSale'
import type { OpenOrder } from './addToOrder'
import { formatPHClock } from './sales/dateRange'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

interface AddingBannerProps {
  order: OpenOrder
  /** Items in the cart: Cancel asks before dropping them. */
  newItems: number
  /** Back to Sales, the order as saved. */
  onCancel: () => void
}

// Under the POS header while "Add items" has a saved order open: which order the new lines go
// onto, and the way back to Sales.
export function AddingBanner({ order, newItems, onCancel }: AddingBannerProps) {
  const [confirming, setConfirming] = useState(false)
  const savedItems = order.items.reduce((n, i) => n + (i.isAddon ? 0 : i.qty), 0)
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-2.5 bg-sky-50 border-b border-sky-200 shrink-0">
      <p className="text-sm text-sky-950">
        <span className="font-semibold">
          Adding to {order.name ? `${order.name}’s order` : 'an order with no name'} · {formatPHClock(order.createdAt)}
        </span>
        <span className="text-sky-900/70"> · {plural(savedItems, 'item')} saved · ₱{order.total}</span>
      </p>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-sky-950">
          <span>Drop the {plural(newItems, 'new item')}? The order stays as saved.</span>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="h-9 px-3 rounded-sm text-[11px] font-bold uppercase tracking-widest text-sky-900 hover:bg-sky-100 transition-colors"
          >
            Keep adding
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-3 rounded-sm bg-red-500 text-white text-[11px] font-bold uppercase tracking-widest hover:bg-red-600 transition-colors"
          >
            Drop them
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => (newItems > 0 ? setConfirming(true) : onCancel())}
          className="h-9 px-3 shrink-0 rounded-sm border border-sky-300 text-[11px] font-bold uppercase tracking-widest text-sky-900 hover:bg-sky-100 transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  )
}

const PROBLEMS: Record<OpenSaleProblem, string> = {
  completed: 'That order was completed, so nothing more can be added to it. This is a new order.',
  gone: 'That order no longer exists. This is a new order.',
  unreadable: 'That order could not be opened. This is a new order: try Add items on Sales again.',
}

/** Why the order "Add items" asked for could not be opened; the POS started a new order. */
export function OpenOrderNotice({ problem, onDismiss }: { problem: OpenSaleProblem; onDismiss: () => void }) {
  return (
    <div role="status" className="flex items-center justify-between gap-3 px-6 py-2.5 bg-amber-50 border-b border-amber-200 shrink-0">
      <span className="text-xs text-amber-800 font-medium">{PROBLEMS[problem]}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="h-9 px-3 shrink-0 rounded-sm text-[11px] font-bold uppercase tracking-widest text-amber-800 hover:bg-amber-100 transition-colors"
      >
        OK
      </button>
    </div>
  )
}
