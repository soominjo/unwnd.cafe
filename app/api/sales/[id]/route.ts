import { NextRequest, NextResponse } from 'next/server'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { rewardOfSavedDiscount, type LoyaltyReward } from '@/lib/loyalty'
import { isValidNotes } from '@/lib/sales/validateSaleInput'
import { handedTotal, isPaymentMethod, type PaymentMethod, type SalePayment } from '@/lib/sales/payments'
import { changePaymentMethod, shrinkPayments } from '@/lib/sales/paymentChanges'
import {
  afterServing,
  afterUnserving,
  allLinesServed,
  missingLineIds,
  topLevelLines,
  type ServableLine,
  type ServeChange,
} from '@/lib/sales/served'

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requirePosAuth()
  if (authError) return authError

  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  const { id } = await params
  if (!id || !isValidId(id)) {
    return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
  }

  try {
    const writeClient = getWriteClient()
    // Orders only: the query keeps this route from deleting a loyalty card holder or any other document.
    const result = await writeClient.delete({ query: '*[_type == "sale" && _id == $id]', params: { id } })
    if (result.results.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete order.' }, { status: 500 })
  }
}

interface PatchBody {
  removeLineId?: string
  markCompleted?: boolean
  /** The customer's name, stored as the sale's notes; empty clears it. */
  notes?: unknown
  /** A payment taken under the wrong method: its key, and the method it was really taken by. */
  paymentKey?: unknown
  method?: unknown
  /** Lines that went out to the customer (ticked on Sales). */
  serveLineIds?: unknown
  /** Lines ticked by mistake, to go back to be served. */
  unserveLineIds?: unknown
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requirePosAuth()
  if (authError) return authError

  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  const { id } = await params
  if (!id || !isValidId(id)) {
    return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
  }

  let parsed: unknown
  try {
    parsed = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }
  // JSON that is not an object (null, a number, a string) carries none of the fields below.
  if (typeof parsed !== 'object' || parsed === null) {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }
  const body = parsed as PatchBody

  // ── Tick items as served, or untick them (Sales) ───────────────────────────
  if (body.serveLineIds !== undefined || body.unserveLineIds !== undefined) {
    const serving = servingRequest(body)
    if (!serving) {
      return NextResponse.json({ success: false, error: 'Invalid serveLineIds or unserveLineIds' }, { status: 400 })
    }
    return changeServing(id, serving)
  }

  // ── Mark order as completed: every item still to serve goes out now ───────
  if (body.markCompleted === true) return completeOrder(id)

  // ── Name the order (Sales): the customer's name, kept as the sale's notes ──
  if (body.notes !== undefined) {
    if (!isValidNotes(body.notes)) {
      return NextResponse.json({ success: false, error: 'Names are up to 100 characters.' }, { status: 400 })
    }
    const name = body.notes.trim()
    try {
      const writeClient = getWriteClient()
      const order = await writeClient.getDocument<{ _type: string; loyaltyMemberId?: string }>(id)
      if (!order || order._type !== 'sale') {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
      }
      // The card and the name on the order stay in step.
      if (order.loyaltyMemberId) {
        return NextResponse.json({ success: false, error: 'An order on a loyalty card keeps the card holder’s name.' }, { status: 400 })
      }
      const patch = writeClient.patch(id)
      await (name ? patch.set({ notes: name }) : patch.unset(['notes'])).commit()
      return NextResponse.json({ success: true, notes: name })
    } catch (error) {
      console.error('Order could not be renamed', { id }, error)
      return NextResponse.json({ success: false, error: 'Failed to rename the order.' }, { status: 500 })
    }
  }

  // ── Fix a payment's method (Sales) ─────────────────────────────────────────
  if (body.paymentKey !== undefined) {
    if (typeof body.paymentKey !== 'string' || !isValidId(body.paymentKey) || body.paymentKey.length > 100 || !isPaymentMethod(body.method)) {
      return NextResponse.json({ success: false, error: 'Invalid payment change' }, { status: 400 })
    }
    return changeMethod(id, body.paymentKey, body.method)
  }

  // ── Remove single item from order ──────────────────────────────────────────
  const { removeLineId } = body
  if (!removeLineId || typeof removeLineId !== 'string' || !isValidId(removeLineId)) {
    return NextResponse.json({ success: false, error: 'Invalid removeLineId' }, { status: 400 })
  }

