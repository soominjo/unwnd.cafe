import { describe, it, expect } from 'vitest'
import { changePaymentMethod, shrinkPayments } from './paymentChanges'
import type { SalePayment } from './payments'

const ADDED = '2026-10-11T11:05:00.000Z'
const pay = (fields: Omit<SalePayment, '_key'> & { _key?: string }): SalePayment & { _type: 'salePayment' } =>
  ({ _type: 'salePayment', _key: 'pay-0', ...fields })

// Kim: ₱350 by e-wallet at checkout, then a ₱200 cake added and paid in cash.
const kim = [pay({ method: 'ewallet', amount: 350 }), pay({ _key: 'pay-x-0', method: 'cash', amount: 200, received: 200, addedAt: ADDED })]

describe('shrinkPayments', () => {
  it('takes a removed line off the payment for its own round first', () => {
    // The cake (added later, paid in cash) is removed: its cash payment goes.
    expect(shrinkPayments(kim, 200, ADDED, 550)).toEqual([kim[0]])
  })

  it('takes a first-checkout line off the first checkout’s payment, even with a later one on the order', () => {
    expect(shrinkPayments(kim, 160, null, 550)).toEqual([{ ...kim[0], amount: 190 }, kim[1]])
  })

  it('keeps what a cash customer handed over when their payment is cut, so the cut goes back as change', () => {
    const cash = [pay({ method: 'cash', amount: 420, received: 500 })]
    expect(shrinkPayments(cash, 120, null, 420)).toEqual([{ ...cash[0], amount: 300 }])
  })

  it('cuts first the part of an order no payment covers, when it was begun before payments were recorded', () => {
    // ₱300 from before payments were recorded, then ₱150 of added items paid by card.
    const card = [pay({ method: 'card', amount: 150, addedAt: ADDED })]
    expect(shrinkPayments(card, 100, null, 450)).toEqual(card)
    expect(shrinkPayments(card, 350, null, 450)).toEqual([{ ...card[0], amount: 100 }])
  })

  it('cuts a split from its newest part first', () => {
    const split = [pay({ method: 'ewallet', amount: 200 }), pay({ _key: 'pay-1', method: 'cash', amount: 220, received: 220 })]
    expect(shrinkPayments(split, 250, null, 420)).toEqual([{ ...split[0], amount: 170 }])
  })

  it('changes nothing when nothing came off', () => {
    expect(shrinkPayments(kim, 0, null, 550)).toEqual(kim)
  })
})

describe('changePaymentMethod', () => {
  const MOVED = '2026-10-11T12:02:00.000Z'
  const LATER = '2026-10-11T12:30:00.000Z'
  const split = [pay({ method: 'ewallet', amount: 200 }), pay({ _key: 'pay-1', method: 'cash', amount: 220, received: 300 })]

  it('moves a payment to another method, keeping its amount, key, type and time, and notes what it was taken as and when it moved', () => {
    expect(changePaymentMethod(kim, 'pay-x-0', 'card', MOVED)).toEqual([
      kim[0],
      { _type: 'salePayment', _key: 'pay-x-0', method: 'card', amount: 200, addedAt: ADDED, movedFrom: 'cash', movedAt: MOVED, receivedBefore: 200 },
    ])
  })

  it('counts a payment moved to cash as the exact amount', () => {
    expect(changePaymentMethod(split, 'pay-0', 'cash', MOVED)?.[0]).toEqual({
      _type: 'salePayment', _key: 'pay-0', method: 'cash', amount: 200, received: 200, movedFrom: 'ewallet', movedAt: MOVED,
    })
  })

  it('sets aside what was handed over when a payment moves off cash, and gives it back when it moves back', () => {
    const moved = changePaymentMethod(split, 'pay-1', 'ewallet', MOVED)!
    expect(moved).toEqual([split[0], { _type: 'salePayment', _key: 'pay-1', method: 'ewallet', amount: 220, movedFrom: 'cash', movedAt: MOVED, receivedBefore: 300 }])
    expect(changePaymentMethod(moved, 'pay-1', 'cash', LATER)).toEqual(split)
  })

  it('remembers what a payment was taken as through later moves, with the time of the latest', () => {
    const once = changePaymentMethod(split, 'pay-1', 'card', MOVED)!
    expect(changePaymentMethod(once, 'pay-1', 'ewallet', LATER)?.[1]).toEqual({
      _type: 'salePayment', _key: 'pay-1', method: 'ewallet', amount: 220, movedFrom: 'cash', movedAt: LATER, receivedBefore: 300,
    })
  })

  it('reads as saved again once moved back to what it was taken as', () => {
    const once = changePaymentMethod(kim, 'pay-0', 'cash', MOVED)!
    expect(changePaymentMethod(once, 'pay-0', 'ewallet', LATER)).toEqual(kim)
  })

  it('leaves the payments as they are when the method is the same, and says so when the payment is not there', () => {
    expect(changePaymentMethod(split, 'pay-1', 'cash', MOVED)).toEqual(split)
    expect(changePaymentMethod(split, 'pay-9', 'card', MOVED)).toBeNull()
  })
})
