import type { LoyaltyReward } from '@/lib/loyalty'
import type { AddItemsBody } from '@/lib/sales/addItems'
import { savedDiscountName } from './discounts'
import type { DiscountLine, LineDiscount, OrderItem, Sale, SaleItem } from './types'

// Adding a customer's follow-up to their pending order ("Add items" on Sales). The saved part
// of the order stays as it is; the cart holds only the new lines, which are saved onto the
// same sale (POST /api/sales/[id]/items).

/** A saved, pending order the POS is adding items to. */
export interface OpenOrder {
  id: string
  /** The revision opened: the save is refused once the order has moved past it. */
  rev: string
  /** When the order was first saved. */
  createdAt: string
  /** The customer name saved with it; empty when it has none. */
  name: string
  items: SaleItem[]
  discounts: LineDiscount[]
  total: number
  loyaltyMemberId: string | null
  loyaltyRewards: LoyaltyReward[]
}

export function openOrderFromSale(sale: Sale): OpenOrder {
  return {
    id: sale._id,
    rev: sale._rev ?? '',
    createdAt: sale._createdAt,
    name: sale.notes?.trim() ?? '',
    items: sale.items,
    discounts: sale.discounts ?? [],
    total: sale.total,
    loyaltyMemberId: sale.loyaltyMemberId ?? null,
    loyaltyRewards: sale.loyaltyRewards ?? [],
  }
}

/**
 * The suffix every line added in one adding session ends with: `__a` and four base-36
 * characters. Another Tiramisu ICE then never merges into, or shares an id with, the saved one.
 */
export function newLineSuffix(random: () => number = Math.random): string {
  let key = ''
  for (let i = 0; i < 4; i++) key += Math.floor(random() * 36).toString(36)
  return `__a${key}`
}

const GOOGLE_REVIEW_ROW = 'Google Review'

/**
 * The loyalty rewards the new lines can't use: each reward is once per order, and the order's
 * one 10% can't be the loyalty one when it already has Google Review.
 */
export function blockedRewards(order: OpenOrder): LoyaltyReward[] {
  const tenTaken = order.loyaltyRewards.includes('ten') || order.discounts.some(d => d.name.startsWith(GOOGLE_REVIEW_ROW))
  return [...(tenTaken ? ['ten' as const] : []), ...(order.loyaltyRewards.includes('free') ? ['free' as const] : [])]
}

/** The order used the loyalty 10%, its one 10%: Google Review can't go on the new lines. */
export function reviewLockedBy(order: OpenOrder): boolean {
  return order.loyaltyRewards.includes('ten')
}

interface AddItemsArgs {
  order: OpenOrder
  /** The new lines: the cart while adding. */
  items: OrderItem[]
  discountLines: DiscountLine[]
  /** What the customer paid for the whole order, or null for the exact total. */
  payment: number | null
  /** The name field: sent when it no longer matches the order's name, unless the order is on a loyalty card. */
  name: string
  rewards: LoyaltyReward[]
}

export function buildAddItemsBody({ order, items, discountLines, payment, name, rewards }: AddItemsArgs): AddItemsBody {
  const typedName = name.trim()
  return {
    rev: order.rev,
    items,
    ...(discountLines.length > 0
      ? { discounts: discountLines.map(d => ({ lineId: d.lineId, name: savedDiscountName(d), amount: d.amount })) }
      : {}),
    ...(payment !== null ? { paymentAmount: payment } : {}),
    ...(!order.loyaltyMemberId && typedName !== order.name ? { notes: typedName } : {}),
    ...(rewards.length > 0 ? { loyaltyRewards: rewards } : {}),
  }
}

/**
 * The name field once the order is read again after another device changed it: the name the order
 * has now when it changed there (cleared included), else what the cashier typed. A save from here
 * then neither puts back a name cleared there nor drops one typed here.
 */
export function nameAfterRefresh(savedName: string, typedName: string, freshName: string): string {
  return freshName !== savedName ? freshName : typedName
}

/** Whether lines sent to an order are on it already: see savedState. */
export type SavedState = 'saved' | 'partly' | 'not'

const rowKey = (row: { lineId: string; name: string; amount: number }) => `${row.lineId}|${row.name}|${row.amount}`

/**
 * Whether the lines sent are on the order already, because an earlier save went through and
 * only its reply was lost. 'saved': every line and discount row is there exactly as sent.
 * 'partly': some are, or at other amounts (the cart changed after that save). 'not': none are.
 */
export function savedState(sale: Sale, sent: Pick<AddItemsBody, 'items' | 'discounts'>): SavedState {
  const onOrder = new Map(sale.items.map(i => [i.lineId, i]))
  const there = sent.items.filter(i => onOrder.has(i.lineId))
  if (there.length === 0) return 'not'
  if (there.length < sent.items.length) return 'partly'
  const linesMatch = sent.items.every(i => onOrder.get(i.lineId)?.qty === i.qty && onOrder.get(i.lineId)?.price === i.price)
  const lineIds = new Set(sent.items.map(i => i.lineId))
  const savedRows = (sale.discounts ?? []).filter(row => lineIds.has(row.lineId)).map(rowKey).sort()
  const sentRows = (sent.discounts ?? []).map(rowKey).sort()
  const rowsMatch = savedRows.length === sentRows.length && savedRows.every((key, n) => key === sentRows[n])
  return linesMatch && rowsMatch ? 'saved' : 'partly'
}
