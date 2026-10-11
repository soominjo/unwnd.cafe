import type { PaymentMethod, SalePayment } from './payments'

// Changes to a saved order's payments, made by the sale routes: a method fixed on Sales, and a
// line removed after the order was paid. The payments keep adding up to what they cover; the
// routes then work out what was handed over from them (handedTotal).

/**
 * The payments once `by` pesos came off the order (a line removed on Sales). The cut comes first
 * off the payments for the removed line's round (newest first), then off any part of the order no
 * payment covers (it was begun before payments were recorded), then off the other payments, newest
 * first. A cash payment that is cut keeps what was handed over, so the cut goes back as change; a
 * payment cut to nothing goes.
 */
export function shrinkPayments(payments: readonly SalePayment[], by: number, round: string | null, orderTotal: number): SalePayment[] {
  if (by <= 0) return [...payments]
  const amounts = payments.map(p => p.amount)
  const newestFirst = payments.map((_, i) => i).reverse()
  const inRound = (i: number) => (payments[i].addedAt ?? null) === round
  const steps: Array<number | 'unrecorded'> = [...newestFirst.filter(inRound), 'unrecorded', ...newestFirst.filter(i => !inRound(i))]
  let unrecorded = Math.max(0, orderTotal - amounts.reduce((sum, a) => sum + a, 0))
  let left = by
  for (const step of steps) {
    if (left <= 0) break
    const cut = Math.min(left, step === 'unrecorded' ? unrecorded : amounts[step])
    if (step === 'unrecorded') unrecorded -= cut
    else amounts[step] -= cut
    left -= cut
  }
  return payments.flatMap((p, i) => (amounts[i] > 0.004 ? [amounts[i] === p.amount ? p : { ...p, amount: amounts[i] }] : []))
}

/** The fields a move rewrites; every other stored field (its _type, amount, addedAt) stays. */
const MOVE_FIELDS = new Set(['method', 'received', 'movedFrom', 'movedAt', 'receivedBefore'])

/**
 * The payments with one payment moved to another method (it was taken under the wrong one) at
 * `at`. The payment keeps what it was taken as and when it last moved, so a move always shows on
 * Sales; moved back to what it was taken as, it reads as saved again. A payment moved to cash
 * counts as the exact amount; one taken as cash sets aside what was handed over, and gets it back
 * if it moves back. Null when no payment has that key (it changed on another device).
 */
export function changePaymentMethod(payments: readonly SalePayment[], key: string, method: PaymentMethod, at: string): SalePayment[] | null {
  const index = payments.findIndex(p => p._key === key)
  if (index < 0) return null
  const old = payments[index]
  if (old.method === method) return [...payments]
  const kept = Object.fromEntries(Object.entries(old).filter(([field]) => !MOVE_FIELDS.has(field))) as Omit<SalePayment, 'method'>
  const takenAs = old.movedFrom ?? old.method
  const handed = old.movedFrom ? old.receivedBefore : old.method === 'cash' ? old.received : undefined
  const fixed: SalePayment =
    method === takenAs
      ? { ...kept, method, ...(handed !== undefined ? { received: Math.max(handed, old.amount) } : {}) }
      : {
          ...kept,
          method,
          ...(method === 'cash' ? { received: old.amount } : {}),
          movedFrom: takenAs,
          movedAt: at,
          ...(handed !== undefined ? { receivedBefore: handed } : {}),
        }
  return payments.map((p, i) => (i === index ? fixed : p))
}
