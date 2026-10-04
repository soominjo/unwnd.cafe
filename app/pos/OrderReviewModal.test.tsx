import { describe, it, expect } from 'vitest'
import { isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import OrderReviewModal from './OrderReviewModal'
import type { OrderItem, DiscountLine } from './types'
import type { OpenOrder } from './addToOrder'

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
  saving: false,
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

  it('completes with one button, Complete + Print: a preview then prints the receipt or both, or closes without printing', () => {
    const html = renderToStaticMarkup(<OrderReviewModal {...base} />)
    expect(html).toContain('🖨 Complete + Print')
    expect(html).not.toContain('Order Complete')
    // Not "✕": the review has a ✕ of its own, which cancels.
    expect(html).toContain('After saving, a preview prints the receipt or both; closing it skips printing.')
    let completed = 0
    buttonLabelled(OrderReviewModal({ ...base, onComplete: () => { completed += 1 } }), '🖨 Complete + Print')?.onClick()
    expect(completed).toBe(1)
  })

  it('shows Saving… and locks every way out while the sale saves', () => {
    const html = renderToStaticMarkup(<OrderReviewModal {...base} saving />)
    expect(html).not.toContain('Complete + Print')
    expect(html).toContain('Saving…')
    // The ✕ and the one button.
    expect(html.match(/disabled=""/g)).toHaveLength(2)
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

describe('OrderReviewModal, the customer’s name', () => {
  const naming = { ...base, onNotesChange: () => {} }

  it('offers to add a name the order has not got, right before saving it', () => {
    expect(renderToStaticMarkup(<OrderReviewModal {...naming} notes="" />)).toContain('+ Add name</button>')
  })

  it('shows the name with Edit beside it', () => {
    const html = renderToStaticMarkup(<OrderReviewModal {...naming} notes="Ana" />)
    expect(html).toContain('>Ana</span>')
    expect(html).toContain('aria-label="Edit the customer’s name"')
  })

  it('keeps a loyalty card holder’s name fixed, and shows it as before where it can’t change', () => {
    const fixed = renderToStaticMarkup(<OrderReviewModal {...naming} notes="Ana" nameFixed />)
    expect(fixed).toContain('>Ana</span>')
    expect(fixed).not.toContain('Edit the customer')
    expect(renderToStaticMarkup(<OrderReviewModal {...base} notes="" />)).not.toContain('Add name')
  })
})

describe('OrderReviewModal, adding to a saved order', () => {
  // The order in the owner's screenshot, saved at 2:14 PM for ₱790.
  const saved: OpenOrder = {
    id: 'sale-214', rev: 'rev-9', createdAt: '2026-10-03T06:14:00Z', name: '', total: 790,
    items: [
      { lineId: 'tiramisu__ice', name: 'Tiramisu', variant: 'ice', price: 160, qty: 2 },
      { lineId: 'amber-cream-latte__ice', name: 'Amber Cream Latte', variant: 'ice', price: 150, qty: 1 },
    ],
    discounts: [], loyaltyMemberId: null, loyaltyRewards: [],
  }
  const adding = { ...base, savedOrder: saved }

  it('shows what was ordered before above what is being added, and the whole order’s total due', () => {
    const html = renderToStaticMarkup(<OrderReviewModal {...adding} />)
    expect(html).toContain('Adding to the 2:14 PM order')
    expect(html).toContain('Already ordered · 2:14 PM')
    expect(html).toContain('Tiramisu')
    expect(html).toContain('Adding now')
    expect(html.indexOf('Tiramisu')).toBeLessThan(html.indexOf('Spanish Latte'))
    // ₱790 saved + ₱340 added; ₱500 paid leaves ₱630 short.
    expect(html).toContain('₱1130')
    expect(html).toContain('Already ordered ₱790 · added now ₱340')
    expect(html).toContain('₱630')
  })

  it('saves onto the order with its one button, Save + Print, never as a new order', () => {
    const html = renderToStaticMarkup(<OrderReviewModal {...adding} />)
    expect(html).not.toContain('Order Complete')
    expect(html).not.toContain('Save to order')
    expect(html).toContain('Saves onto the 2:14 PM order: no new order is made. A preview then prints, or closing it skips printing.')
    let saved = 0
    buttonLabelled(OrderReviewModal({ ...adding, onComplete: () => { saved += 1 } }), '🖨 Save + Print')?.onClick()
    expect(saved).toBe(1)
  })

  it('can’t save onto the order with nothing being added', () => {
    const html = renderToStaticMarkup(<OrderReviewModal {...adding} orderItems={[]} itemCount={0} total={0} grandTotal={0} discountLines={[]} discountAmount={0} />)
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>🖨 Save \+ Print</)
  })

  it('offers a way on when the order can no longer take items', () => {
    const steps: string[] = []
    const refusal = { actionLabel: 'Make it a new order', onAction: () => { steps.push('new order') } }
    const props = { ...adding, submitError: 'This order was completed, so nothing more can be added to it.', refusal }
    expect(renderToStaticMarkup(<OrderReviewModal {...props} />)).toContain('This order was completed')
    buttonLabelled(OrderReviewModal(props), 'Make it a new order')?.onClick()
    expect(steps).toEqual(['new order'])
  })
})
