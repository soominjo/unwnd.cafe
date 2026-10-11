import { MAX_PRICE, isValidAmount } from './validateSaleInput'

// How an order was paid and where it is eaten: the contract shared by the POS, the sale routes,
// the receipts and Sales.

export const PAYMENT_METHODS = ['cash', 'ewallet', 'card'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const ORDER_TYPES = ['dine-in', 'take-out'] as const
export type OrderType = (typeof ORDER_TYPES)[number]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = { cash: 'Cash', ewallet: 'E-wallet', card: 'Card' }
export const ORDER_TYPE_LABELS: Record<OrderType, string> = { 'dine-in': 'Dine in', 'take-out': 'Take out' }

/** One payment as the POS sends it: the part of the order it covers, and for cash what was handed over. */
export interface PaymentInput {
  method: PaymentMethod
  /** The part of the order this payment covers, in pesos. */
  amount: number
  /** Cash only: what the customer handed over, at least `amount`; the difference is the change. */
  received?: number
}

/** A payment as the sale stores it. */
export interface SalePayment extends PaymentInput {
  _key: string
  /** Set on a payment for items added to the order later; the first checkout's payments have none. */
  addedAt?: string
  /** Set while the payment is under another method than it was taken as (moved on Sales): that method. */
  movedFrom?: PaymentMethod
  /** When it last moved, by the server's clock. */
  movedAt?: string
  /** Taken as cash, then moved: what was handed over, given back if it moves back to cash. */
  receivedBefore?: number
}

/** A save is paid by one method, or split between two. */
export const MAX_PAYMENTS_PER_SAVE = 2

/** The sale routes' reply to payments that don't cover what is due. */
export const PAYMENTS_DONT_ADD_UP = 'How it was paid doesn’t add up to what is due. Check the payment, then try again.'

/** Peso amounts are equal when they differ by less than half a centavo. */
export function samePesos(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005
}

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && (PAYMENT_METHODS as readonly string[]).includes(value)
}

export function isOrderType(value: unknown): value is OrderType {
  return typeof value === 'string' && (ORDER_TYPES as readonly string[]).includes(value)
}

/** A peso amount in whole centavos, as money is counted. */
const isCentavos = (value: number): boolean => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6

function parsePayment(raw: unknown): PaymentInput | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  if (!isPaymentMethod(p.method) || !isValidAmount(p.amount) || p.amount <= 0 || !isCentavos(p.amount)) return null
  if (p.received === undefined) return { method: p.method, amount: p.amount }
  if (p.method !== 'cash' || !isValidAmount(p.received) || p.received < p.amount || !isCentavos(p.received)) return null
  return { method: p.method, amount: p.amount, received: p.received }
}

/**
 * The payments sent with a save, checked against what is due: one payment, or two by different
 * methods, each covering more than nothing and together exactly `due`. Cash may say what was
 * handed over (at least its amount); no other method may. A ₱0 order (a free drink only) takes
 * no payment. Null when they don't add up.
 */
export function parsePayments(raw: unknown, due: number): PaymentInput[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_PAYMENTS_PER_SAVE) return null
  if (samePesos(due, 0)) return raw.length === 0 ? [] : null
  const payments = raw.map(parsePayment)
  if (payments.length === 0 || payments.some(p => p === null)) return null
  const valid = payments as PaymentInput[]
  if (new Set(valid.map(p => p.method)).size !== valid.length) return null
  if (handedOver(valid) > MAX_PRICE) return null
  return samePesos(valid.reduce((sum, p) => sum + p.amount, 0), due) ? valid : null
}

/** What the customer handed over: cash as received, every other method exactly. */
export function handedOver(payments: readonly PaymentInput[]): number {
  return payments.reduce((sum, p) => sum + (p.method === 'cash' ? p.received ?? p.amount : p.amount), 0)
}

/**
 * Everything handed over for an order of `total`, worked out from its payments every time it is
 * saved (never adjusted step by step, so it can't drift): what the payments put in hand, plus any
 * part of the order no payment covers (begun before payments were recorded), taken as exact. The
 * sale's `paymentAmount`; its change is this less the total, never below zero.
 */
export function handedTotal(payments: readonly PaymentInput[], total: number): number {
  const covered = payments.reduce((sum, p) => sum + p.amount, 0)
  return handedOver(payments) + Math.max(0, total - covered)
}

/**
 * The payments as Sanity stores them, keyed. The first checkout's are `pay-0` and `pay-1`;
 * payments for items added later carry `addedAt` and a key from that time, so every save's
 * keys differ and stay safe to send back to the edit route.
 */
export function toSalePaymentDocs(payments: readonly PaymentInput[], addedAt?: string): Array<SalePayment & { _type: 'salePayment' }> {
  const prefix = addedAt ? `pay-${Date.parse(addedAt).toString(36)}` : 'pay'
  return payments.map((p, index) => ({
    _type: 'salePayment' as const,
    _key: `${prefix}-${index}`,
    method: p.method,
    amount: p.amount,
    ...(p.received !== undefined ? { received: p.received } : {}),
    ...(addedAt ? { addedAt } : {}),
  }))
}
