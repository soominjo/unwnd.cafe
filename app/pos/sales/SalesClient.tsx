'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Sale, SalesSummary } from '../types'
import { computeDateRange, isPeriod, periodLabel, type Period } from './dateRange'
import PeriodFilter, { type PeriodUpdates } from './PeriodFilter'
import KpiStrip from './KpiStrip'
import ViewTabs, { type View } from './ViewTabs'
import OrdersView, { type OrderActions } from './OrdersView'
import TopItemsView from './TopItemsView'
import { ErrorBanner } from './ui'

const PAGE_SIZE = 20

interface NavigateUpdates extends PeriodUpdates {
  page?: number
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

  // ── Local UI state ─────────────────────────────────────────────────────────
  const [view, setView] = useState<View>('recent')
  const [summary, setSummary] = useState<SalesSummary | null>(null)
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

  // ── Data fetching ──────────────────────────────────────────────────────────
  const fetchData = useCallback(async (from: string, to: string, pg: number, signal: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const summaryQs = new URLSearchParams({ from, to })
      const ordersQs = new URLSearchParams({ from, to, page: String(pg), limit: String(PAGE_SIZE) })
      const [summaryRes, ordersRes] = await Promise.all([
        fetch(`/api/sales/summary?${summaryQs}`, { signal }),
        fetch(`/api/sales?${ordersQs}`, { signal }),
      ])
      if (signal.aborted) return
      const summaryJson = await summaryRes.json()
      const ordersJson = await ordersRes.json()
      if (!summaryJson.success || !ordersJson.success) {
        setError('Failed to load sales data.')
        return
      }
      setSummary(summaryJson.data)
      setOrders(ordersJson.data)
      setTotal(ordersJson.total ?? 0)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setError('Network error. Check your connection.')
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [])

  // Re-fetch when URL filter params change
  useEffect(() => {
    const range = computeDateRange(period, customFrom, customTo)
    if (!range) return
    const controller = new AbortController()
    fetchData(range.from, range.to, page, controller.signal)
    return () => controller.abort()
  }, [period, page, customFrom, customTo, fetchData])

  // Keep a ref to current params so BroadcastChannel refresh can read them
  const fetchParamsRef = useRef({ period, page, customFrom, customTo })
  useEffect(() => {
    fetchParamsRef.current = { period, page, customFrom, customTo }
  })

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
      const res = await fetch(`/api/sales/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Failed to delete order.')
        return
      }
      setOrders((prev) => prev.filter((o) => o._id !== id))
      setTotal((prev) => Math.max(0, prev - 1))
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
      if (data.orderDeleted) {
        setOrders((prev) => prev.filter((o) => o._id !== orderId))
        setTotal((prev) => Math.max(0, prev - 1))
      } else {
        setOrders((prev) =>
          prev.map((o) => {
            if (o._id !== orderId) return o
            const newItems = o.items.filter((i) => i.lineId !== lineId)
            const newTotal = newItems.reduce((sum, i) => sum + i.price * i.qty, 0)
            return { ...o, items: newItems, total: newTotal }
          }),
        )
      }
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
      const deletedIds = results
        .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
        .map((r) => r.value)
      const failedCount = results.filter((r) => r.status === 'rejected').length
      if (failedCount > 0) setError(`${failedCount} order(s) could not be deleted.`)
      setOrders((prev) => prev.filter((o) => !deletedIds.includes(o._id)))
      setTotal((prev) => Math.max(0, prev - deletedIds.length))
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
      setOrders((prev) => prev.map((o) => (o._id === id ? { ...o, isCompleted: true } : o)))
    } catch {
      setError('Network error. Could not complete order.')
    } finally {
      setCompletingId(null)
    }
  }

  // ── Derived lists ──────────────────────────────────────────────────────────
  const pendingOrders = orders.filter((o) => !o.isCompleted)
  const completedOrders = orders.filter((o) => o.isCompleted === true)
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
          onChange={setView}
          pendingCount={pendingOrders.length}
          completedCount={completedOrders.length}
          loading={loading}
        />

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {view === 'summary' ? (
          <TopItemsView summary={summary} loading={loading} />
        ) : view === 'recent' ? (
          <OrdersView
            {...sharedOrdersProps}
            mode="recent"
            orders={pendingOrders}
            onConfirmDeleteAll={() => deleteOrderList(pendingOrders)}
          />
        ) : (
          <OrdersView
            {...sharedOrdersProps}
            mode="completed"
            orders={completedOrders}
            onConfirmDeleteAll={() => deleteOrderList(completedOrders)}
          />
        )}
      </main>
    </div>
  )
}
