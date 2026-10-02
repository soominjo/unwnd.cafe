import { describe, it, expect } from 'vitest'
import { isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import OrderReviewModal from './OrderReviewModal'
import type { OrderItem, DiscountLine } from './types'

// The modal uses no hooks, so calling it returns its element tree; this finds a button in it by label.
function buttonLabelled(node: ReactNode, label: string): { onClick: () => void } | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = buttonLabelled(child, label)
      if (hit) return hit
    }
    return undefined
  }
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node)) return undefined
  const { children, onClick } = node.props
  if (node.type === 'button' && children === label && onClick) return { onClick }
  return buttonLabelled(children, label)
}

const items: OrderItem[] = [
  { lineId: 'a', name: 'Spanish Latte', variant: 'ice', price: 150, qty: 2, discounts: { pwd: 'solo', review: 'all' } },
  { lineId: 'b', name: 'Croissant', variant: null, price: 100, qty: 1 },
]

// A stacked line: both kinds on the latte.
const discountLines: DiscountLine[] = [
  { lineId: 'a', name: 'Spanish Latte', amount: 30, kind: 'pwd', scope: 'solo', label: 'PWD Drink −20% ×1' },
  { lineId: 'a', name: 'Spanish Latte', amount: 30, kind: 'review', scope: 'all', label: 'Google Review −10% ×2' },
]

const base = {
  orderItems: items,
  itemCount: 3,
  total: 400,
  grandTotal: 340,
  discountLines,
  discountAmount: 60,
  payment: 500,
  notes: 'Ana',
  loyalty: null,
  pendingAction: null,
  submitError: null,
  onCancel: () => {},
  onComplete: () => {},
}

describe('OrderReviewModal', () => {
  it('lists both rows of a stacked line under the subtotal', () => {
    const html = renderToStaticMarkup(<OrderReviewModal {...base} />)
    expect(html).toContain('Subtotal')
    expect(html).toContain('PWD Drink −20% ×1 (Spanish Latte)')
    expect(html).toContain('Google Review −10% ×2 (Spanish Latte)')
    expect(html).toContain('−₱30')
  })

  it('offers Complete + Print Receipt beside Order Complete', () => {
    const html = renderToStaticMarkup(<OrderReviewModal {...base} />)
    expect(html).toContain('Order Complete ✓')
    expect(html).toContain('🖨 Complete + Print Receipt')
  })

  it('completes plainly from Order Complete and with a receipt from the receipt button', () => {
    const actions: string[] = []
    const tree = OrderReviewModal({ ...base, onComplete: action => { actions.push(action) } })
    buttonLabelled(tree, 'Order Complete ✓')?.onClick()
    buttonLabelled(tree, '🖨 Complete + Print Receipt')?.onClick()
    expect(actions).toEqual(['plain', 'receipt'])
  })

  it('shows Saving… only on the button that was tapped, and locks every way out while the sale saves', () => {
    const html = renderToStaticMarkup(<OrderReviewModal {...base} pendingAction="receipt" />)
    expect(html).toContain('Order Complete ✓')
    expect(html).not.toContain('Complete + Print Receipt')
    expect(html).toContain('Saving…')
    // The ✕, Order Complete and the receipt button.
    expect(html.match(/disabled=""/g)).toHaveLength(3)
  })

  it('shows a linked card holder their stamps, and nothing for an order without a card', () => {
    const html = renderToStaticMarkup(
      <OrderReviewModal {...base} loyalty={{ name: 'Ana', cardNumber: 12, savedOnCard: 4, orderStamps: 2 }} />,
    )
    expect(html).toContain('Loyalty card No. 12')
    expect(html).toContain('+2 stamps this order')
    expect(html).toContain('6 of 11')
    expect(html).toContain('data-step=')
    expect(renderToStaticMarkup(<OrderReviewModal {...base} />)).not.toContain('Loyalty card')
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
