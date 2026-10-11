import { describe, it, expect } from 'vitest'
import { NO_PAYMENT, cashSuggestions, checkPay, endSplit, pesosTyped, pickMethod, startSplit, type PayState } from './payState'

const cash = (received: number | null = null, receivedText = ''): PayState => ({ ...NO_PAYMENT, method: 'cash', received, receivedText })
const split = (first: PayState['method'], firstAmount: number | null, rest: PayState['method']): PayState => ({
  ...NO_PAYMENT,
  split: { first: first!, firstAmount, firstText: firstAmount === null ? '' : String(firstAmount), rest: rest! },
})

describe('checkPay', () => {
  it('waits for a method before the order can be completed', () => {
    expect(checkPay(420, NO_PAYMENT)).toMatchObject({ ok: false, tone: 'info' })
  })

  it('takes cash as the exact amount until an amount is picked', () => {
    expect(checkPay(420, cash())).toEqual({ ok: true, change: 0, payments: [{ method: 'cash', amount: 420, received: 420 }] })
  })

  it('works out the change from what the customer handed over', () => {
    expect(checkPay(420, cash(500))).toEqual({ ok: true, change: 80, payments: [{ method: 'cash', amount: 420, received: 500 }] })
  })

  it('refuses cash that falls short, saying by how much', () => {
    const check = checkPay(420, cash(400, '400'))
    expect(check).toMatchObject({ ok: false, tone: 'error', short: 20 })
    expect(check.ok === false && check.reason).toContain('₱20 short')
  })

  it('takes e-wallet and card as the exact total, with no change', () => {
    expect(checkPay(420, { ...NO_PAYMENT, method: 'ewallet' })).toEqual({ ok: true, change: 0, payments: [{ method: 'ewallet', amount: 420 }] })
    expect(checkPay(420, { ...NO_PAYMENT, method: 'card' })).toEqual({ ok: true, change: 0, payments: [{ method: 'card', amount: 420 }] })
  })

  it('splits the total: the first part as typed, the rest on the second method', () => {
    expect(checkPay(420, split('ewallet', 200, 'cash'))).toEqual({
      ok: true,
      change: 0,
      payments: [{ method: 'ewallet', amount: 200 }, { method: 'cash', amount: 220, received: 220 }],
    })
  })

  it('refuses a split by one method, a split with no first part, and a first part as big as the total', () => {
    expect(checkPay(420, split('cash', 200, 'cash'))).toMatchObject({ ok: false, tone: 'error' })
    expect(checkPay(420, split('ewallet', null, 'cash'))).toMatchObject({ ok: false, tone: 'info' })
    expect(checkPay(420, split('ewallet', 420, 'cash'))).toMatchObject({ ok: false, tone: 'error' })
    expect(checkPay(420, split('ewallet', 0, 'cash'))).toMatchObject({ ok: false })
  })

  it('asks for nothing on a ₱0 order, a free drink only', () => {
    expect(checkPay(0, NO_PAYMENT)).toEqual({ ok: true, change: 0, payments: [] })
    expect(checkPay(0, cash(100))).toEqual({ ok: true, change: 0, payments: [] })
  })
})

describe('cashSuggestions', () => {
  it('offers the next ₱50 and ₱100 above the total, then the usual bills', () => {
    expect(cashSuggestions(420)).toEqual([450, 500, 1000, 2000])
    expect(cashSuggestions(130)).toEqual([150, 200, 500, 1000])
  })

  it('skips amounts that are not more than the total', () => {
    expect(cashSuggestions(100)).toEqual([200, 500, 1000, 2000])
    expect(cashSuggestions(1240)).toEqual([1250, 1300, 2000])
  })
})

describe('pesosTyped', () => {
  it('reads a typed amount as whole pesos, and nothing for an empty or bad field', () => {
    expect(pesosTyped('500')).toBe(500)
    expect(pesosTyped('499.6')).toBe(500)
    expect(pesosTyped('')).toBeNull()
    expect(pesosTyped('abc')).toBeNull()
    expect(pesosTyped('-5')).toBeNull()
  })
})

describe('picking and splitting', () => {
  it('drops a cash amount when another method is picked, and keeps the state when the same one is', () => {
    const picked = cash(500)
    expect(pickMethod(picked, 'cash')).toBe(picked)
    expect(pickMethod(picked, 'card')).toEqual({ ...NO_PAYMENT, method: 'card' })
  })

  it('starts a split from the method picked (E-wallet when none), with the rest on another method', () => {
    expect(startSplit({ ...NO_PAYMENT, method: 'card' }).split).toEqual({ first: 'card', firstAmount: null, firstText: '', rest: 'cash' })
    expect(startSplit(NO_PAYMENT).split).toEqual({ first: 'ewallet', firstAmount: null, firstText: '', rest: 'cash' })
    expect(startSplit(cash()).split).toEqual({ first: 'cash', firstAmount: null, firstText: '', rest: 'ewallet' })
  })

  it('goes back to one method, the split’s first one', () => {
    expect(endSplit(split('card', 100, 'cash'))).toEqual({ ...NO_PAYMENT, method: 'card' })
  })
})
