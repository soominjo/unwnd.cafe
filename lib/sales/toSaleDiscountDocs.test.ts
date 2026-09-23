import { describe, it, expect } from 'vitest'
import { toSaleDiscountDocs } from './toSaleDiscountDocs'

describe('toSaleDiscountDocs', () => {
  const rows = [
    { lineId: 'a', name: 'PWD Drink -20% x1 (Latte)', amount: 32 },
    { lineId: 'a', name: 'Google Review -10% x2 (Latte)', amount: 32 },
    { lineId: 'order:pwd', name: 'PWD/Senior -20% (Total items)', amount: 118 },
  ]

  it('gives every row a unique Sanity _key even when two rows belong to the same line', () => {
    const docs = toSaleDiscountDocs(rows)
    expect(new Set(docs.map(d => d._key)).size).toBe(rows.length)
  })

  it('keeps the row fields and types each doc as a saleDiscount', () => {
    expect(toSaleDiscountDocs(rows)[0]).toEqual({
      _type: 'saleDiscount',
      _key: 'a-0',
      lineId: 'a',
      name: 'PWD Drink -20% x1 (Latte)',
      amount: 32,
    })
  })
})
