import { samePesos, type PaymentInput, type PaymentMethod } from '@/lib/sales/payments'

// What the cashier has picked on the review screen, and whether it pays what is due.

/** Split between two methods: the first part as typed, the rest worked out for the second. */
export interface SplitState {
  first: PaymentMethod
  firstAmount: number | null
  /** The first part's field as typed. */
  firstText: string
  rest: PaymentMethod
}

export interface PayState {
  method: PaymentMethod | null
  /** Cash handed over, or null for the exact amount. */
  received: number | null
  /** The Other amount field as typed; empty when Exact or an amount button is picked. */
  receivedText: string
  split: SplitState | null
}

export const NO_PAYMENT: PayState = { method: null, received: null, receivedText: '', split: null }

export type PayCheck =
  | { ok: true; payments: PaymentInput[]; change: number }
  | { ok: false; tone: 'info' | 'error'; reason: string; short?: number }

/** Whole pesos as the review screen shows them: ₱1,250. */
export const formatPeso = (n: number): string => `₱${Math.round(n).toLocaleString('en-PH')}`
const peso = formatPeso

/** Cash as the POS sends it: what it covers, and what was handed over. */
const cashPart = (amount: number, received = amount): PaymentInput => ({ method: 'cash', amount, received })
const part = (method: PaymentMethod, amount: number): PaymentInput => (method === 'cash' ? cashPart(amount) : { method, amount })

function checkSplit(due: number, split: SplitState): PayCheck {
  if (split.first === split.rest) return { ok: false, tone: 'error', reason: 'Pick two different methods for the two parts.' }
  if (split.firstAmount === null || split.firstAmount <= 0) {
    return { ok: false, tone: 'info', reason: 'Type how much the first method covers; the rest goes on the second.' }
  }
  if (split.firstAmount >= due) {
    return { ok: false, tone: 'error', reason: `The first part has to be less than the total, ${peso(due)}.` }
  }
  return { ok: true, change: 0, payments: [part(split.first, split.firstAmount), part(split.rest, due - split.firstAmount)] }
}

/**
 * Whether what was picked pays `due`, and the payments to send. Nothing is asked on a ₱0 order;
 * otherwise a method must be picked, cash is the exact amount until another is, and short cash
 * is refused, as is a split that doesn't work out.
 */
export function checkPay(due: number, pay: PayState): PayCheck {
  if (samePesos(due, 0)) return { ok: true, change: 0, payments: [] }
  if (pay.split) return checkSplit(due, pay.split)
  if (!pay.method) return { ok: false, tone: 'info', reason: 'Choose how they’re paying first.' }
  if (pay.method !== 'cash') return { ok: true, change: 0, payments: [{ method: pay.method, amount: due }] }
  const received = pay.received ?? due
  if (received < due) {
    return { ok: false, tone: 'error', short: due - received, reason: `${peso(due - received)} short. Tap what they handed you, or split the payment.` }
  }
  return { ok: true, change: received - due, payments: [cashPart(due, received)] }
}

/** Quick cash amounts: the next ₱50 and ₱100 above the total, then the usual bills, four at most. */
export function cashSuggestions(due: number): number[] {
  const candidates = [Math.ceil(due / 50) * 50, Math.ceil(due / 100) * 100, 200, 500, 1000, 2000]
  return candidates.filter((v, i) => v > due && candidates.indexOf(v) === i).slice(0, 4)
}

/** A typed amount as whole pesos; null for an empty, unreadable or negative one. */
export function pesosTyped(text: string): number | null {
  if (text.trim() === '') return null
  const value = Number(text)
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : null
}

/** A tile tapped: a different method starts over (no cash amount carried across). */
export function pickMethod(pay: PayState, method: PaymentMethod): PayState {
  return pay.method === method && !pay.split ? pay : { ...NO_PAYMENT, method }
}

/** "Split payment": the method picked pays the first part (E-wallet when none was), another the rest. */
export function startSplit(pay: PayState): PayState {
  const first = pay.method ?? 'ewallet'
  return { ...NO_PAYMENT, split: { first, firstAmount: null, firstText: '', rest: first === 'cash' ? 'ewallet' : 'cash' } }
}

/** "Back to one method": the split's first method, with no amount. */
export function endSplit(pay: PayState): PayState {
  return { ...NO_PAYMENT, method: pay.split?.first ?? pay.method }
}
