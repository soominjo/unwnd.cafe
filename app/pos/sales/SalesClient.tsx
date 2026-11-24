'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Sale } from '../types'
import { computeDateRange, isDetailedPeriod, isPeriod, periodLabel, type Period } from './dateRange'
import PeriodFilter, { type PeriodUpdates } from './PeriodFilter'
import KpiStrip from './KpiStrip'
import ViewTabs, { type View } from './ViewTabs'
import OrdersView, { type OrderActions } from './OrdersView'
import TopItemsView from './TopItemsView'
import TopCustomersView from './TopCustomersView'
import TallyView from './TallyView'
import UndoToast from './UndoToast'
import { sendRename } from './sendRename'
import { sendMethodChange } from './sendMethodChange'
import { showsReload } from './serving'
import { useServing, type SalesList } from './useServing'
import { ErrorBanner } from './ui'
import type { PaymentMethod } from '@/lib/sales/payments'

const PAGE_SIZE = 20

interface NavigateUpdates extends PeriodUpdates {
  page?: number
}

type OrderStatus = 'pending' | 'completed'

// On a day or a short range the summary also lists every payment, for the Tally tab's lists.
async function fetchSummary(from: string, to: string, lines: boolean, signal: AbortSignal) {
  const qs = new URLSearchParams({ from, to, ...(lines ? { lines: '1' } : {}) })
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
  // On a long period, Recent/Completed aren't offered — fall back to Top Items rather
  // than showing a tab that isn't in the bar (the raw `view` state is left untouched,
  // so switching back to Today/Yesterday restores whichever tab was picked there).
  const activeView: View = detailed || view === 'summary' || view === 'names' || view === 'tally' ? view : 'summary'
  // The period's summary, and the orders scoped to the active tab's status (pending/completed),
  // not "every order on page 1 of the whole period". Ticks change both on screen before the server answers.
  const [list, setList] = useState<SalesList>({ orders: [], summary: null })
  const { orders, summary } = list
  // The list on screen now, for replies that land after a render: kept with every change of it.
  const listRef = useRef(list)
  const showList = useCallback((next: SalesList) => {
    listRef.current = next
    setList(next)
  }, [])
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

  // ── Ticks: items served one by one, Complete, and Undo ─────────────────────
  // Each shows at once, then goes to the server; the list reloads quietly (no skeleton) once all are in.
  const serving = useServing({
    read: () => listRef.current,
    write: showList,
    where: `${activeView}|${period}|${customFrom}|${customTo}|${page}`,
    onError: setError,
    onSettled: () => refreshQuietly(),
  })
  const { busy: servingBusy, version: servingVersion } = serving

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
  // A quiet load (after a tick, or another tab's sale) keeps the list on screen instead of the skeleton.
  // Only the latest load shows, and a quiet one only if every tick on screen is in it (see showsReload).
  const loadSeq = useRef(0)
  // Set while the skeleton waits for a list: a quiet load then ends the wait, or says why it failed.
  const awaitingList = useRef(false)
  const load = useCallback(async (from: string, to: string, currentView: View, pg: number, detailed: boolean, signal: AbortSignal, quiet = false) => {
    const seq = ++loadSeq.current
    const version = servingVersion()
    if (!quiet) {
      awaitingList.current = true
      setLoading(true)
      setError(null)
    }
    const superseded = () => signal.aborted || seq !== loadSeq.current
    function fail(message: string) {
      if (!quiet || awaitingList.current) setError(message)
      awaitingList.current = false
      setLoading(false)
    }
    try {
      const status: OrderStatus = currentView === 'completed' ? 'completed' : 'pending'
      const wantsOrders = detailed && currentView !== 'summary' && currentView !== 'names' && currentView !== 'tally'
      const [summaryJson, ordersJson] = await Promise.all([
        fetchSummary(from, to, detailed, signal),
        wantsOrders ? fetchOrders(from, to, status, pg, signal) : null,
      ])
      if (superseded()) return
      if (!summaryJson.success || (ordersJson && !ordersJson.success)) return fail('Failed to load sales data.')
      if (!showsReload({ waiting: awaitingList.current, busy: servingBusy(), changed: servingVersion() !== version })) return
      showList({ orders: ordersJson ? ordersJson.data : [], summary: summaryJson.data })
      setTotal(ordersJson ? ordersJson.total ?? 0 : 0)
      awaitingList.current = false
      setLoading(false)
    } catch (err) {
      if ((err instanceof DOMException && err.name === 'AbortError') || superseded()) return
      fail('Network error. Check your connection.')
    }
  }, [servingBusy, servingVersion, showList])

  // Re-fetch when the period, page, or active tab changes
  useEffect(() => {
    const range = computeDateRange(period, customFrom, customTo)
    if (!range) return
    const controller = new AbortController()
    load(range.from, range.to, activeView, page, detailed, controller.signal)
    return () => controller.abort()
  }, [period, page, customFrom, customTo, activeView, detailed, load])

  // Keep a ref to current params so BroadcastChannel refresh can read them
  const fetchParamsRef = useRef({ period, page, customFrom, customTo, view: activeView, detailed })
  useEffect(() => {
    fetchParamsRef.current = { period, page, customFrom, customTo, view: activeView, detailed }
  })

  // Reloads the list where it is now without the skeleton: after ticks, or a sale from another tab.
  function refreshQuietly() {
    const { period: p, page: pg, customFrom: cf, customTo: ct, view: v, detailed: d } = fetchParamsRef.current
    const range = computeDateRange(p, cf, ct)
    if (!range) return
    load(range.from, range.to, v, pg, d, new AbortController().signal, true)
  }

  // BroadcastChannel (same-browser live update) + bfcache restore
  useEffect(() => {
    function refresh() {
      const { period: p, page: pg, customFrom: cf, customTo: ct, view: v, detailed: d } = fetchParamsRef.current
      const range = computeDateRange(p, cf, ct)
      if (!range) return
      load(range.from, range.to, v, pg, d, new AbortController().signal, true)
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

  // Deleting, removing a line, renaming and moving a payment re-fetch rather than hand-patching
  // local state: orders are scoped by status, and the KPI/badge counts must stay in sync with
  // whichever page we land on. (Ticks show at once instead: see useServing.)
  function refreshCurrent() {
    const range = computeDateRange(period, customFrom, customTo)
    if (!range) return
    const controller = new AbortController()
    load(range.from, range.to, activeView, page, detailed, controller.signal)
  }

  // ── Delete whole order ─────────────────────────────────────────────────────
  async function deleteOrder(id: string) {
    setDeletingId(id)
    setConfirmId(null)
    try {
      const res = await fetch(`/api/sales/${id}`, { method: 'DELETE' })
      // Already deleted, on another device say: refresh so its row goes too.
      if (res.status === 404) {
        refreshCurrent()
        return
      }
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

  // ── Name the order ─────────────────────────────────────────────────────────
  // Resolves to null when done, else to why the name wasn't saved: the card shows it by the field.
  async function renameOrder(id: string, name: string): Promise<string | null> {
    const { error: problem, gone } = await sendRename(id, name)
    if (problem && !gone) return problem
    refreshCurrent()
    // Deleted on another device: the refresh takes its card away, and the banner says why.
    if (gone) setError(problem)
    return null
  }

  // ── Fix a payment's method ─────────────────────────────────────────────────
  // Resolves to null when done, else to why the payment wasn't moved: shown beside it.
  async function changeMethod(saleId: string, paymentKey: string, method: PaymentMethod): Promise<string | null> {
    const { error: problem, gone } = await sendMethodChange(saleId, paymentKey, method)
    if (problem && !gone) return problem
    refreshCurrent()
    // Deleted on another device: the refresh takes it away, and the banner says why.
    if (gone) setError(problem)
    return null
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
    onRequestDeleteOrder: requestDeleteOrder,
    onCancelDeleteOrder: () => setConfirmId(null),
    onConfirmDeleteOrder: deleteOrder,
    onRequestDeleteItem: requestDeleteItem,
    onCancelDeleteItem: () => setConfirmItemKey(null),
    onConfirmDeleteItem: removeItem,
    onCompleteOrder: serving.complete,
    onServeLine: serving.serveLine,
    onUnserveLine: serving.unserveLine,
    onOpenTab: changeView,
    // A full page load, like the POS link: /pos reads the order on the server with the menu.
    onAddItems: (id: string) => window.location.assign(`/pos?edit=${encodeURIComponent(id)}`),
    onRenameOrder: renameOrder,
    onChangeMethod: changeMethod,
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
          view={activeView}
          onChange={changeView}
          pendingCount={summary?.pendingCount ?? 0}
          completedCount={summary?.completedCount ?? 0}
          partlyServedCount={summary?.partlyServedCount ?? 0}
          loading={loading}
          detailed={detailed}
        />

        <UndoToast bar={serving.undoBar} />

        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {activeView === 'summary' ? (
          <TopItemsView summary={summary} loading={loading} />
        ) : activeView === 'names' ? (
          <TopCustomersView summary={summary} loading={loading} />
        ) : activeView === 'tally' ? (
          <TallyView summary={summary} loading={loading} detailed={detailed} onChangeMethod={changeMethod} />
        ) : (
          <OrdersView
            {...sharedOrdersProps}
            mode={activeView === 'completed' ? 'completed' : 'recent'}
            orders={orders}
            onConfirmDeleteAll={deleteOrderList}
          />
        )}
      </main>
    </div>
  )
}
