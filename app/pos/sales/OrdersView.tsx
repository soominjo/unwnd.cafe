import type { Sale } from '../types'
import OrderCard, { type OrdersMode } from './OrderCard'
import Pagination from './Pagination'
import { TrashIcon } from './icons'
import { ActionButton, EmptyState, InlineConfirm, Skeleton } from './ui'

/** Per-order mutation state and callbacks, owned by SalesClient and threaded down to each card. */
export interface OrderActions {
  confirmId: string | null
  deletingId: string | null
  confirmItemKey: string | null
  deletingItemKey: string | null
  completingId: string | null
  onRequestDeleteOrder: (id: string) => void
  onCancelDeleteOrder: () => void
  onConfirmDeleteOrder: (id: string) => void
  onRequestDeleteItem: (key: string) => void
  onCancelDeleteItem: () => void
  onConfirmDeleteItem: (orderId: string, lineId: string) => void
  onCompleteOrder: (id: string) => void
}

interface OrdersViewProps {
  mode: OrdersMode
  orders: Sale[]
  loading: boolean
  /** Orders in the whole period (both tabs) — pagination is over this, filtering by tab happens client-side. */
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  confirmAll: boolean
  deletingAll: boolean
  onRequestDeleteAll: () => void
  onCancelDeleteAll: () => void
  onConfirmDeleteAll: () => void
  actions: OrderActions
}

function emptyState(mode: OrdersMode, total: number) {
  if (mode === 'completed') {
    return { title: 'No completed orders yet.', hint: 'Orders you mark as complete will show up here.' }
  }
  if (total === 0) {
    return { title: 'No orders in this period.', hint: 'Sales from the POS appear here as they come in.' }
  }
  return { title: 'All caught up.', hint: 'Every order on this page is completed.' }
}

export default function OrdersView(props: OrdersViewProps) {
  const { mode, orders, loading, total, page, totalPages, onPageChange, actions } = props

  if (loading) return <Skeleton rows={4} />
  if (orders.length === 0) {
    const { title, hint } = emptyState(mode, total)
    return <EmptyState title={title} hint={hint} />
  }

  return (
    <div className="space-y-3">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/40">
          {orders.length} {mode === 'completed' ? 'completed' : 'pending'}
          {totalPages > 1 && ` · page ${page} of ${totalPages}`}
        </span>
        {props.deletingAll ? (
          <span className="text-[10px] uppercase tracking-widest text-foreground/30 animate-pulse">Deleting…</span>
        ) : props.confirmAll ? (
          <InlineConfirm
            message={`Delete ${orders.length} ${orders.length === 1 ? 'order' : 'orders'}?`}
            confirmLabel="Delete all"
            onCancel={props.onCancelDeleteAll}
            onConfirm={props.onConfirmDeleteAll}
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
            isCompleting={actions.completingId === order._id}
            confirmItemKey={actions.confirmItemKey}
            deletingItemKey={actions.deletingItemKey}
            onRequestDelete={() => actions.onRequestDeleteOrder(order._id)}
            onCancelDelete={actions.onCancelDeleteOrder}
            onConfirmDelete={() => actions.onConfirmDeleteOrder(order._id)}
            onRequestDeleteItem={(lineId) => actions.onRequestDeleteItem(`${order._id}:${lineId}`)}
            onCancelDeleteItem={actions.onCancelDeleteItem}
            onConfirmDeleteItem={(lineId) => actions.onConfirmDeleteItem(order._id, lineId)}
            onCompleteOrder={() => actions.onCompleteOrder(order._id)}
          />
        ))}
      </div>

      {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onChange={onPageChange} />}
    </div>
  )
}
