import { isOrderType, type OrderType } from '@/lib/sales/payments'
import { nameAfterRefresh, type OpenOrder } from './addToOrder'
import { NO_LOYALTY } from './discounts'
import type { LineDiscountKind, LineDiscountScope, LineDiscounts, LoyaltyChoice, OrderItem } from './types'

// The order on screen, kept in this tablet's localStorage so a refresh, a browser restart or a
// trip to another page doesn't lose it. A new order and the lines being added to a saved order
// ("Add items") are kept apart, so adding a customer's follow-up never replaces the order
// someone else is still placing. Storage that is refused (a private window, blocked site data)
// or missing (the server render) never breaks the POS: keeping says false and reading finds
// nothing. Whatever is read back is checked field by field, since it may come from an older POS.

export const KEPT_ORDER_KEY = 'unwnd.pos.order'
export const KEPT_ADDING_KEY = 'unwnd.pos.addingTo'

/** A new order, or lines being added to a saved one. */
export type KeptKind = 'new' | 'adding'

export interface KeptOrder {
  items: OrderItem[]
  /** The customer name field. */
  name: string
  /** A new order's linked loyalty card holder; null while adding (the order keeps its own card). */
  cardHolderId: string | null
  rewards: LoyaltyChoice
  orderType: OrderType
  /** The suffix the lines were made with, so another tap on the same item still adds to its line. */
  lineSuffix: string
  /** Complete + Print was saving it, or a reload cut such a save short and OK isn't tapped yet. */
  sending: boolean
  /** Set on lines being added to a saved order: that order, and its name when they were kept. */
  addingTo: { id: string; name: string } | null
}

/** What the cart holds when nothing is kept: a new, empty order. */
export const EMPTY_KEPT_ORDER: KeptOrder = {
  items: [],
  name: '',
  cardHolderId: null,
  rewards: NO_LOYALTY,
  orderType: 'dine-in',
  lineSuffix: '',
  sending: false,
  addingTo: null,
}

const VERSION = 1
const MAX_KEPT_LINES = 200

const keyFor = (kind: KeptKind) => (kind === 'adding' ? KEPT_ADDING_KEY : KEPT_ORDER_KEY)
const kindOf = (order: KeptOrder): KeptKind => (order.addingTo ? 'adding' : 'new')

/**
 * Keeps the order under its kind's key; an order with no items removes that key instead.
 * Says whether storage took it.
 */
export function keepOrder(order: KeptOrder, storage?: Pick<Storage, 'setItem' | 'removeItem'>): boolean {
  try {
    const target = storage ?? globalThis.localStorage
    const key = keyFor(kindOf(order))
    if (order.items.length === 0) target.removeItem(key)
    else target.setItem(key, JSON.stringify({ v: VERSION, ...order }))
    return true
  } catch {
    return false
  }
}

/** The order kept under that kind's key, or null when there is none or it doesn't read as one. */
export function readKeptOrder(kind: KeptKind, storage?: Pick<Storage, 'getItem'>): KeptOrder | null {
  try {
    const text = (storage ?? globalThis.localStorage).getItem(keyFor(kind))
    const order = text ? parseKeptOrder(JSON.parse(text)) : null
    return order && kindOf(order) === kind ? order : null
  } catch {
    return null
  }
}

export function forgetKeptOrder(kind: KeptKind, storage?: Pick<Storage, 'removeItem'>): void {
  try {
    ;(storage ?? globalThis.localStorage).removeItem(keyFor(kind))
  } catch {
    // Storage refused: nothing was kept to forget.
  }
}

/** What a page load brings back: the kept order, nothing, or word that kept lines were saved already. */
export type FoundOrder = { kind: 'none' } | { kind: 'order'; order: KeptOrder } | { kind: 'already-added' }

/**
 * What the page that just loaded brings back of the order kept. A new order comes back on a new
 * order's page. Lines being added come back only to the order they were kept for, as it loads now.
 * If it already holds any of them, a save went through before the reload, and none come back
 * (they'd be saved twice). The name the order has now wins only if it changed on another device.
 */
