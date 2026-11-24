import { groupSaleItems, isAddonLine, variantClass } from '../utils'
import type { SaleItem } from '../types'
import { saleRounds, type SaleRound } from '@/lib/sales/rounds'
import QtyBadge from '../QtyBadge'
import { formatPHClock } from './dateRange'
import { CheckIcon } from './icons'
import { InlineConfirm, RemoveButton } from './ui'

export interface OrderLinesProps {
  orderId: string
  /** The lines this tab shows: those still to serve (Recent orders), or those that went out (Completed). */
  lines: readonly SaleItem[]
  /** These lines went out: their checks are filled, and a tap sends one back to Recent orders. */
  served: boolean
  confirmItemKey: string | null
  deletingItemKey: string | null
  /** A tap on a line's check: ticks it (Recent orders) or sends it back (Completed). */
  onToggleServed: (lineId: string) => void
  onRequestDeleteItem: (lineId: string) => void
  onCancelDeleteItem: () => void
  onConfirmDeleteItem: (lineId: string) => void
}

/** A card's lines, grouped as they were ordered: the first checkout's, then each group added later. */
export default function OrderLines(props: OrderLinesProps) {
  return (
    <>
      {saleRounds(props.lines).map(round => (
        <OrderRound key={round.addedAt ?? 'first'} round={round} {...props} />
      ))}
    </>
  )
}

interface OrderRoundProps extends OrderLinesProps {
  round: SaleRound<SaleItem>
}