  // Each write is made against the order as read, by its revision: Add items on the POS (or
  // another ✕) can save in between, and that save must not be written over. A clash, or the
  // order deleted in between, reads it again, once.
  try {
    const writeClient = getWriteClient()
    for (let attempt = 1; attempt <= REMOVE_ATTEMPTS; attempt++) {
      const doc = await writeClient.getDocument<StoredOrder>(id)
      if (!doc || doc._type !== 'sale') {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
      }
      if (!Array.isArray(doc.items)) {
        return NextResponse.json({ success: false, error: 'Malformed order document' }, { status: 422 })
      }

      const next = withoutLine(doc, removeLineId)
      if (!next) {
        // The last line: the order goes, but only as it was read.
        const result = await writeClient.delete({ query: '*[_type == "sale" && _id == $id && _rev == $rev]', params: { id, rev: doc._rev } })
        if (result.results.length > 0) return NextResponse.json({ success: true, orderDeleted: true })
        continue
      }
      try {
        await writeClient.patch(id).ifRevisionId(doc._rev).set(next).commit()
        return NextResponse.json({ success: true, orderDeleted: false })
      } catch (error) {
        if (!isStaleWrite(error)) throw error
      }
    }
    return NextResponse.json({ success: false, error: CHANGED_ON_ANOTHER_DEVICE }, { status: 409 })
  } catch (error) {
    console.error('An item could not be taken off an order', { id, removeLineId }, error)
    return NextResponse.json({ success: false, error: 'Failed to update order.' }, { status: 500 })
  }
}

/** Reads of the order ✕ and a payment fix make before they give up on a busy order. */
const REMOVE_ATTEMPTS = 2
/** Reads of the order a tick, an untick or Complete makes before it gives up on a busy order. */
const SERVING_ATTEMPTS = 3
const CHANGED_ON_ANOTHER_DEVICE = 'This order changed on another device. Refresh, then try again.'

/** A line as stored: serving goes by its lineId (its _key too), the money by the rest. */
interface StoredLine extends ServableLine {
  _key: string
  price: number
  qty: number
  addedAt?: string
}

interface StoredOrder {
  _type: string
  _rev: string
  /** When the order was last saved, kept by Sanity. */
  _updatedAt?: string
  isCompleted?: boolean
  total?: number
  items: StoredLine[]
  discounts?: Array<{ _key?: string; lineId: string; name: string; amount: number }>
  loyaltyRewards?: LoyaltyReward[]
  paymentAmount: number
  payments?: SalePayment[]
}

/**
 * Moves one payment to the method it was really taken by, keeping what was handed over in step,
 * behind the revision it was read at; a clash reads the order again, once. A payment no longer
 * on the order changed on another device. The payment notes what it was taken as and when it
 * moved (the server's clock), and the move is logged, so it can't pass unseen.
 */
async function changeMethod(id: string, key: string, method: PaymentMethod): Promise<NextResponse> {
  try {
    const writeClient = getWriteClient()
    for (let attempt = 1; attempt <= REMOVE_ATTEMPTS; attempt++) {
      const doc = await writeClient.getDocument<StoredOrder>(id)
      if (!doc || doc._type !== 'sale') {
        return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
      }
      const before = doc.payments?.find(p => p._key === key)
      const changed = changePaymentMethod(doc.payments ?? [], key, method, new Date().toISOString())
      if (!before || !changed) {
        return NextResponse.json({ success: false, error: 'This payment changed on another device. Refresh, then try again.' }, { status: 409 })
      }
      const total = doc.total ?? 0
      // Worked out from the payments as they now are, so it can't drift.
      const paymentAmount = handedTotal(changed, total)
      try {
        await writeClient.patch(id).ifRevisionId(doc._rev).set({ payments: changed, paymentAmount, change: paymentAmount - total }).commit()
        if (before.method !== method) {
          console.info('Payment method changed', { id, key, from: before.method, to: method, amount: before.amount })
        }
        return NextResponse.json({ success: true })
      } catch (error) {
        if ((error as { statusCode?: unknown }).statusCode !== 409) throw error
      }
    }
    return NextResponse.json({ success: false, error: CHANGED_ON_ANOTHER_DEVICE }, { status: 409 })
  } catch (error) {
    console.error('A payment method could not be changed', { id, key }, error)
    return NextResponse.json({ success: false, error: 'Failed to change the payment.' }, { status: 500 })
  }
}

