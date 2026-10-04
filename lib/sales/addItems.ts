import type { LoyaltyReward } from '@/lib/loyalty'
import type { SaleDiscountInput, SaleItemInput } from './validateSaleInput'

// The contract of POST /api/sales/[id]/items, shared by the route and the POS.

/** The order was marked complete: nothing more can be added to it. */
export const ORDER_COMPLETED = 'order-completed'
/** The order was deleted. */
export const ORDER_GONE = 'order-gone'
/** The order changed since the POS opened it (on another device, or by a save that already went through). */
export const ORDER_CHANGED = 'order-changed'

/** What the POS sends: the new lines only, and the revision of the order it opened. */
export interface AddItemsBody {
  rev: string
  items: SaleItemInput[]
  /** Discount rows of the new lines. */
  discounts?: SaleDiscountInput[]
  /** What the customer paid for the whole order; absent means the exact total. */
  paymentAmount?: number
  /** The order's name from here on (empty clears it); an order on a loyalty card keeps the card holder's. */
  notes?: string
  /** Loyalty rewards used on the new lines. */
  loyaltyRewards?: LoyaltyReward[]
}
