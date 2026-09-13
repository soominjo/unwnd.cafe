'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Sale, SalesSummary } from '../types'
import { computeDateRange, isDetailedPeriod, isPeriod, periodLabel, type Period } from './dateRange'
import PeriodFilter, { type PeriodUpdates } from './PeriodFilter'
import KpiStrip from './KpiStrip'
import ViewTabs, { type SummaryTab, type View } from './ViewTabs'
import OrdersView, { type OrderActions } from './OrdersView'
import TopItemsView from './TopItemsView'
import TopCustomersView from './TopCustomersView'
import { ErrorBanner } from './ui'

const PAGE_SIZE = 20

interface NavigateUpdates extends PeriodUpdates {
  page?: number
}

type OrderStatus = 'pending' | 'completed'

async function fetchSummary(from: string, to: string, signal: AbortSignal) {
  const qs = new URLSearchParams({ from, to })
  const res = await fetch(`/api/sales/summary?${qs}`, { signal })
  return res.json()
}

async function fetchOrders(from: string, to: string, status: OrderStatus, page: number, signal: AbortSignal) {
  const qs = new URLSearchParams({ from, to, status, page: String(page), limit: String(PAGE_SIZE) })
  const res = await fetch(`/api/sales?${qs}`, { signal })
  return res.json()
}

