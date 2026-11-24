import { afterServing, afterUnserving, splitServed, topLevelLines } from '@/lib/sales/served'
import type { Sale, SaleItem, SalesSummary } from '../types'
import { formatPHClock } from './dateRange'
import type { OrdersMode } from './OrderCard'
import type { ServeRequest } from './sendServe'

// How the Sales screen shows a tick before the server answers. Each order has
// two halves: what is still to serve (under Recent orders) and what went out
// (under Completed). The rules for which line is which live in lib/sales/served.ts,
// shared with the API. This file only applies them to what is on screen.

/** Whether the order shows under the tab: Recent until every item is out, Completed once any is. */
export function showsIn(mode: OrdersMode, order: Sale): boolean {
  if (mode === 'recent') return order.isCompleted !== true
  return order.isCompleted === true || splitServed(order).served.length > 0
}

/** The order as it will be once the server has the request, so the screen can show it at once. */
export function servedLocally(order: Sale, request: ServeRequest, at: string): Sale {
  const change =
    request.kind === 'unserve'
      ? afterUnserving(order, request.lineIds, at)
      : afterServing(order, request.kind === 'complete' ? topLevelLines(order.items).map(line => line.lineId) : request.lineIds, at)
  // Complete completes the order even when it has no line to tick (an add-on sold on its own).
  return { ...order, items: change.items, isCompleted: request.kind === 'complete' || change.isCompleted }
}

function servedLines(order: Sale): SaleItem[] {
  return splitServed(order).served
}

function notIn(lines: readonly SaleItem[]): (line: SaleItem) => boolean {
  const ids = new Set(lines.map(line => line.lineId))
  return line => !ids.has(line.lineId)
}

/** The request that puts the order back as it was before it became `after`: null when nothing moved. */
export function undoRequest(before: Sale, after: Sale): ServeRequest | null {
  const ticked = servedLines(after).filter(notIn(servedLines(before)))
  if (ticked.length > 0) return { kind: 'unserve', lineIds: ticked.map(line => line.lineId) }
  const unticked = servedLines(before).filter(notIn(servedLines(after)))
  return unticked.length > 0 ? { kind: 'serve', lineIds: unticked.map(line => line.lineId) } : null
}

function orderTitle(order: Sale): string {
  const name = order.notes?.trim()
  return name ? `${name}’s order` : `The ${formatPHClock(order._createdAt)} order`
}

function itemsLabel(lines: readonly SaleItem[]): string {
  return lines.length === 1 ? lines[0].name : `${lines.length} items`
}

/** What the Undo bar says about a change: the item that moved and where to, or that the order is complete. */
export function changeMessage(before: Sale, after: Sale): string {
  if (after.isCompleted === true && before.isCompleted !== true) return `${orderTitle(after)} is complete`
  const ticked = servedLines(after).filter(notIn(servedLines(before)))
  if (ticked.length > 0) return `${itemsLabel(ticked)} moved to Completed`
  return `${itemsLabel(servedLines(before).filter(notIn(servedLines(after))))} moved back to Recent`
}

/** The list with the order's new version in its place. A missing order goes in by time, newest first, when `insert` is set. */
export function withOrder(orders: readonly Sale[], order: Sale, insert: boolean): Sale[] {
  if (orders.some(o => o._id === order._id)) return orders.map(o => (o._id === order._id ? order : o))
  if (!insert) return [...orders]
  const next = orders.findIndex(o => o._createdAt < order._createdAt)
  return next === -1 ? [...orders, order] : [...orders.slice(0, next), order, ...orders.slice(next)]
}

/** Where things stood when a reload of the list came back. */
export interface ReloadState {
  /** The skeleton is up, waiting for a list: a change of tab, period or page, or a first load. */
  waiting: boolean
  /** A tick is on its way to the server or waiting to go. */
  busy: boolean
  /** A tick was shown since the reload began. */
  changed: boolean
}

/**
 * Whether a reload that came back goes on screen. A quiet reload may predate a tick on screen: it is
 * dropped, and the quiet reload once every tick is in shows instead. A list the skeleton waits for
 * always shows, so a slow tick never holds up a change of tab, period or page.
 */
export function showsReload({ waiting, busy, changed }: ReloadState): boolean {
  return waiting || (!busy && !changed)
}

/** Which of the tab counts an order is in: 1 or 0 each. */
function countedIn(order: Sale): { pending: number; completed: number; partly: number } {
  const completed = order.isCompleted === true
  const out = servedLines(order).length > 0
  return { pending: completed ? 0 : 1, completed: completed || out ? 1 : 0, partly: !completed && out ? 1 : 0 }
}

/** The tab counts once one order changed from `before` to `after`: the rest of the summary is kept. */
export function countsAfter(summary: SalesSummary, before: Sale, after: Sale): SalesSummary {
  const was = countedIn(before)
  const now = countedIn(after)
  return {
    ...summary,
    pendingCount: summary.pendingCount + now.pending - was.pending,
    completedCount: summary.completedCount + now.completed - was.completed,
    partlyServedCount: (summary.partlyServedCount ?? 0) + now.partly - was.partly,
  }
}
