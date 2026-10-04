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
  onAddItems: noop,
  onRename: async () => null,
}

describe('OrderCard', () => {
  it('lets the name be added or changed on the card, except on a loyalty card holder’s order', () => {
    expect(renderToStaticMarkup(<OrderCard {...props} />)).toContain('aria-label="Change the name on this order: Allen"')
    const noName = renderToStaticMarkup(<OrderCard {...props} order={{ ...order, notes: undefined }} />)
    // The spoken name starts with what the button shows, for voice control.
    expect(noName).toContain('aria-label="No name: add a name to this order"')
    expect(noName).toContain('No name')
    const onCard = renderToStaticMarkup(<OrderCard {...props} order={{ ...order, notes: 'Kylene', loyaltyMemberId: 'k' }} />)
    expect(onCard).toContain('>Kylene<svg')
    expect(onCard).toContain('<span class="sr-only">, on a loyalty card</span>')
    expect(onCard).not.toContain('Change the name')
  })

  it('offers Add items on a pending order only, between Complete and Print', () => {
    const html = renderToStaticMarkup(<OrderCard {...props} />)
    expect(html).toContain('Add items</button>')
    expect(html.indexOf('Complete</button>')).toBeLessThan(html.indexOf('Add items</button>'))
    expect(html.indexOf('Add items</button>')).toBeLessThan(html.indexOf('>Print</button>'))
    expect(renderToStaticMarkup(<OrderCard {...props} mode="completed" />)).not.toContain('Add items')
  })

  it('prints from one Print button: the staff ticket, the receipt and the PDF are chosen in its sheet', () => {
    for (const mode of ['recent', 'completed'] as const) {
      const html = renderToStaticMarkup(<OrderCard {...props} mode={mode} />)
      expect(html.match(/>Print<\/button>/g)).toHaveLength(1)
      expect(html).not.toContain('Print Staff')
      expect(html).not.toContain('>PDF<')
    }
  })

  it('lists lines added later under the time they were added, after the first order', () => {
    const latte = { lineId: 'cafe-latte__hot__ak3j9', name: 'Cafe Latte', variant: 'hot', price: 110, qty: 1, addedAt: '2026-10-01T14:58:00.000Z' }
    const html = renderToStaticMarkup(<OrderCard {...props} order={{ ...order, items: [...order.items, latte] }} />)
    expect(html).toContain('+ Added 10:58 PM')
    expect(html.indexOf('Sea Salt Cookie')).toBeLessThan(html.indexOf('Added 10:58 PM · 1 item'))
    expect(html.indexOf('Added 10:58 PM · 1 item')).toBeLessThan(html.indexOf('Cafe Latte'))
    expect(renderToStaticMarkup(<OrderCard {...props} />)).not.toContain('Added')
  })

  it('puts the amber quantity mark on every item line, ×1 included', () => {
    const html = renderToStaticMarkup(<OrderCard {...props} />)
    // One badge per item line; the add-on under the mocha keeps its plain count.
    expect(html.match(/bg-amber-400/g)).toHaveLength(2)
    expect(html).toMatch(/bg-amber-400[^"]*">×1<\/span>/)
    expect(html).toMatch(/bg-amber-400[^"]*">×2<\/span>/)
  })
})
