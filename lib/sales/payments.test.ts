import { describe, it, expect } from 'vitest'
import { handedOver, handedTotal, isOrderType, parsePayments, toSalePaymentDocs } from './payments'

describe('parsePayments', () => {
  it('takes one payment that covers exactly what is due', () => {
    expect(parsePayments([{ method: 'ewallet', amount: 420 }], 420)).toEqual([{ method: 'ewallet', amount: 420 }])
    expect(parsePayments([{ method: 'card', amount: 420 }], 420)).toEqual([{ method: 'card', amount: 420 }])
  })

  it('keeps what a cash customer handed over, at least the amount', () => {
    expect(parsePayments([{ method: 'cash', amount: 420, received: 500 }], 420)).toEqual([{ method: 'cash', amount: 420, received: 500 }])
    expect(parsePayments([{ method: 'cash', amount: 420, received: 420 }], 420)).toEqual([{ method: 'cash', amount: 420, received: 420 }])
  })

  it('takes a split between two different methods that together cover what is due', () => {
    expect(parsePayments([{ method: 'ewallet', amount: 200 }, { method: 'cash', amount: 220 }], 420)).toEqual([
      { method: 'ewallet', amount: 200 },
      { method: 'cash', amount: 220 },
    ])
  })

  it('takes no payment when nothing is due (a free drink only), and refuses one then', () => {
    expect(parsePayments([], 0)).toEqual([])
    expect(parsePayments([{ method: 'cash', amount: 0 }], 0)).toBeNull()
  })

  it('refuses payments that do not come to what is due', () => {
    expect(parsePayments([{ method: 'cash', amount: 400 }], 420)).toBeNull()
    expect(parsePayments([{ method: 'ewallet', amount: 200 }, { method: 'cash', amount: 200 }], 420)).toBeNull()
    expect(parsePayments([], 420)).toBeNull()
  })

  it('refuses a split by one method twice, or more than two payments', () => {
    expect(parsePayments([{ method: 'cash', amount: 200 }, { method: 'cash', amount: 220 }], 420)).toBeNull()
    const three = [{ method: 'cash', amount: 100 }, { method: 'ewallet', amount: 100 }, { method: 'card', amount: 220 }]
    expect(parsePayments(three, 420)).toBeNull()
  })

  it('refuses cash handed over below its amount, and a handed-over amount on any other method', () => {
    expect(parsePayments([{ method: 'cash', amount: 420, received: 400 }], 420)).toBeNull()
    expect(parsePayments([{ method: 'ewallet', amount: 420, received: 500 }], 420)).toBeNull()
  })

  it('refuses a part of nothing or less, an unknown method, and anything that is not a list of payments', () => {
    expect(parsePayments([{ method: 'ewallet', amount: 0 }, { method: 'cash', amount: 420 }], 420)).toBeNull()
    expect(parsePayments([{ method: 'ewallet', amount: -20 }, { method: 'cash', amount: 440 }], 420)).toBeNull()
    expect(parsePayments([{ method: 'gcash', amount: 420 }], 420)).toBeNull()
    expect(parsePayments([{ amount: 420 }], 420)).toBeNull()
    expect(parsePayments([null], 420)).toBeNull()
    expect(parsePayments({ method: 'cash', amount: 420 }, 420)).toBeNull()
    expect(parsePayments('cash', 420)).toBeNull()
  })

  it('refuses amounts finer than a centavo', () => {
    expect(parsePayments([{ method: 'card', amount: 420.001 }], 420)).toBeNull()
    expect(parsePayments([{ method: 'cash', amount: 420, received: 500.005 }], 420)).toBeNull()
    expect(parsePayments([{ method: 'card', amount: 420.5 }], 420.5)).toEqual([{ method: 'card', amount: 420.5 }])
  })

  it('refuses more handed over than an order can come to', () => {
    // ₱500,000 due, but ₱1,499,999 handed over.
    expect(parsePayments([{ method: 'card', amount: 499999 }, { method: 'cash', amount: 1, received: 1000000 }], 500000)).toBeNull()
  })

  it('keeps only the payment fields, dropping anything else sent with them', () => {
    expect(parsePayments([{ method: 'card', amount: 420, _key: 'x', note: 'tip' }], 420)).toEqual([{ method: 'card', amount: 420 }])
  })
})

describe('handedOver', () => {
  it('counts cash as handed over and every other method exactly', () => {
    expect(handedOver([{ method: 'cash', amount: 220, received: 500 }, { method: 'ewallet', amount: 200 }])).toBe(700)
    expect(handedOver([{ method: 'cash', amount: 220 }])).toBe(220)
    expect(handedOver([])).toBe(0)
  })
})

describe('handedTotal', () => {
  it('is what the payments put in hand, plus any part of the order no payment covers taken as exact', () => {
    expect(handedTotal([{ method: 'cash', amount: 220, received: 500 }, { method: 'ewallet', amount: 200 }], 420)).toBe(700)
    // Begun before payments were recorded: ₱790 unrecorded, then ₱170 by card.
    expect(handedTotal([{ method: 'card', amount: 170 }], 960)).toBe(960)
    expect(handedTotal([], 300)).toBe(300)
  })

  it('never comes to less than the order, so the change is never negative', () => {
    expect(handedTotal([{ method: 'card', amount: 100 }], 150)).toBe(150)
  })
})

describe('toSalePaymentDocs', () => {
  it('stores each payment keyed and typed, with cash received only when there is one', () => {
    expect(toSalePaymentDocs([{ method: 'cash', amount: 220, received: 300 }, { method: 'ewallet', amount: 200 }])).toEqual([
      { _type: 'salePayment', _key: 'pay-0', method: 'cash', amount: 220, received: 300 },
      { _type: 'salePayment', _key: 'pay-1', method: 'ewallet', amount: 200 },
    ])
  })

  it('marks payments for items added later, with keys of their own that the edit route accepts', () => {
    const first = toSalePaymentDocs([{ method: 'cash', amount: 200 }], '2026-10-11T11:05:00.000Z')
    const second = toSalePaymentDocs([{ method: 'card', amount: 90 }], '2026-10-11T11:31:00.000Z')
    expect(first[0]).toMatchObject({ addedAt: '2026-10-11T11:05:00.000Z', method: 'cash', amount: 200 })
    expect(first[0]._key).toMatch(/^pay-[a-z0-9]+-0$/)
    expect(second[0]._key).not.toBe(first[0]._key)
    expect(first[0]._key).not.toBe('pay-0')
  })
})

describe('isOrderType', () => {
  it('knows Dine in and Take out only', () => {
    expect(isOrderType('dine-in')).toBe(true)
    expect(isOrderType('take-out')).toBe(true)
    expect(isOrderType('delivery')).toBe(false)
    expect(isOrderType(undefined)).toBe(false)
  })
})
