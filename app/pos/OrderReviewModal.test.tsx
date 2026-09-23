import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import OrderReviewModal from './OrderReviewModal'
import type { OrderItem, DiscountLine } from './types'

const items: OrderItem[] = [
  { lineId: 'a', name: 'Spanish Latte', variant: 'ice', price: 150, qty: 2, discount: 'review' },
  { lineId: 'b', name: 'Croissant', variant: null, price: 100, qty: 1, discount: 'pwd' },
]

const discountLines: DiscountLine[] = [
  { lineId: 'a', name: 'Spanish Latte', amount: 30, kind: 'review', label: 'Google Review −10%' },
  { lineId: 'b', name: 'Croissant', amount: 20, kind: 'pwd', label: 'PWD Food −20%' },
]

const base = {
  orderItems: items,
  itemCount: 3,
  total: 400,
  grandTotal: 350,
  discountLines,
  discountAmount: 50,
  payment: 500,
  notes: 'Ana',
  isSubmitting: false,
  submitError: null,
  onCancel: () => {},
  onComplete: () => {},
}

describe('OrderReviewModal', () => {
  it('lists one breakdown row per discounted line under the subtotal', () => {
    const html = renderToStaticMarkup(<OrderReviewModal {...base} />)
    expect(html).toContain('Subtotal')
    expect(html).toContain('Google Review −10% (Spanish Latte)')
    expect(html).toContain('−₱30')
    expect(html).toContain('PWD Food −20% (Croissant)')
    expect(html).toContain('−₱20')
  })

  it('badges each discounted item with its discount', () => {
    const html = renderToStaticMarkup(<OrderReviewModal {...base} />)
    expect(html).toContain('Google Review −10%</span>')
    expect(html).toContain('PWD/Senior −20%</span>')
  })

  it('hides the breakdown when nothing is discounted', () => {
    const plain = items.map(i => ({ ...i, discount: undefined }))
    const html = renderToStaticMarkup(
      <OrderReviewModal {...base} orderItems={plain} discountLines={[]} discountAmount={0} />
    )
    expect(html).not.toContain('Subtotal')
  })
})