export default function SalesClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // ── URL-derived filter state (single source of truth) ─────────────────────
  const rawPeriod = searchParams.get('period') ?? 'today'
  const period: Period = isPeriod(rawPeriod) ? rawPeriod : 'today'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const customFrom = searchParams.get('customFrom') ?? ''
  const customTo = searchParams.get('customTo') ?? ''
  const detailed = isDetailedPeriod(period, customFrom, customTo)

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [view, setView] = useState<View>('recent')
  // Which of Top Items / Top Names shows on a long (!detailed) period.
  const [summaryTab, setSummaryTab] = useState<SummaryTab>('items')
  const [summary, setSummary] = useState<SalesSummary | null>(null)
  // Scoped to the active tab's status (pending/completed) — not "every order on the page 1 of the whole period".
  const [orders, setOrders] = useState<Sale[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Order-level delete
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Item-level delete (key = `${orderId}:${lineId}`)
  const [confirmItemKey, setConfirmItemKey] = useState<string | null>(null)
  const [deletingItemKey, setDeletingItemKey] = useState<string | null>(null)

  // Delete all (tab-aware)
  const [confirmAll, setConfirmAll] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  // Complete order
  const [completingId, setCompletingId] = useState<string | null>(null)

  // ── URL navigation helper ──────────────────────────────────────────────────
  function navigate(updates: NavigateUpdates) {
    const params = new URLSearchParams(searchParams.toString())
    const newPeriod = updates.period ?? period

    if (updates.period !== undefined) {
      params.set('period', updates.period)
      params.delete('page')
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

  function changeView(next: View) {
    setView(next)
    navigate({ page: 1 })
  }

  // ── Data fetching ──────────────────────────────────────────────────────────
  // Orders are fetched scoped to the active tab's status, with their own whole-period
  // total/pagination — otherwise "Recent"/"Completed" only ever reflected whichever
  // statuses happened to land on the newest 20 sales overall, regardless of period.
  // For a long period (`!detailed`) orders aren't fetched at all — Top Items/Customers
  // is the only view shown, so there's no list to paginate through in the first place.
  const load = useCallback(async (from: string, to: string, currentView: View, pg: number, detailed: boolean, signal: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const status: OrderStatus = currentView === 'completed' ? 'completed' : 'pending'
      const [summaryJson, ordersJson] = await Promise.all([
        fetchSummary(from, to, signal),
        detailed && currentView !== 'summary' ? fetchOrders(from, to, status, pg, signal) : null,
      ])
      if (signal.aborted) return
      if (!summaryJson.success || (ordersJson && !ordersJson.success)) {
        setError('Failed to load sales data.')
        return
      }
      setSummary(summaryJson.data)
      setOrders(ordersJson ? ordersJson.data : [])
      setTotal(ordersJson ? ordersJson.total ?? 0 : 0)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError('Network error. Check your connection.')
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [])

  // Re-fetch when the period, page, or active tab changes
  useEffect(() => {
    const range = computeDateRange(period, customFrom, customTo)
    if (!range) return
    const controller = new AbortController()
    load(range.from, range.to, view, page, detailed, controller.signal)
    return () => controller.abort()
  }, [period, page, customFrom, customTo, view, detailed, load])

  // Keep a ref to current params so BroadcastChannel refresh can read them
  const fetchParamsRef = useRef({ period, page, customFrom, customTo, view, detailed })
  useEffect(() => {
    fetchParamsRef.current = { period, page, customFrom, customTo, view, detailed }
  })

  // BroadcastChannel (same-browser live update) + bfcache restore
  useEffect(() => {
    function refresh() {
      const { period: p, page: pg, customFrom: cf, customTo: ct, view: v, detailed: d } = fetchParamsRef.current
      const range = computeDateRange(p, cf, ct)
      if (!range) return
      const controller = new AbortController()
      load(range.from, range.to, v, pg, d, controller.signal)
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
  }, [load])

  // Every mutation below re-fetches rather than hand-patching local state: orders are
  // now scoped by status, so e.g. completing an order must actually leave the "recent"
  // list, and the KPI/badge counts must stay in sync with whichever page we land on.
  function refreshCurrent() {
    const range = computeDateRange(period, customFrom, customTo)
    if (!range) return
    const controller = new AbortController()
    load(range.from, range.to, view, page, detailed, controller.signal)
  }

  // ── Delete whole order ─────────────────────────────────────────────────────
  async function deleteOrder(id: string) {
    setDeletingId(id)
    setConfirmId(null)
    try {
      const res = await fetch(`/api/sales/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to delete order.')
        return
      }
      refreshCurrent()
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
      const res = await fetch(`/api/sales/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeLineId: lineId }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to remove item.')
        return
      }
      refreshCurrent()
    } catch {
      setError('Network error. Could not remove item.')
    } finally {
      setDeletingItemKey(null)
    }
  }

  // ── Delete a specific list of orders (used for tab-aware "Delete all") ─────
  async function deleteOrderList(ordersToDelete: Sale[]) {
    setDeletingAll(true)
    setConfirmAll(false)
    try {
      const results = await Promise.allSettled(
        ordersToDelete.map(async (o) => {
          const res = await fetch(`/api/sales/${o._id}`, { method: 'DELETE' })
          const data = await res.json()
          if (!res.ok || !data.success) throw new Error(o._id)
          return o._id
        }),
      )
      const failedCount = results.filter((r) => r.status === 'rejected').length
      if (failedCount > 0) setError(`${failedCount} order(s) could not be deleted.`)
      refreshCurrent()
    } catch {
      setError('Network error. Could not delete all orders.')
    } finally {
      setDeletingAll(false)
    }
  }

  // ── Complete order ─────────────────────────────────────────────────────────
  async function completeOrder(id: string) {
    setCompletingId(id)
    try {
      const res = await fetch(`/api/sales/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markCompleted: true }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to complete order.')
        return
      }
      refreshCurrent()
    } catch {
      setError('Network error. Could not complete order.')
    } finally {
      setCompletingId(null)
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Only one inline confirmation is open at a time.
  function requestDeleteOrder(id: string) {
    setConfirmAll(false)
    setConfirmItemKey(null)
    setConfirmId(id)
  }
  function requestDeleteItem(key: string) {
    setConfirmId(null)
    setConfirmAll(false)
    setConfirmItemKey(key)
  }
  function requestDeleteAll() {
    setConfirmId(null)
    setConfirmItemKey(null)
    setConfirmAll(true)
  }

  const orderActions: OrderActions = {
    confirmId,
    deletingId,
    confirmItemKey,
    deletingItemKey,
    completingId,
    onRequestDeleteOrder: requestDeleteOrder,
    onCancelDeleteOrder: () => setConfirmId(null),
    onConfirmDeleteOrder: deleteOrder,
    onRequestDeleteItem: requestDeleteItem,
    onCancelDeleteItem: () => setConfirmItemKey(null),
    onConfirmDeleteItem: removeItem,
    onCompleteOrder: completeOrder,
  }

  const sharedOrdersProps = {
    loading,
    total,
    page,
    totalPages,
    onPageChange: (pg: number) => navigate({ page: pg }),
    confirmAll,
    deletingAll,
    onRequestDeleteAll: requestDeleteAll,
    onCancelDeleteAll: () => setConfirmAll(false),
    actions: orderActions,
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between bg-foreground px-6 py-4">
        <div className="flex items-baseline gap-3">
          <span className="font-logo text-2xl lowercase tracking-tight text-cream">unwnd. sales</span>
          <span className="hidden text-[10px] uppercase tracking-[0.25em] text-cream/40 sm:inline">{periodLabel(period)}</span>
        </div>
        <a href="/pos" className="text-xs uppercase tracking-[0.2em] text-cream/50 transition-colors hover:text-cream">
          ← POS
        </a>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6">
        <PeriodFilter period={period} customFrom={customFrom} customTo={customTo} onChange={navigate} />

        <KpiStrip summary={summary} loading={loading} />

        <ViewTabs
          view={view}
          onChange={changeView}
          pendingCount={summary?.pendingCount ?? 0}
          completedCount={summary?.completedCount ?? 0}
          loading={loading}
          detailed={detailed}
          summaryTab={summaryTab}
          onSummaryTabChange={setSummaryTab}
        />

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {!detailed ? (
          summaryTab === 'items' ? (
            <TopItemsView summary={summary} loading={loading} />
          ) : (
            <TopCustomersView summary={summary} loading={loading} />
          )
        ) : view === 'summary' ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <TopItemsView summary={summary} loading={loading} />
            <TopCustomersView summary={summary} loading={loading} />
          </div>
        ) : (
          <OrdersView
            {...sharedOrdersProps}
            mode={view === 'completed' ? 'completed' : 'recent'}
            orders={orders}
            onConfirmDeleteAll={() => deleteOrderList(orders)}
          />
        )}
      </main>
    </div>
  )
}
