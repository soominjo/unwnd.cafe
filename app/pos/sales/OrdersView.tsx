import type { Sale } from '../types'
import type { PaymentMethod } from '@/lib/sales/payments'
import { splitServed } from '@/lib/sales/served'
import OrderCard, { type OrdersMode } from './OrderCard'
import Pagination from './Pagination'
import { TrashIcon } from './icons'
import { showsIn } from './serving'
import { ActionButton, EmptyState, InlineConfirm, Skeleton } from './ui'

/** Per-order mutation state and callbacks, owned by SalesClient and threaded down to each card. */
export interface OrderActions {
  confirmId: string | null
  deletingId: string | null
  confirmItemKey: string | null
  deletingItemKey: string | null
  onRequestDeleteOrder: (id: string) => void
  onCancelDeleteOrder: () => void
  onConfirmDeleteOrder: (id: string) => void
  onRequestDeleteItem: (key: string) => void
  onCancelDeleteItem: () => void
  onConfirmDeleteItem: (orderId: string, lineId: string) => void
  /** Ticks every line of the order still to serve. */
  onCompleteOrder: (id: string) => void
  /** Ticks one line as gone out to the customer. */
  onServeLine: (orderId: string, lineId: string) => void
  /** Sends a line that went out back to Recent orders. */
  onUnserveLine: (orderId: string, lineId: string) => void
  /** Opens a tab: a card's strip points to where the rest of its order is. */
  onOpenTab: (mode: OrdersMode) => void
  onAddItems: (id: string) => void
  /** Names the order (empty clears it): resolves to null when done, else to why it wasn't saved. */
  onRenameOrder: (id: string, name: string) => Promise<string | null>
  /** Moves one of the order's payments to another method: null when done, else why not. */
  onChangeMethod: (id: string, paymentKey: string, method: PaymentMethod) => Promise<string | null>
}

interface OrdersViewProps {
  mode: OrdersMode
  /** The tab's page of orders as last loaded, with the changes made on screen since. */
  orders: Sale[]
  loading: boolean
  /** The tab's orders in the whole period, for pagination. */
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  confirmAll: boolean
  deletingAll: boolean
  onRequestDeleteAll: () => void
  onCancelDeleteAll: () => void
  /** Deletes these orders: the ones Delete all counted. */
  onConfirmDeleteAll: (orders: Sale[]) => void
  actions: OrderActions
}

function emptyState(mode: OrdersMode, total: number) {
  if (mode === 'completed') {
    return { title: 'No completed orders yet.', hint: 'Items show up here as you tick them served.' }
  }
  if (total === 0) {
    return { title: 'No orders in this period.', hint: 'Sales from the POS appear here as they come in.' }
  }
  return { title: 'All caught up.', hint: 'Every order on this page is completed.' }
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/**
 * Delete all's question. On Recent it warns about orders with items already out: deleting one
 * takes those items off Completed too, since it is one order.
 */
function deleteAllMessage(mode: OrdersMode, deletable: readonly Sale[]): string {
  const question = `Delete ${plural(deletable.length, 'order')}?`
  if (mode !== 'recent') return question
  const out = deletable.filter(order => splitServed(order).served.length > 0).length
  return out > 0 ? `${question} ${out} already ${out === 1 ? 'has' : 'have'} items out.` : question
}

/** The line above the list: "2 pending", or "1 completed · 1 partly served" under Completed. */
function listLabel(mode: OrdersMode, orders: readonly Sale[]): string {
  if (mode === 'recent') return `${orders.length} pending`
  const partly = orders.filter(order => order.isCompleted !== true).length
  return `${orders.length - partly} completed${partly > 0 ? ` · ${partly} partly served` : ''}`
}

export default function OrdersView(props: OrdersViewProps) {
  const { mode, loading, total, page, totalPages, onPageChange, actions } = props
  // An order changed on screen moves tabs at once, before the list reloads.
  const orders = props.orders.filter(order => showsIn(mode, order))
  // Delete all on Completed leaves partly served orders alone: they still have items to serve.
  const deletable = mode === 'completed' ? orders.filter(order => order.isCompleted === true) : orders

  if (loading) return <Skeleton rows={4} />
  if (orders.length === 0) {
    const { title, hint } = emptyState(mode, total)
    return <EmptyState title={title} hint={hint} />
  }

  return (
    <div className="space-y-3">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/40">
          {listLabel(mode, orders)}
          {totalPages > 1 && ` · page ${page} of ${totalPages}`}
        </span>
        {deletable.length === 0 ? null : props.deletingAll ? (
          <span className="text-[10px] uppercase tracking-widest text-foreground/30 animate-pulse">Deleting…</span>
        ) : props.confirmAll ? (
          <InlineConfirm
            message={deleteAllMessage(mode, deletable)}
            confirmLabel="Delete all"
            onCancel={props.onCancelDeleteAll}
            onConfirm={() => props.onConfirmDeleteAll(deletable)}
          />
        ) : (
          <ActionButton tone="danger" icon={<TrashIcon />} onClick={props.onRequestDeleteAll}>
            Delete all
          </ActionButton>
        )}
      </div>

      <div className="space-y-3">
        {orders.map((order) => (
          <OrderCard
            key={order._id}
            order={order}
            mode={mode}
            isConfirming={actions.confirmId === order._id}
            isDeleting={actions.deletingId === order._id}
            confirmItemKey={actions.confirmItemKey}
            deletingItemKey={actions.deletingItemKey}
            onRequestDelete={() => actions.onRequestDeleteOrder(order._id)}
            onCancelDelete={actions.onCancelDeleteOrder}
            onConfirmDelete={() => actions.onConfirmDeleteOrder(order._id)}
            onRequestDeleteItem={(lineId) => actions.onRequestDeleteItem(`${order._id}:${lineId}`)}
            onCancelDeleteItem={actions.onCancelDeleteItem}
            onConfirmDeleteItem={(lineId) => actions.onConfirmDeleteItem(order._id, lineId)}
            onCompleteOrder={() => actions.onCompleteOrder(order._id)}
            onServeLine={(lineId) => actions.onServeLine(order._id, lineId)}
            onUnserveLine={(lineId) => actions.onUnserveLine(order._id, lineId)}
            onOpenOtherTab={() => actions.onOpenTab(mode === 'recent' ? 'completed' : 'recent')}
            onAddItems={() => actions.onAddItems(order._id)}
            onRename={(name) => actions.onRenameOrder(order._id, name)}
            onChangeMethod={(paymentKey, method) => actions.onChangeMethod(order._id, paymentKey, method)}
          />
        ))}
      </div>

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={onPageChange} />}
    </div>
  )
}
