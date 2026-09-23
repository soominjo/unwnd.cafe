import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import OrderReviewModal from './OrderReviewModal'
import type { OrderItem, DiscountLine } from './types'

const items: OrderItem[] = [
  { lineId: 'a', name: 'Spanish Latte', variant: 'ice', price: 150, qty: 2, discounts: { pwd: 'solo', review: 'all' } },
  { lineId: 'b', name: 'Croissant', variant: null, price: 100, qty: 1 },
]

const discountLines: DiscountLine[] = [
  { lineId: 'a', name: 'Spanish Latte', amount: 30, kind: 'pwd', scope: 'solo', label: 'PWD Drink −20% ×1' },
  { lineId: 'a', name: 'Spanish Latte', amount: 30, kind: 'review', scope: 'all', label: 'Google Review −10% ×2' },
  { lineId: 'order:pwd', name: 'Total items', amount: 80, kind: 'pwd', scope: 'order', label: 'PWD/Senior −20%' },
]

const base = {
  orderItems: items,
  itemCount: 3,
  total: 400,
  grandTotal: 260,
  discountLines,
  discountAmount: 140,
  payment: 500,
  notes: 'Ana',
  isSubmitting: false,
  submitError: null,
  onCancel: () => {},
  onComplete: () => {},
}

describe('OrderReviewModal', () => {
  it('lists every discount row — two for a stacked line and the whole-order row — under the subtotal', () => {
    const html = renderToStaticMarkup(<OrderReviewModal {...base} />)
    expect(html).toContain('Subtotal')
    expect(html).toContain('PWD Drink −20% ×1 (Spanish Latte)')
    expect(html).toContain('Google Review −10% ×2 (Spanish Latte)')
    expect(html).toContain('PWD/Senior −20% (Total items)')
    expect(html).toContain('−₱80')
  })

  it('badges a stacked item with both of its discounts and their unit counts', () => {
    const html = renderToStaticMarkup(<OrderReviewModal {...base} />)
    expect(html).toContain('PWD/Senior −20% ×1</span>')
    expect(html).toContain('Google Review −10% ×2</span>')
  })

  it('hides the breakdown when nothing is discounted', () => {
    const plain = items.map(i => ({ ...i, discounts: undefined }))
    const html = renderToStaticMarkup(
      <OrderReviewModal {...base} orderItems={plain} discountLines={[]} discountAmount={0} />
    )
    expect(html).not.toContain('Subtotal')
  })
})
