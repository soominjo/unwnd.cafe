import {
  addOrderToTotals,
  cardState,
  isClassicDrinkLine,
  loyaltyKey,
  stampsIn,
  type CardHolderWithCard,
  type LoyaltyCard,
  type LoyaltyReward,
} from '@/lib/loyalty'
import type { LoyaltyChoice, OrderItem } from './types'

export interface LoyaltyOrderInput {
  /** Card holders, or null when they could not be loaded. */
  holders: readonly CardHolderWithCard[] | null
  linkedHolderId: string | null
  /** The customer name field: the link holds only while it shows the card holder's name. */
  customerName: string
  items: readonly OrderItem[]
  /** The rewards the cashier turned on. */
  picked: LoyaltyChoice
  /** Rewards this order can't use: while adding to a saved order, the ones it used already. */
  blocked?: readonly LoyaltyReward[]
}

export interface LoyaltyOrder {
  holder: CardHolderWithCard | null
  orderStamps: number
  /** The linked card with this order's stamps counted: a reward can be used on the order that earns it. */
  card: LoyaltyCard | null
  /** The picked rewards that still apply: still ready, and their drink still in the order. */
  applied: LoyaltyChoice
  /** The classic drink lines the 10% can go on: each has a unit that is not the free drink. */
  tenLines: OrderItem[]
  /** The rewards the sale records as used. */
  rewards: LoyaltyReward[]
}

// The loyalty side of the order on screen. POSClient keeps the picked rewards equal to
// the applied ones, so a reward that stops applying has to be tapped again to come back.
export function resolveLoyaltyOrder({ holders, linkedHolderId, customerName, items, picked, blocked = [] }: LoyaltyOrderInput): LoyaltyOrder {
  const holder = holders?.find(h => h._id === linkedHolderId && loyaltyKey(h.name) === loyaltyKey(customerName)) ?? null
  const orderStamps = stampsIn(items)
  const card = holder ? cardState(addOrderToTotals(holder.card, orderStamps, [])) : null
  const freeLineId = !blocked.includes('free') && (card?.freeReady ?? 0) > 0 && items.some(i => i.lineId === picked.freeLineId && isClassicDrinkLine(i))
    ? picked.freeLineId
    : null
  // The free drink goes first: the 10% needs a unit of its drink still to pay.
  const tenLines = items.filter(i => isClassicDrinkLine(i) && i.qty > (i.lineId === freeLineId ? 1 : 0))
  const tenLineId = !blocked.includes('ten') && (card?.tenReady ?? 0) > 0 && tenLines.some(i => i.lineId === picked.tenLineId)
    ? picked.tenLineId
    : null
  const rewards: LoyaltyReward[] = [...(tenLineId ? ['ten' as const] : []), ...(freeLineId ? ['free' as const] : [])]
  return { holder, orderStamps, card, applied: { tenLineId, freeLineId }, tenLines, rewards }
}

export function sameLoyaltyChoice(a: LoyaltyChoice, b: LoyaltyChoice): boolean {
  return a.tenLineId === b.tenLineId && a.freeLineId === b.freeLineId
}