/** One group of the lines shown: the first checkout's, or one added later under the time it was added. */
function OrderRound({ round, orderId, served, confirmItemKey, deletingItemKey, ...props }: OrderRoundProps) {
  const { topLevel, addonsByParent } = groupSaleItems(round.items)
  const roundItems = round.items.reduce((sum, item) => sum + (item.isAddon ? 0 : item.qty), 0)
  return (
    <div>
      {round.addedAt && (
        <p className="border-y border-sky-200 bg-sky-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700">
          Added {formatPHClock(round.addedAt)} · {roundItems} {roundItems === 1 ? 'item' : 'items'}
        </p>
      )}
      <div className="divide-y divide-border/60">
        {topLevel.map((item) => {
          const itemKey = `${orderId}:${item.lineId}`
          const addons = addonsByParent.get(item.lineId) ?? []
          return (
            <div key={item.lineId} className={`px-1.5 py-2 ${served ? 'bg-emerald-600/6' : ''}`}>
              <ItemRow
                item={item}
                served={served}
                isConfirming={confirmItemKey === itemKey}
                isDeleting={deletingItemKey === itemKey}
                onToggleServed={() => props.onToggleServed(item.lineId)}
                onRequestRemove={() => props.onRequestDeleteItem(item.lineId)}
                onCancelRemove={props.onCancelDeleteItem}
                onConfirmRemove={() => props.onConfirmDeleteItem(item.lineId)}
              />
              {addons.length > 0 && (
                // Under the item's name: an add-on has no check of its own, it goes out with its item.
                <div className="mt-1 ml-13 flex flex-col gap-1.5">
                  {addons.map((addon) => {
                    const addonKey = `${orderId}:${addon.lineId}`
                    return (
                      <AddonRow
                        key={addon.lineId}
                        addon={addon}
                        isConfirming={confirmItemKey === addonKey}
                        isDeleting={deletingItemKey === addonKey}
                        onRequestRemove={() => props.onRequestDeleteItem(addon.lineId)}
                        onCancelRemove={props.onCancelDeleteItem}
                        onConfirmRemove={() => props.onConfirmDeleteItem(addon.lineId)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface ServeCheckProps {
  name: string
  served: boolean
  onToggle: () => void
}

/**
 * The round check before a line: empty while it is still to serve, filled once it went out. A toggle:
 * its name stays "Classic Fries served" and aria-pressed says whether it is (the time shows as text).
 */
function ServeCheck({ name, served, onToggle }: ServeCheckProps) {
  return (
    <button
      type="button"
      aria-pressed={served}
      aria-label={`${name} served`}
      onClick={onToggle}
      className="group flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${
          served
            ? 'border-emerald-600 bg-emerald-600 text-white group-hover:border-emerald-700 group-hover:bg-emerald-700'
            : 'border-foreground/40 bg-white text-transparent group-hover:border-emerald-600 group-hover:text-emerald-600/40'
        }`}
      >
        <CheckIcon strokeWidth={3} />
      </span>
    </button>
  )
}

interface ItemRowProps {
  item: SaleItem
  served: boolean
  isConfirming: boolean
  isDeleting: boolean
  onToggleServed: () => void
  onRequestRemove: () => void
  onCancelRemove: () => void
  onConfirmRemove: () => void
}

function ItemRow({ item, served, isConfirming, isDeleting, onToggleServed, onRequestRemove, onCancelRemove, onConfirmRemove }: ItemRowProps) {
  if (isDeleting) {
    return <p className="px-2.5 py-2 text-[11px] uppercase tracking-widest text-foreground/35 animate-pulse">Removing…</p>
  }
  if (isConfirming) {
    return (
      <div className="px-2.5">
        <InlineConfirm
          message={
            <>
              Remove <strong className="font-semibold text-foreground">{item.name}</strong>?
            </>
          }
          confirmLabel="Remove"
          onCancel={onCancelRemove}
          onConfirm={onConfirmRemove}
        />
      </div>
    )
  }
  return (
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto_auto_auto] items-center gap-x-2">
      {/* An add-on sold on its own has no check: it goes with the order. */}
      {isAddonLine(item) ? <span aria-hidden="true" /> : <ServeCheck name={item.name} served={served} onToggle={onToggleServed} />}
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-foreground">{item.name}</span>
          {item.variant && (
            <span className={`text-[10px] font-bold uppercase tracking-wider ${variantClass(item.variant)}`}>{item.variant}</span>
          )}
        </div>
        {item.note && <p className="mt-0.5 text-[11px] text-amber-700">{item.note}</p>}
        {served && item.servedAt && <p className="mt-0.5 text-[11px] font-semibold text-emerald-700">{`Served ${formatPHClock(item.servedAt)}`}</p>}
      </div>
      {/* Every line gets the quantity mark, ×1 included, so the count reads at a glance while preparing. */}
      <QtyBadge qty={item.qty} className="min-w-11" />
      <span className="w-16 text-right text-sm font-semibold tabular-nums text-foreground">
        ₱{(item.price * item.qty).toLocaleString()}
      </span>
      <RemoveButton aria-label={`Remove ${item.name}`} onClick={onRequestRemove} />
    </div>
  )
}

interface AddonRowProps {
  addon: SaleItem
  isConfirming: boolean
  isDeleting: boolean
  onRequestRemove: () => void
  onCancelRemove: () => void
  onConfirmRemove: () => void
}

/** An add-on nested under its parent item — a light-blue "+" chip rather than its own separate line/box. */
function AddonRow({ addon, isConfirming, isDeleting, onRequestRemove, onCancelRemove, onConfirmRemove }: AddonRowProps) {
  if (isDeleting) {
    return <p className="text-[11px] uppercase tracking-widest text-foreground/35 animate-pulse">Removing…</p>
  }
  if (isConfirming) {
    return (
      <InlineConfirm
        message={
          <>
            Remove <strong className="font-semibold text-foreground">{addon.name}</strong>?
          </>
        }
        confirmLabel="Remove"
        onCancel={onCancelRemove}
        onConfirm={onConfirmRemove}
      />
    )
  }
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold text-foreground">
        <span>+</span>
        {addon.name}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-xs tabular-nums text-foreground/50">×{addon.qty}</span>
        <span className="w-16 text-right text-xs font-semibold tabular-nums text-foreground/80">
          ₱{(addon.price * addon.qty).toLocaleString()}
        </span>
        <RemoveButton aria-label={`Remove ${addon.name}`} onClick={onRequestRemove} />
      </div>
    </div>
  )
}
