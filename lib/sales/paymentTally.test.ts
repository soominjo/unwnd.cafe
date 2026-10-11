import { describe, it, expect } from 'vitest'
import { countOrderTypes, paymentLines, tallyPayments, wholeShares, type TallySale } from './paymentTally'

const at = (hhmm: string) => `2026-10-11T${hhmm}:00.000Z`
const p = (key: string, method: 'cash' | 'ewallet' | 'card', amount: number, extra: Record<string, unknown> = {}) => ({ _key: key, method, amount, ...extra })

// Seven orders, revenue ₱2,590 (380 + 100 + 430 + 580 + 200 + 550 + 350).
const sales: TallySale[] = [
  { _id: 'a', _createdAt: at('09:12'), total: 380, notes: 'Joy', orderType: 'dine-in', payments: [p('pay-0', 'cash', 380, { received: 500 })] },
  { _id: 'b', _createdAt: at('09:31'), total: 100, orderType: 'take-out', payments: [p('pay-0', 'ewallet', 100)] },
  // Taken as cash, then moved to Card on Sales.
  { _id: 'c', _createdAt: at('09:48'), total: 430, notes: 'Marco', orderType: 'dine-in', payments: [p('pay-0', 'card', 430, { movedFrom: 'cash', movedAt: at('11:00'), receivedBefore: 500 })] },
  { _id: 'd', _createdAt: at('10:05'), total: 580, notes: 'Paolo', orderType: 'dine-in', payments: [p('pay-0', 'ewallet', 300), p('pay-1', 'cash', 280)] },
  // Saved before payments were recorded.
  { _id: 'e', _createdAt: at('08:40'), total: 200, notes: 'Old' },
  // Begun before payments were recorded; ₱200 of items added later, paid in cash.
  { _id: 'f', _createdAt: at('08:50'), total: 550, payments: [p('pay-x-0', 'cash', 200, { addedAt: at('10:20') })] },
  // Paid by e-wallet twice: at checkout, and for items added later.
  { _id: 'g', _createdAt: at('10:30'), total: 350, notes: ' Kim ', orderType: 'take-out', payments: [p('pay-0', 'ewallet', 150), p('pay-y-0', 'ewallet', 200, { addedAt: at('10:45') })] },
]

describe('tallyPayments', () => {
  it('sums each method, counting an order once for each method it used', () => {
    expect(tallyPayments(sales)).toEqual({
      cash: { amount: 860, orders: 3 },
      ewallet: { amount: 750, orders: 3 },
      card: { amount: 430, orders: 1 },
      notRecorded: { amount: 550, orders: 2 },
    })
  })

  it('always adds up to the revenue: what no payment covers counts as Not recorded', () => {
    const t = tallyPayments(sales)
    expect(t.cash.amount + t.ewallet.amount + t.card.amount + t.notRecorded.amount).toBe(2590)
  })

  it('comes to nothing for a period with no orders', () => {
    const none = { amount: 0, orders: 0 }
    expect(tallyPayments([])).toEqual({ cash: none, ewallet: none, card: none, notRecorded: none })
  })
})

describe('countOrderTypes', () => {
  it('counts Dine in and Take out, and orders from before it was asked as Not recorded', () => {
    expect(countOrderTypes(sales)).toEqual({ dineIn: 3, takeOut: 2, notRecorded: 2 })
  })
})

describe('paymentLines', () => {
  it('lists every payment newest first, each at the time it was paid, with the order it was part of', () => {
    const lines = paymentLines(sales)
    expect(lines.map(l => `${l.saleId}:${l.paymentKey}`)).toEqual(['g:pay-y-0', 'g:pay-0', 'f:pay-x-0', 'd:pay-0', 'd:pay-1', 'c:pay-0', 'b:pay-0', 'a:pay-0'])
    expect(lines[0]).toEqual({ saleId: 'g', paymentKey: 'pay-y-0', method: 'ewallet', amount: 200, paidAt: at('10:45'), name: 'Kim', orderTotal: 350, partOfMore: true })
    expect(lines.find(l => l.saleId === 'b')).toMatchObject({ name: '', partOfMore: false, paidAt: at('09:31') })
  })

  it('says what a moved payment was taken as, and when it moved', () => {
    const lines = paymentLines(sales)
    expect(lines.find(l => l.saleId === 'c')).toMatchObject({ method: 'card', movedFrom: 'cash', movedAt: at('11:00') })
    expect(lines.find(l => l.saleId === 'b')).not.toHaveProperty('movedFrom')
  })
})

describe('wholeShares', () => {
  it('rounds shares to whole percents that always add up to 100', () => {
    expect(wholeShares([1100, 1400, 430])).toEqual([37, 48, 15])
    expect(wholeShares([1, 1, 1]).reduce((a, b) => a + b, 0)).toBe(100)
    expect(wholeShares([0, 0, 0])).toEqual([0, 0, 0])
  })
})