/** A whole-order row from before discounts went per line: tied to no one line, so it stays. */
const isOrderRow = (row: { lineId: string }) => row.lineId.startsWith('order:')

/**
 * The fields to write once a line is off the order, or null when it was the last line. The
 * line's own discount rows go with it, as do rows of lines taken off before (✕ used to leave
 * them), and a loyalty reward among them goes back on the card. The rows left come off the
 * total. Whole arrays are written, behind the revision they were read at. Taking off the last
 * line still to serve leaves an order whose lines all went out, so it is completed; taking a
 * line off never reopens a completed order.
 */
function withoutLine(doc: StoredOrder, lineId: string) {
  const items = doc.items.filter(item => item._key !== lineId)
  if (items.length === 0) return null
  const onOrder = new Set(items.map(item => item._key))
  const rows = doc.discounts ?? []
  const kept = rows.filter(row => isOrderRow(row) || onOrder.has(row.lineId))
  const released = rows
    .filter(row => !kept.includes(row))
    .map(row => rewardOfSavedDiscount(row.name))
    .filter((reward): reward is LoyaltyReward => reward !== null)
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0)
  const total = Math.max(0, subtotal - kept.reduce((sum, row) => sum + row.amount, 0))
  // A paid order's payments come down by what came off, so they keep adding up to the total.
  const before = doc.total ?? total
  const round = doc.items.find(item => item._key === lineId)?.addedAt ?? null
  const shrunk = doc.payments && doc.payments.length > 0 ? shrinkPayments(doc.payments, before - total, round, before) : null
  const paymentAmount = shrunk ? handedTotal(shrunk, total) : doc.paymentAmount ?? 0
  const completes = doc.isCompleted !== true && hasReadableLines({ items }) && allLinesServed(items)
  return {
    items,
    ...(completes ? { isCompleted: true } : {}),
    ...(doc.discounts ? { discounts: kept } : {}),
    subtotal,
    total,
    ...(shrunk ? { payments: shrunk, paymentAmount } : {}),
    change: paymentAmount - total,
    ...(released.length > 0 ? { loyaltyRewards: (doc.loyaltyRewards ?? []).filter(reward => !released.includes(reward)) } : {}),
  }
}

// ── Serving items one by one (Sales) ─────────────────────────────────────────
// The rules come from lib/sales/served.ts, which the Sales screen uses too, so the two agree.

/** The most ids one tick or untick names: well above the 50 lines an order holds. */
const MAX_LINE_IDS = 102
const MAX_LINE_ID_LENGTH = 100

interface ServingRequest {
  /** True ticks the lines as served; false unticks them. */
  serve: boolean
  lineIds: string[]
}

/** The lines a body ticks or unticks, or null when it sends both keys or a list that is not one. */
function servingRequest({ serveLineIds, unserveLineIds }: PatchBody): ServingRequest | null {
  if (serveLineIds !== undefined && unserveLineIds !== undefined) return null
  const lineIds = serveLineIds !== undefined ? serveLineIds : unserveLineIds
  return isLineIdList(lineIds) ? { serve: serveLineIds !== undefined, lineIds } : null
}

function isLineIdList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= MAX_LINE_IDS &&
    value.every(id => typeof id === 'string' && id.length <= MAX_LINE_ID_LENGTH && isValidId(id))
  )
}

/**
 * Ticks lines as served at the server's time, or unticks them. A completed order counts every
 * line as served already, so a tick on it changes nothing, and no time is made up for an order
 * completed before items were ticked one by one. Unticking a line of such an order keeps its
 * other lines served, as of when the order was last saved. The reply says whether the order is
 * now completed, and the time written by a tick (null when nothing was).
 */
