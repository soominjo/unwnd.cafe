'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Sale, SalesSummary } from '../types'
import { createServeQueue } from './serveQueue'
import { sendServe, type ServeRequest, type ServeResult } from './sendServe'
import { changeMessage, countsAfter, servedLocally, undoRequest, withOrder } from './serving'

/** How long the Undo bar stays after a tick, an untick or Complete. */
export const UNDO_MS = 5000

/** What the Sales screen shows of the tab: its orders, and the period's counts. */
export interface SalesList {
  orders: Sale[]
  summary: SalesSummary | null
}

/** What the Undo bar offers: the change that puts the order back as it was. */
export interface UndoOffer {
  orderId: string
  /** What the bar says, such as "Classic Fries moved to Completed". */
  message: string
  request: ServeRequest
  /** The order as the change left it: put back on screen if a reload took it off the list. */
  after: Sale
}

interface ServingDeps {
  read: () => SalesList
  write: (list: SalesList) => void
  /** Says why a change didn't reach the server. */
  onError: (message: string) => void
  /** Every change sent so far has its reply: time to reload the list quietly. */
  onSettled: () => void
  /** Shows the Undo bar for the latest change, or hides it (null). */
  onUndoChange: (offer: UndoOffer | null) => void
  send?: (id: string, request: ServeRequest) => Promise<ServeResult>
  now?: () => string
}

export interface ServingController {
  serveLine(orderId: string, lineId: string): void
  unserveLine(orderId: string, lineId: string): void
  complete(orderId: string): void
  undo(offer: UndoOffer): void
  /** True while a change is on its way: a list fetched meanwhile may not have it yet. */
  busy(): boolean
  /** Goes up with every change shown: a list fetched before it may not have it. */
  version(): number
}

/**
 * Ticks, unticks and Complete on Sales. Each shows at once (with the tab counts to match), then goes
 * to the server one at a time per order. A change the server refuses is taken back off the screen,
 * with any made on top of it, and its reason shown.
 */
export function createServing({ read, write, onError, onSettled, onUndoChange, send = sendServe, now = () => new Date().toISOString() }: ServingDeps): ServingController {
  const queue = createServeQueue(onSettled)
  let version = 0
  let offered: string | null = null

  function offer(next: UndoOffer | null) {
    offered = next?.orderId ?? null
    onUndoChange(next)
  }

  /** Puts the order back as it was before a change that didn't go through. */
  function restore(orderId: string, before: Sale) {
    const list = read()
    const current = list.orders.find(order => order._id === orderId)
    version += 1
    write({ orders: withOrder(list.orders, before, false), summary: list.summary && current ? countsAfter(list.summary, current, before) : list.summary })
    // The bar can't undo what didn't happen.
    if (offered === orderId) offer(null)
  }

  /** Shows the change and sends it. `fallback` is the order to start from when a reload took it off the list. */
  function apply(orderId: string, request: ServeRequest, fallback: Sale | null): { before: Sale; after: Sale } | null {
    const list = read()
    const before = list.orders.find(order => order._id === orderId) ?? fallback
    if (!before) return null
    const after = servedLocally(before, request, now())
    if (undoRequest(before, after) === null && after.isCompleted === (before.isCompleted === true)) return null
    version += 1
    write({ orders: withOrder(list.orders, after, fallback !== null), summary: list.summary && countsAfter(list.summary, before, after) })
    queue.push(orderId, async () => {
      const result = await send(orderId, request)
      if (result.error === null) return true
      restore(orderId, before)
      onError(result.error)
      return false
    })
    return { before, after }
  }

  function change(orderId: string, request: ServeRequest) {
    const done = apply(orderId, request, null)
    if (!done) return
    const back = undoRequest(done.before, done.after)
    offer(back && { orderId, request: back, after: done.after, message: changeMessage(done.before, done.after) })
  }

  return {
    serveLine: (orderId, lineId) => change(orderId, { kind: 'serve', lineIds: [lineId] }),
    unserveLine: (orderId, lineId) => change(orderId, { kind: 'unserve', lineIds: [lineId] }),
    complete: orderId => change(orderId, { kind: 'complete' }),
    undo(undone) {
      offer(null)
      apply(undone.orderId, undone.request, undone.after)
    },
    busy: () => queue.busy(),
    version: () => version,
  }
}

interface ServingOptions extends Omit<ServingDeps, 'onUndoChange' | 'send' | 'now'> {
  /** Where the list is (tab, period, page): the Undo bar shows only where its change was made. */
  where: string
}

export interface Serving extends Omit<ServingController, 'undo'> {
  /** The Undo bar for the latest change, for 5 seconds. */
  undoBar: { message: string; undo: () => void } | null
}

/** createServing for SalesClient, with the Undo bar's 5 seconds. */
export function useServing(options: ServingOptions): Serving {
  // The latest options, so the one controller always reads the list on screen now.
  const latest = useRef(options)
  useLayoutEffect(() => {
    latest.current = options
  })
  const [shown, setShown] = useState<(UndoOffer & { where: string }) | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const made = useRef<ServingController | null>(null)
  // Made on first use, from a tap or a load: never during render.
  const controller = useCallback((): ServingController => {
    made.current ??= createServing({
      read: () => latest.current.read(),
      write: list => latest.current.write(list),
      onError: message => latest.current.onError(message),
      onSettled: () => latest.current.onSettled(),
      onUndoChange: offer => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = offer ? setTimeout(() => setShown(null), UNDO_MS) : null
        setShown(offer && { ...offer, where: latest.current.where })
      },
    })
    return made.current
  }, [])
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  const busy = useCallback(() => controller().busy(), [controller])
  const version = useCallback(() => controller().version(), [controller])

  return {
    serveLine: (orderId, lineId) => controller().serveLine(orderId, lineId),
    unserveLine: (orderId, lineId) => controller().unserveLine(orderId, lineId),
    complete: orderId => controller().complete(orderId),
    busy,
    version,
    // Moving to another tab, period or page leaves the change behind: its bar goes.
    undoBar: shown && shown.where === options.where ? { message: shown.message, undo: () => controller().undo(shown) } : null,
  }
}
