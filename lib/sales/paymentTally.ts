import { PAYMENT_METHODS, type OrderType, type PaymentMethod, type SalePayment } from './payments'

// The Sales tally: how a period was paid and where it was eaten. Every peso of revenue lands
// somewhere, so the methods always add up to it: what no payment covers (orders from before
// payments were recorded) counts as Not recorded.

export interface MethodTotal {
  amount: number
  /** Orders that used it, each counted once however many of its payments did. */
  orders: number
}

export interface PaymentTally {
  cash: MethodTotal
  ewallet: MethodTotal
  card: MethodTotal
  /** The part of orders no payment covers. */
  notRecorded: MethodTotal
}

export interface OrderTypeCounts {
  dineIn: number
  takeOut: number
  /** Orders from before Dine in / Take out was asked. */
  notRecorded: number
}

/** One payment, for the Tally tab's list under its method. */
export interface PaymentLine {
  saleId: string
  paymentKey: string
  method: PaymentMethod
  amount: number
  /** When it was paid: for items added later, when they were added; else the order's time. */
  paidAt: string
  /** The customer's name, or empty. */
  name: string
  orderTotal: number
  /** The order was paid in more than one payment: split, or items added later. */
  partOfMore: boolean
  /** Moved here on Sales: the method it was taken as, and when it moved. */
  movedFrom?: PaymentMethod
  movedAt?: string
}

/** The fields of a sale the tally reads. */
export interface TallySale {
  _id: string
  _createdAt: string
  total: number
  notes?: string
  orderType?: OrderType
  payments?: SalePayment[]
}

const NONE: MethodTotal = { amount: 0, orders: 0 }

export function tallyPayments(sales: readonly TallySale[]): PaymentTally {
  const tally: PaymentTally = { cash: { ...NONE }, ewallet: { ...NONE }, card: { ...NONE }, notRecorded: { ...NONE } }
  for (const sale of sales) {
    const payments = sale.payments ?? []
    for (const method of PAYMENT_METHODS) {
      const mine = payments.filter(p => p.method === method)
      if (mine.length === 0) continue
      tally[method] = { amount: tally[method].amount + mine.reduce((sum, p) => sum + p.amount, 0), orders: tally[method].orders + 1 }
    }
    const unrecorded = sale.total - payments.reduce((sum, p) => sum + p.amount, 0)
    if (unrecorded > 0.004) tally.notRecorded = { amount: tally.notRecorded.amount + unrecorded, orders: tally.notRecorded.orders + 1 }
  }
  return tally
}

export function countOrderTypes(sales: readonly TallySale[]): OrderTypeCounts {
  return sales.reduce<OrderTypeCounts>(
    (counts, sale) =>
      sale.orderType === 'dine-in'
        ? { ...counts, dineIn: counts.dineIn + 1 }
        : sale.orderType === 'take-out'
          ? { ...counts, takeOut: counts.takeOut + 1 }
          : { ...counts, notRecorded: counts.notRecorded + 1 },
    { dineIn: 0, takeOut: 0, notRecorded: 0 },
  )
}

/** Every payment in the period, newest first. */
export function paymentLines(sales: readonly TallySale[]): PaymentLine[] {
  return sales
    .flatMap(sale =>
      (sale.payments ?? []).map((p): PaymentLine => ({
        saleId: sale._id,
        paymentKey: p._key,
        method: p.method,
        amount: p.amount,
        paidAt: p.addedAt ?? sale._createdAt,
        name: sale.notes?.trim() ?? '',
        orderTotal: sale.total,
        partOfMore: (sale.payments ?? []).length > 1,
        ...(p.movedFrom ? { movedFrom: p.movedFrom, ...(p.movedAt ? { movedAt: p.movedAt } : {}) } : {}),
      })),
    )
    .sort((a, b) => Date.parse(b.paidAt) - Date.parse(a.paidAt))
}

/** Whole percents that always add up to 100 (largest remainder); all zero when the values are. */
export function wholeShares(values: readonly number[]): number[] {
  const total = values.reduce((sum, v) => sum + v, 0)
  if (total <= 0) return values.map(() => 0)
  const exact = values.map(v => (v / total) * 100)
  const shares = exact.map(Math.floor)
  let left = 100 - shares.reduce((sum, s) => sum + s, 0)
  const byRemainder = exact.map((e, i) => ({ i, rest: e - shares[i] })).sort((a, b) => b.rest - a.rest)
  for (const { i } of byRemainder) {
    if (left <= 0) break
    shares[i] += 1
    left -= 1
  }
  return shares
}
