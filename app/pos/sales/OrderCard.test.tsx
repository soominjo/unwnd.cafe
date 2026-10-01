import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Sale } from '../types'
import OrderCard, { type OrderCardProps } from './OrderCard'

// ReceiptPreview sets up its font through Next's compiler-only loader when imported.
vi.mock('next/font/google', () => ({ IBM_Plex_Mono: () => ({ className: '' }) }))

const noop = () => {}

const order: Sale = {
  _id: 'sale-1',
  _createdAt: '2026-10-01T14:41:00.000Z',
  total: 290,
  paymentAmount: 300,
  change: 10,
  notes: 'Allen',
  items: [
    { lineId: 'wcm__ice', name: 'White Chocolate Mocha', variant: 'ice', price: 140, qty: 1 },
    { lineId: 'addon__shot__wcm__ice', name: 'Espresso Shot', variant: null, price: 30, qty: 1, isAddon: true, parentLineId: 'wcm__ice' },
    { lineId: 'cookie__fixed', name: 'Sea Salt Cookie', variant: null, price: 60, qty: 2 },
  ],
}

const props: OrderCardProps = {
  order,
  mode: 'recent',
  isConfirming: false,
  isDeleting: false,
  isCompleting: false,
  confirmItemKey: null,
  deletingItemKey: null,
  onRequestDelete: noop,
  onCancelDelete: noop,
  onConfirmDelete: noop,
  onRequestDeleteItem: noop,
  onCancelDeleteItem: noop,
  onConfirmDeleteItem: noop,
  onCompleteOrder: noop,
}

describe('OrderCard', () => {
  it('puts the amber quantity mark on every item line, ×1 included', () => {
    const html = renderToStaticMarkup(<OrderCard {...props} />)
    // One badge per item line; the add-on under the mocha keeps its plain count.
    expect(html.match(/bg-amber-400/g)).toHaveLength(2)
    expect(html).toMatch(/bg-amber-400[^"]*">×1<\/span>/)
    expect(html).toMatch(/bg-amber-400[^"]*">×2<\/span>/)
  })
})