export function findKeptOrder(openOrder: OpenOrder | null, kept: KeptOrder | null): FoundOrder {
  if (!kept) return { kind: 'none' }
  if (!openOrder) return kept.addingTo ? { kind: 'none' } : { kind: 'order', order: kept }
  if (!kept.addingTo || kept.addingTo.id !== openOrder.id) return { kind: 'none' }
  const savedIds = new Set(openOrder.items.map(item => item.lineId))
  if (kept.items.some(item => savedIds.has(item.lineId))) return { kind: 'already-added' }
  return { kind: 'order', order: { ...kept, sending: false, name: nameAfterRefresh(kept.addingTo.name, kept.name, openOrder.name) } }
}

type Fields = Record<string, unknown>
const isFields = (value: unknown): value is Fields => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string'
const isTextOrNull = (value: unknown): value is string | null => value === null || isText(value)
const isOptionalText = (value: unknown): value is string | undefined => value === undefined || isText(value)
const isDiscountKind = (value: string): value is LineDiscountKind => value === 'pwd' || value === 'review'
const isDiscountScope = (value: unknown): value is LineDiscountScope => value === 'all' || value === 'solo'

function parseDiscounts(value: unknown): LineDiscounts | null {
  if (!isFields(value)) return null
  const entries = Object.entries(value)
  return entries.every(([kind, scope]) => isDiscountKind(kind) && isDiscountScope(scope))
    ? (Object.fromEntries(entries) as LineDiscounts)
    : null
}

function parseLine(value: unknown): OrderItem | null {
  if (!isFields(value)) return null
  const { lineId, name, variant, price, qty, discounts, parentLineId, note, categoryId } = value
  if (!isText(lineId) || lineId === '' || !isText(name)) return null
  if (variant !== null && variant !== 'hot' && variant !== 'ice') return null
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0) return null
  if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1) return null
  if (!isOptionalText(parentLineId) || !isOptionalText(note) || !isOptionalText(categoryId)) return null
  const lineDiscounts = discounts === undefined ? undefined : parseDiscounts(discounts)
  if (lineDiscounts === null) return null
  return {
    lineId,
    name,
    variant,
    price,
    qty,
    ...(lineDiscounts !== undefined ? { discounts: lineDiscounts } : {}),
    ...(parentLineId !== undefined ? { parentLineId } : {}),
    ...(note !== undefined ? { note } : {}),
    ...(categoryId !== undefined ? { categoryId } : {}),
  }
}

function parseRewards(value: unknown): LoyaltyChoice | null {
  if (!isFields(value)) return null
  const { tenLineId, freeLineId } = value
  return isTextOrNull(tenLineId) && isTextOrNull(freeLineId) ? { tenLineId, freeLineId } : null
}

function parseOrderRef(value: unknown): { id: string; name: string } | null {
  if (!isFields(value)) return null
  const { id, name } = value
  return isText(id) && id !== '' && isText(name) ? { id, name } : null
}

/** A kept order as read back from storage, rebuilt from the fields it should have; null when any is off. */
export function parseKeptOrder(value: unknown): KeptOrder | null {
  if (!isFields(value) || value.v !== VERSION) return null
  const { items, name, cardHolderId, rewards, orderType, lineSuffix, sending, addingTo } = value
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_KEPT_LINES) return null
  const lines = items.map(parseLine)
  if (!lines.every((line): line is OrderItem => line !== null)) return null
  const keptRewards = parseRewards(rewards)
  const keptAddingTo = addingTo === null ? null : parseOrderRef(addingTo)
  if (addingTo !== null && keptAddingTo === null) return null
  if (!isText(name) || !isTextOrNull(cardHolderId) || keptRewards === null || !isOrderType(orderType)) return null
  if (!isText(lineSuffix) || typeof sending !== 'boolean') return null
  return { items: lines, name, cardHolderId, rewards: keptRewards, orderType, lineSuffix, sending, addingTo: keptAddingTo }
}