async function changeServing(id: string, { serve, lineIds }: ServingRequest): Promise<NextResponse> {
  const now = new Date().toISOString()
  try {
    const result = await writeServing(id, lineIds, doc => {
      if (!serve) return afterUnserving(doc, lineIds, doc._updatedAt ?? now)
      return doc.isCompleted === true ? asItIs(doc) : afterServing(doc, lineIds, now)
    })
    if (result instanceof Response) return result
    const stamped = serve && result.after.items.some((item, index) => item !== result.before.items[index])
    return NextResponse.json({ success: true, isCompleted: result.after.isCompleted, servedAt: stamped ? now : null })
  } catch (error) {
    console.error('Items could not be ticked or unticked', { id, serve, lineIds }, error)
    return NextResponse.json({ success: false, error: 'Failed to update the order.' }, { status: 500 })
  }
}

/**
 * Completes the order (Complete on Sales): every line still to serve goes out at the server's
 * time, and lines that went out before keep their times. An order completed already stays as it
 * is. One left with add-ons only has no item to tick, and is completed all the same.
 */
async function completeOrder(id: string): Promise<NextResponse> {
  const now = new Date().toISOString()
  try {
    const result = await writeServing(id, [], doc => {
      if (doc.isCompleted === true) return asItIs(doc)
      const everyLine = topLevelLines(doc.items).map(line => line.lineId)
      return { ...afterServing(doc, everyLine, now), isCompleted: true }
    })
    return result instanceof Response ? result : NextResponse.json({ success: true })
  } catch (error) {
    console.error('Order could not be completed', { id }, error)
    return NextResponse.json({ success: false, error: 'Failed to complete order.' }, { status: 500 })
  }
}

/** The order as read, and as the change left it. */
interface ServingResult {
  before: StoredOrder
  after: ServeChange<StoredLine>
}

/**
 * Works a change out from the order as read, and writes its lines and whether it is completed,
 * whole, behind the revision read: a tick from another device can land in between and must not
 * be written over. A clash reads the order again, up to SERVING_ATTEMPTS reads in all; so does
 * an order deleted in between, which then answers 404. A change that changes nothing writes
 * nothing. An id that is not a top-level line of the order (an add-on, or a line taken off)
 * means the order changed on another device. Answers with the reply to send instead, if any.
 */
async function writeServing(
  id: string,
  lineIds: readonly string[],
  change: (doc: StoredOrder) => ServeChange<StoredLine>,
): Promise<ServingResult | NextResponse> {
  const writeClient = getWriteClient()
  for (let attempt = 1; attempt <= SERVING_ATTEMPTS; attempt++) {
    const doc = await writeClient.getDocument<StoredOrder>(id)
    if (!doc || doc._type !== 'sale') {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 })
    }
    if (!hasReadableLines(doc)) {
      return NextResponse.json({ success: false, error: 'This order could not be read.' }, { status: 422 })
    }
    if (missingLineIds(doc.items, lineIds).length > 0) {
      return NextResponse.json({ success: false, error: CHANGED_ON_ANOTHER_DEVICE }, { status: 409 })
    }
    const after = change(doc)
    if (changesNothing(doc, after)) return { before: doc, after }
    try {
      await writeClient.patch(id).ifRevisionId(doc._rev).set({ items: after.items, isCompleted: after.isCompleted }).commit()
      return { before: doc, after }
    } catch (error) {
      if (!isStaleWrite(error)) throw error
    }
  }
  return NextResponse.json({ success: false, error: CHANGED_ON_ANOTHER_DEVICE }, { status: 409 })
}

/** Every line carries the lineId serving goes by; an order whose lines don't can't be read. */
function hasReadableLines(doc: { items?: unknown }): boolean {
  return Array.isArray(doc.items) && doc.items.every((item: unknown) => typeof (item as { lineId?: unknown } | null)?.lineId === 'string')
}

/** The order as read: a change that changes nothing. */
function asItIs(doc: StoredOrder): ServeChange<StoredLine> {
  return { items: doc.items, isCompleted: doc.isCompleted === true }
}

/** True when the change leaves every line, and whether the order is completed, as they were read. */
function changesNothing(doc: StoredOrder, after: ServeChange<StoredLine>): boolean {
  return (
    after.isCompleted === (doc.isCompleted === true) &&
    after.items.length === doc.items.length &&
    after.items.every((item, index) => item === doc.items[index])
  )
}

/** A write Sanity refused because the order changed (409) or went (404) after it was read. */
function isStaleWrite(error: unknown): boolean {
  const status = (error as { statusCode?: unknown } | null)?.statusCode
  return status === 409 || status === 404
}
