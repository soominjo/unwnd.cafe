import type { OpenOrder } from './addToOrder'
import { groupSaleItems, variantClass } from './utils'
import { formatPHClock } from './sales/dateRange'
import { LockIcon } from './sales/icons'

// The saved part of an order "Add items" opened, in the order panel below the new lines,
// which are what the cashier is working on. It is locked: a saved line comes off with ✕ on
// Sales, as before.
export default function SavedOrderLines({ order }: { order: OpenOrder }) {
  const { topLevel, addonsByParent } = groupSaleItems(order.items)
  return (
    <section aria-label="Already ordered" className="-mx-6 mt-2 px-6 py-2.5 bg-foreground/3 border-y border-foreground/10">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-foreground/50">Already ordered · {formatPHClock(order.createdAt)}</p>
        <span className="text-xs font-semibold tabular-nums text-foreground/50">₱{order.total}</span>
      </div>
      {topLevel.map(item => (
        <div key={item.lineId} className="py-1">
          <div className="flex items-center gap-2 text-sm text-foreground/60">
            <LockIcon width={12} height={12} className="shrink-0 text-foreground/35" />
            <span className="flex-1 min-w-0 truncate">
              <span className="font-medium">{item.name}</span>
              {item.variant && (
                <span className={`ml-2 text-[10px] uppercase tracking-wider font-bold ${variantClass(item.variant)}`}>{item.variant}</span>
              )}
            </span>
            <span className="text-xs font-bold tabular-nums">×{item.qty}</span>
            <span className="w-14 text-right tabular-nums">₱{item.price * item.qty}</span>
          </div>
          {(addonsByParent.get(item.lineId) ?? []).map(addon => (
            <div key={addon.lineId} className="flex items-center gap-2 pl-5 text-xs text-foreground/50">
              <span className="flex-1 min-w-0 truncate">+ {addon.name}</span>
              <span className="tabular-nums">×{addon.qty}</span>
              <span className="w-14 text-right tabular-nums">₱{addon.price * addon.qty}</span>
            </div>
          ))}
        </div>
      ))}
      {order.discounts.map(d => (
        <div key={`${d.lineId}:${d.name}`} className="flex justify-between gap-2 text-[11px] font-semibold text-emerald-700/80">
          <span className="truncate">{d.name}</span>
          <span className="tabular-nums shrink-0">−₱{d.amount}</span>
        </div>
      ))}
      <p className="pt-1 text-[11px] text-foreground/45">Saved lines stay as they are. To take one off, use ✕ on Sales.</p>
    </section>
  )
}
