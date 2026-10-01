export interface SaleDiscountRow {
  lineId: string
  name: string
  amount: number
}

export interface SaleDiscountDoc extends SaleDiscountRow {
  _type: 'saleDiscount'
  _key: string
}

// Sanity needs every array member to carry a unique _key. A line can hold two
// discount rows (PWD/Senior and Google Review stack), so the lineId alone does
// not qualify — the row's position makes the key unique while keeping it readable.
export function toSaleDiscountDocs(rows: SaleDiscountRow[]): SaleDiscountDoc[] {
  return rows.map((d, index) => ({
    _type: 'saleDiscount',
    _key: `${d.lineId}-${index}`,
    lineId: d.lineId,
    name: d.name,
    amount: d.amount,
  }))
}
