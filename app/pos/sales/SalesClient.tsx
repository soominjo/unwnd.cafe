'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { variantClass } from '../utils'
import type { Sale, SaleItem, SalesSummary } from '../types'

const PAGE_SIZE    = 20
const PH_OFFSET_MS = 8 * 60 * 60 * 1000
const VALID_PERIODS = ['today', 'week', 'month', 'year', 'custom'] as const

type Period = typeof VALID_PERIODS[number]
type View   = 'orders' | 'summary'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getPHDateRange(period: Exclude<Period, 'custom'>): { from: string; to: string } {
  const nowUTC = Date.now()
  const phNow  = new Date(nowUTC + PH_OFFSET_MS)

  let startPH: Date
  let endPH: Date
  if (period === 'today') {
    startPH = new Date(Date.UTC(phNow.getUTCFullYear(), phNow.getUTCMonth(), phNow.getUTCDate()))
    endPH   = new Date(Date.UTC(phNow.getUTCFullYear(), phNow.getUTCMonth(), phNow.getUTCDate() + 1))
  } else if (period === 'week') {
    const day  = phNow.getUTCDay()
    const diff = day === 0 ? 6 : day - 1
    startPH    = new Date(Date.UTC(phNow.getUTCFullYear(), phNow.getUTCMonth(), phNow.getUTCDate() - diff))
    endPH      = new Date(Date.UTC(phNow.getUTCFullYear(), phNow.getUTCMonth(), phNow.getUTCDate() - diff + 7))
  } else if (period === 'month') {
    startPH = new Date(Date.UTC(phNow.getUTCFullYear(), phNow.getUTCMonth(), 1))
    endPH   = new Date(Date.UTC(phNow.getUTCFullYear(), phNow.getUTCMonth() + 1, 1))
  } else {
    startPH = new Date(Date.UTC(phNow.getUTCFullYear(), 0, 1))
    endPH   = new Date(Date.UTC(phNow.getUTCFullYear() + 1, 0, 1))
  }

  return {
    from: new Date(startPH.getTime() - PH_OFFSET_MS).toISOString(),
    to:   new Date(endPH.getTime()   - PH_OFFSET_MS).toISOString(),
  }
}

// Returns null when custom is selected but dates are incomplete
function computeDateRange(
  period: Period,
  customFrom: string,
  customTo: string,
): { from: string; to: string } | null {
  if (period === 'custom') {
    if (!customFrom || !customTo) return null
    const [y1, m1, d1] = customFrom.split('-').map(Number)
    const [y2, m2, d2] = customTo.split('-').map(Number)
    return {
      from: new Date(Date.UTC(y1, m1 - 1, d1)     - PH_OFFSET_MS).toISOString(),
      to:   new Date(Date.UTC(y2, m2 - 1, d2 + 1) - PH_OFFSET_MS).toISOString(),
    }
  }
  return getPHDateRange(period)
}

function formatPHTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    month:    'short',
    day:      'numeric',
    hour:     'numeric',
    minute:   '2-digit',
    hour12:   true,
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SalesClient() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  // ── URL-derived filter state (single source of truth) ─────────────────────
  const rawPeriod = searchParams.get('period') ?? 'today'
  const period    = (VALID_PERIODS as readonly string[]).includes(rawPeriod)
    ? (rawPeriod as Period)
    : 'today'
  const page       = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const customFrom = searchParams.get('customFrom') ?? ''
  const customTo   = searchParams.get('customTo')   ?? ''

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [view, setView]     = useState<View>('orders')
  const [summary, setSummary]   = useState<SalesSummary | null>(null)
  const [orders, setOrders]     = useState<Sale[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  // Order-level delete
  const [confirmId, setConfirmId]   = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Item-level delete  (key = `${orderId}:${lineId}`)
  const [confirmItemKey, setConfirmItemKey]   = useState<string | null>(null)
  const [deletingItemKey, setDeletingItemKey] = useState<string | null>(null)

  // Delete all
  const [confirmAll, setConfirmAll]   = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  // ── URL navigation helper ──────────────────────────────────────────────────
  function navigate(updates: {
    period?: Period
    page?: number
    customFrom?: string
    customTo?: string
  }) {
    const params   = new URLSearchParams(searchParams.toString())
    const newPeriod = updates.period ?? period

    if (updates.period !== undefined) {
      params.set('period', updates.period)
      params.delete('page') // reset page on filter change
    }
    if (updates.page !== undefined) {
      if (updates.page <= 1) params.delete('page')
      else params.set('page', String(updates.page))
    }
    if (updates.customFrom !== undefined) {
      params.set('customFrom', updates.customFrom)
      params.delete('page')
    }
    if (updates.customTo !== undefined) {
      params.set('customTo', updates.customTo)
      params.delete('page')
    }
    if (newPeriod !== 'custom') {
      params.delete('customFrom')
      params.delete('customTo')
    }
    router.replace(`/pos/sales?${params.toString()}`, { scroll: false })
  }

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async (
    from: string,
    to: string,
    pg: number,
    signal: AbortSignal,
  ) => {
    setLoading(true)
    setError(null)
    try {
      const summaryQs = new URLSearchParams({ from, to })
      const ordersQs  = new URLSearchParams({ from, to, page: String(pg), limit: String(PAGE_SIZE) })
      const [summaryRes, ordersRes] = await Promise.all([
        fetch(`/api/sales/summary?${summaryQs}`, { signal }),
        fetch(`/api/sales?${ordersQs}`, { signal }),
      ])
      if (signal.aborted) return
      const summaryJson = await summaryRes.json()
      const ordersJson  = await ordersRes.json()
      if (!summaryJson.success || !ordersJson.success) {
        setError('Failed to load sales data.')
        return
      }
      setSummary(summaryJson.data)
      setOrders(ordersJson.data)
      setTotal(ordersJson.total ?? 0)
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError('Network error. Check your connection.')
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [])

  // Re-fetch when URL filter params change
  useEffect(() => {
    const range = computeDateRange(period, customFrom, customTo)
    if (!range) return // wait until custom dates are both filled
    const controller = new AbortController()
    fetchData(range.from, range.to, page, controller.signal)
    return () => controller.abort()
  }, [period, page, customFrom, customTo, fetchData])

  // Keep a ref to current params so BroadcastChannel refresh can read them
  const fetchParamsRef = useRef({ period, page, customFrom, customTo })
  useEffect(() => { fetchParamsRef.current = { period, page, customFrom, customTo } })

  // BroadcastChannel (same-browser live update) + bfcache restore
  useEffect(() => {
    function refresh() {
      const { period: p, page: pg, customFrom: cf, customTo: ct } = fetchParamsRef.current
      const range = computeDateRange(p, cf, ct)
      if (!range) return
      const controller = new AbortController()
      fetchData(range.from, range.to, pg, controller.signal)
    }
    const bc = new BroadcastChannel('pos-sales-update')
    bc.onmessage = refresh
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) refresh()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => {
      bc.close()
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [fetchData])

  // ── Delete whole order ─────────────────────────────────────────────────────
  async function deleteOrder(id: string) {
    setDeletingId(id)
    setConfirmId(null)
    try {
      const res  = await fetch(`/api/sales/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.success) { setError(data.error ?? 'Failed to delete order.'); return }
      setOrders(prev => prev.filter(o => o._id !== id))
      setTotal(prev => Math.max(0, prev - 1))
    } catch {
      setError('Network error. Could not delete order.')
    } finally {
      setDeletingId(null)
    }
  }

  // ── Remove item from order ─────────────────────────────────────────────────
  async function removeItem(orderId: string, lineId: string) {
    const key = `${orderId}:${lineId}`
    setDeletingItemKey(key)
    setConfirmItemKey(null)
    try {
      const res  = await fetch(`/api/sales/${orderId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ removeLineId: lineId }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setError(data.error ?? 'Failed to remove item.'); return }
      if (data.orderDeleted) {
        setOrders(prev => prev.filter(o => o._id !== orderId))
        setTotal(prev => Math.max(0, prev - 1))
      } else {
        setOrders(prev => prev.map(o => {
          if (o._id !== orderId) return o
          const newItems = o.items.filter(i => i.lineId !== lineId)
          const newTotal = newItems.reduce((sum, i) => sum + i.price * i.qty, 0)
          return { ...o, items: newItems, total: newTotal }
        }))
      }
    } catch {
      setError('Network error. Could not remove item.')
    } finally {
      setDeletingItemKey(null)
    }
  }

  // ── Delete all (current page) ──────────────────────────────────────────────
  async function deleteAllOrders() {
    setDeletingAll(true)
    setConfirmAll(false)
    try {
      const results = await Promise.allSettled(
        orders.map(async (o) => {
          const res  = await fetch(`/api/sales/${o._id}`, { method: 'DELETE' })
          const data = await res.json()
          if (!res.ok || !data.success) throw new Error(o._id)
          return o._id
        })
      )
      const deletedIds  = results
        .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
        .map(r => r.value)
      const failedCount = results.filter(r => r.status === 'rejected').length
      if (failedCount > 0) setError(`${failedCount} order(s) could not be deleted.`)
      setOrders(prev => prev.filter(o => !deletedIds.includes(o._id)))
      setTotal(prev => Math.max(0, prev - deletedIds.length))
    } catch {
      setError('Network error. Could not delete all orders.')
    } finally {
      setDeletingAll(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const PERIODS: { key: Period; label: string }[] = [
    { key: 'today',  label: 'Today' },
    { key: 'week',   label: 'This Week' },
    { key: 'month',  label: 'This Month' },
    { key: 'year',   label: 'This Year' },
    { key: 'custom', label: 'Custom' },
  ]

  const VIEWS: { key: View; label: string }[] = [
    { key: 'orders',  label: 'Recent Orders' },
    { key: 'summary', label: 'Summary' },
  ]

  // Today in PH time as YYYY-MM-DD for date input max
  const todayPH = (() => {
    const ph = new Date(Date.now() + PH_OFFSET_MS)
    return `${ph.getUTCFullYear()}-${String(ph.getUTCMonth() + 1).padStart(2, '0')}-${String(ph.getUTCDate()).padStart(2, '0')}`
  })()

  return (
    <div className="min-h-screen bg-background text-foreground">

      <header className="bg-foreground px-6 py-4 flex items-center justify-between shrink-0">
        <span className="font-serif text-2xl lowercase tracking-tight text-cream">unwnd. sales</span>
        <a href="/pos" className="text-xs uppercase tracking-[0.2em] text-cream/40 hover:text-cream/70 transition-colors">
          ← POS
        </a>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Period tabs */}
        <div className="flex gap-2 flex-wrap items-center">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => navigate({ period: key })}
              className={`px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-all duration-200 ${
                period === key
                  ? 'bg-foreground text-cream border border-foreground'
                  : 'text-foreground border border-foreground/20 hover:border-foreground/40 hover:text-foreground/75'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom date pickers */}
        {period === 'custom' && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase tracking-widest text-foreground/50 font-bold">From</label>
              <input
                type="date"
                max={customTo || todayPH}
                value={customFrom}
                onChange={e => navigate({ period: 'custom', customFrom: e.target.value })}
                className="border border-foreground/20 rounded-sm px-3 py-1.5 text-sm text-foreground bg-transparent focus:outline-none focus:border-foreground/50"
              />
            </div>
            <span className="text-foreground/30">—</span>
            <div className="flex items-center gap-2">
              <label className="text-[10px] uppercase tracking-widest text-foreground/50 font-bold">To</label>
              <input
                type="date"
                min={customFrom || undefined}
                max={todayPH}
                value={customTo}
                onChange={e => navigate({ period: 'custom', customTo: e.target.value })}
                className="border border-foreground/20 rounded-sm px-3 py-1.5 text-sm text-foreground bg-transparent focus:outline-none focus:border-foreground/50"
              />
            </div>
            {(!customFrom || !customTo) && (
              <span className="text-xs text-foreground/40">Select both dates to view results</span>
            )}
          </div>
        )}

        {/* View tabs */}
        <div className="flex gap-6 border-b border-foreground/10">
          {VIEWS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`pb-3 text-xs font-bold uppercase tracking-widest transition-all border-b-2 -mb-px ${
                view === key
                  ? 'text-foreground border-foreground'
                  : 'text-foreground/35 border-transparent hover:text-foreground/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-500 uppercase tracking-widest">{error}</p>
        )}

        {view === 'summary' ? (
          <SummaryView summary={summary} loading={loading} />
        ) : (
          <>
            <OrdersView
              orders={orders}
              loading={loading}
              total={total}
              page={page}
              totalPages={totalPages}
              onPageChange={(pg) => navigate({ page: pg })}
              confirmId={confirmId}
              deletingId={deletingId}
              confirmItemKey={confirmItemKey}
              deletingItemKey={deletingItemKey}
              confirmAll={confirmAll}
              deletingAll={deletingAll}
              onRequestDeleteOrder={(id) => { setConfirmAll(false); setConfirmItemKey(null); setConfirmId(id) }}
              onCancelDeleteOrder={() => setConfirmId(null)}
              onConfirmDeleteOrder={deleteOrder}
              onRequestDeleteItem={(k) => { setConfirmId(null); setConfirmAll(false); setConfirmItemKey(k) }}
              onCancelDeleteItem={() => setConfirmItemKey(null)}
              onConfirmDeleteItem={(orderId, lineId) => removeItem(orderId, lineId)}
              onRequestDeleteAll={() => { setConfirmId(null); setConfirmItemKey(null); setConfirmAll(true) }}
              onCancelDeleteAll={() => setConfirmAll(false)}
              onConfirmDeleteAll={deleteAllOrders}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ─── Summary View ─────────────────────────────────────────────────────────────

function SummaryView({ summary, loading }: { summary: SalesSummary | null; loading: boolean }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Total Revenue" value={loading ? '—' : `₱${(summary?.totalRevenue ?? 0).toLocaleString()}`} />
        <KpiCard label="Orders"        value={loading ? '—' : String(summary?.orderCount ?? 0)} />
        <KpiCard label="Avg Order"     value={loading ? '—' : `₱${Math.round(summary?.avgOrderValue ?? 0).toLocaleString()}`} />
      </div>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/55 mb-4">Top Items</h2>
        {loading ? (
          <Skeleton rows={5} />
        ) : summary && summary.topItems.length > 0 ? (
          <div className="border border-border divide-y divide-border">
            <div className="grid grid-cols-12 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-foreground/55">
              <span className="col-span-1">#</span>
              <span className="col-span-5">Item</span>
              <span className="col-span-2 text-center">Variant</span>
              <span className="col-span-2 text-right">Qty</span>
              <span className="col-span-2 text-right">Revenue</span>
            </div>
            {summary.topItems.map((item, i) => (
              <div key={`${item.name}-${item.variant}`} className="grid grid-cols-12 px-4 py-3 text-sm">
                <span className="col-span-1 text-foreground/30 tabular-nums">{i + 1}</span>
                <span className="col-span-5 font-medium text-foreground">{item.name}</span>
                <span className={`col-span-2 text-center text-xs uppercase tracking-wider font-semibold ${variantClass(item.variant)}`}>
                  {item.variant ?? '—'}
                </span>
                <span className="col-span-2 text-right tabular-nums text-foreground/70">{item.qtySold}</span>
                <span className="col-span-2 text-right tabular-nums font-semibold text-foreground">
                  ₱{item.revenue.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-foreground/25 text-sm">No sales in this period.</p>
        )}
      </section>
    </div>
  )
}

// ─── Orders View ──────────────────────────────────────────────────────────────

interface OrdersViewProps {
  orders: Sale[]
  loading: boolean
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  confirmId: string | null
  deletingId: string | null
  confirmItemKey: string | null
  deletingItemKey: string | null
  confirmAll: boolean
  deletingAll: boolean
  onRequestDeleteOrder: (id: string) => void
  onCancelDeleteOrder: () => void
  onConfirmDeleteOrder: (id: string) => void
  onRequestDeleteItem: (key: string) => void
  onCancelDeleteItem: () => void
  onConfirmDeleteItem: (orderId: string, lineId: string) => void
  onRequestDeleteAll: () => void
  onCancelDeleteAll: () => void
  onConfirmDeleteAll: () => void
}

function OrdersView(props: OrdersViewProps) {
  const {
    orders, loading, total, page, totalPages, onPageChange,
    confirmAll, deletingAll, onRequestDeleteAll, onCancelDeleteAll, onConfirmDeleteAll,
  } = props

  if (loading) return <Skeleton rows={8} />
  if (orders.length === 0 && total === 0) return <p className="text-foreground/25 text-sm">No orders yet.</p>

  return (
    <div className="space-y-3">

      {/* Delete-all bar */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/35">
          {total} order{total !== 1 ? 's' : ''}
          {totalPages > 1 && ` · page ${page} of ${totalPages}`}
        </span>
        {deletingAll ? (
          <span className="text-[10px] uppercase tracking-widest text-foreground/30 animate-pulse">Deleting…</span>
        ) : confirmAll ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-foreground/55">Delete {orders.length} order{orders.length !== 1 ? 's' : ''} on this page?</span>
            <button onClick={onCancelDeleteAll} className="text-[10px] uppercase tracking-widest font-bold text-foreground/40 hover:text-foreground/70 transition-colors px-2 py-1">
              Cancel
            </button>
            <button onClick={onConfirmDeleteAll} className="text-[10px] uppercase tracking-widest font-bold text-red-500 hover:text-red-600 transition-colors px-2 py-1 border border-red-400/40 hover:border-red-500/60 rounded-sm">
              Delete
            </button>
          </div>
        ) : (
          <button onClick={onRequestDeleteAll} className="text-[10px] uppercase tracking-widest font-bold text-red-500 hover:text-red-700 transition-colors">
            Delete All
          </button>
        )}
      </div>

      {/* Table */}
      {orders.length > 0 && (
        <div className="border border-border divide-y divide-border">
          <div className="grid grid-cols-12 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-foreground/55">
            <span className="col-span-5">Item</span>
            <span className="col-span-2 text-center">Variant</span>
            <span className="col-span-2 text-right">Qty</span>
            <span className="col-span-3 text-right">Revenue</span>
          </div>
          {orders.map((order) => (
            <OrderGroup
              key={order._id}
              order={order}
              isConfirming={props.confirmId === order._id}
              isDeleting={props.deletingId === order._id}
              confirmItemKey={props.confirmItemKey}
              deletingItemKey={props.deletingItemKey}
              onRequestDelete={() => props.onRequestDeleteOrder(order._id)}
              onCancelDelete={props.onCancelDeleteOrder}
              onConfirmDelete={() => props.onConfirmDeleteOrder(order._id)}
              onRequestDeleteItem={(lineId) => props.onRequestDeleteItem(`${order._id}:${lineId}`)}
              onCancelDeleteItem={props.onCancelDeleteItem}
              onConfirmDeleteItem={(lineId) => props.onConfirmDeleteItem(order._id, lineId)}
              orderId={order._id}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-4 py-2 text-xs font-bold uppercase tracking-widest border border-foreground/20 text-foreground/60 hover:border-foreground/50 hover:text-foreground transition-all disabled:opacity-25 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | '…')[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('…')
                acc.push(p)
                return acc
              }, [])
              .map((p, i) =>
                p === '…' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-foreground/30 text-xs">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => onPageChange(p as number)}
                    className={`w-8 h-8 text-xs font-bold transition-all ${
                      page === p
                        ? 'bg-foreground text-cream'
                        : 'text-foreground/55 hover:text-foreground border border-foreground/15 hover:border-foreground/40'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
          </div>

          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-4 py-2 text-xs font-bold uppercase tracking-widest border border-foreground/20 text-foreground/60 hover:border-foreground/50 hover:text-foreground transition-all disabled:opacity-25 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Order Group ──────────────────────────────────────────────────────────────

interface OrderGroupProps {
  order: Sale
  orderId: string
  isConfirming: boolean
  isDeleting: boolean
  confirmItemKey: string | null
  deletingItemKey: string | null
  onRequestDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
  onRequestDeleteItem: (lineId: string) => void
  onCancelDeleteItem: () => void
  onConfirmDeleteItem: (lineId: string) => void
}

function OrderGroup({
  order, orderId, isConfirming, isDeleting,
  confirmItemKey, deletingItemKey,
  onRequestDelete, onCancelDelete, onConfirmDelete,
  onRequestDeleteItem, onCancelDeleteItem, onConfirmDeleteItem,
}: OrderGroupProps) {
  return (
    <div className="divide-y divide-border">

      {/* Order header row */}
      <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-foreground/[0.035]">
        {isConfirming ? (
          <>
            <span className="text-xs font-semibold text-foreground/70">Delete this order?</span>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={onCancelDelete} className="text-[10px] uppercase tracking-widest font-bold text-foreground/45 hover:text-foreground/70 transition-colors px-2 py-1">
                Cancel
              </button>
              <button onClick={onConfirmDelete} className="text-[10px] uppercase tracking-widest font-bold text-red-500 hover:text-red-600 transition-colors px-2 py-1 border border-red-400/40 hover:border-red-500/60 rounded-sm">
                Delete
              </button>
            </div>
          </>
        ) : isDeleting ? (
          <span className="text-xs text-foreground/30 uppercase tracking-widest animate-pulse">Deleting…</span>
        ) : (
          <>
            <span className="text-xs font-semibold text-foreground/60 tracking-wide">
              {formatPHTime(order._createdAt)}
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-sans font-extrabold text-sm tracking-tight text-foreground tabular-nums">
                ₱{order.total.toLocaleString()}
              </span>
              <button
                onClick={onRequestDelete}
                className="text-red-400 hover:text-red-600 transition-colors w-5 h-5 flex items-center justify-center text-base"
                aria-label="Delete order"
              >
                ×
              </button>
            </div>
          </>
        )}
      </div>

      {/* Item rows */}
      {order.items.map((item: SaleItem) => {
        const itemKey        = `${orderId}:${item.lineId}`
        const isItemConfirm  = confirmItemKey === itemKey
        const isItemDeleting = deletingItemKey === itemKey

        if (isItemConfirm) {
          return (
            <div key={item.lineId} className="flex items-center justify-between gap-4 px-4 py-3">
              <span className="text-xs text-foreground/60 font-medium truncate">
                Remove <span className="text-foreground/85">{item.name}</span>?
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={onCancelDeleteItem} className="text-[10px] uppercase tracking-widest font-bold text-foreground/40 hover:text-foreground/70 transition-colors px-2 py-1">
                  Cancel
                </button>
                <button onClick={() => onConfirmDeleteItem(item.lineId)} className="text-[10px] uppercase tracking-widest font-bold text-red-500 hover:text-red-600 transition-colors px-2 py-1 border border-red-400/40 hover:border-red-500/60 rounded-sm">
                  Remove
                </button>
              </div>
            </div>
          )
        }

        if (isItemDeleting) {
          return (
            <div key={item.lineId} className="px-4 py-3 text-[10px] uppercase tracking-widest text-foreground/25 animate-pulse">
              Removing…
            </div>
          )
        }

        return (
          <div key={item.lineId} className="grid grid-cols-12 px-4 py-3 text-sm">
            <span className="col-span-5 font-medium text-foreground">{item.name}</span>
            <span className={`col-span-2 text-center text-xs uppercase tracking-wider font-semibold ${variantClass(item.variant)}`}>
              {item.variant ?? '—'}
            </span>
            <span className="col-span-2 text-right tabular-nums text-foreground/70">{item.qty}</span>
            <span className="col-span-2 text-right tabular-nums font-semibold text-foreground">
              ₱{(item.price * item.qty).toLocaleString()}
            </span>
            <span className="col-span-1 flex justify-end items-center">
              <button
                onClick={() => onRequestDeleteItem(item.lineId)}
                className="text-red-400 hover:text-red-600 transition-colors w-5 h-5 flex items-center justify-center text-base"
                aria-label={`Remove ${item.name}`}
              >
                ×
              </button>
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border p-5">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground/55 mb-2">{label}</p>
      <p className="font-sans text-3xl font-black tracking-tight text-foreground tabular-nums">{value}</p>
    </div>
  )
}

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={`skel-${i}`} className="h-10 bg-foreground/5 animate-pulse" />
      ))}
    </div>
  )
}
