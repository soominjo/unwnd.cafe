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
  onChangeMethod: async () => null,
}

describe('OrderCard, where it is eaten and how it was paid', () => {
  it('marks Take out in a filled badge, and Dine in plainly', () => {
    expect(renderToStaticMarkup(<OrderCard {...props} order={{ ...order, orderType: 'take-out' }} />)).toMatch(/<span[^>]*bg-foreground text-cream[^>]*>.*Take out</)
    expect(renderToStaticMarkup(<OrderCard {...props} order={{ ...order, orderType: 'dine-in' }} />)).toContain('Dine in')
  })

  it('shows each payment, with when it was paid on an order paid in two goes, each tappable to change its method', () => {
    const twoGoes: Sale = {
      ...order,
      total: 550,
      payments: [
        { _key: 'pay-0', method: 'ewallet', amount: 350 },
        { _key: 'pay-x-0', method: 'cash', amount: 200, received: 200, addedAt: '2026-10-01T14:58:00.000Z' },
      ],
    }
    const html = renderToStaticMarkup(<OrderCard {...props} order={twoGoes} />)
    expect(html).toContain('Paid')
    expect(html).toContain('E-wallet ₱350')
    expect(html).toContain('Cash ₱200')
    expect(html).toContain('· 10:41 PM')
    expect(html).toContain('· 10:58 PM')
    expect(html).toMatch(/<button[^>]*aria-expanded="false"[^>]*aria-label="₱350 by E-wallet at 10:41 PM. Change the method"/)
    // Paid at checkout only: no times.
    const once = renderToStaticMarkup(<OrderCard {...props} order={{ ...order, payments: [{ _key: 'pay-0', method: 'card', amount: 290 }] }} />)
    expect(once).toContain('Card ₱290')
    expect(once).not.toContain('· 10:41 PM')
  })

  it('says when a payment was moved to another method, and what it was taken as', () => {
    const moved = (movedAt: string): Sale => ({
      ...order,
      payments: [{ _key: 'pay-0', method: 'card', amount: 290, movedFrom: 'cash', movedAt, receivedBefore: 300 }],
    })
    const html = renderToStaticMarkup(<OrderCard {...props} order={moved('2026-10-01T15:02:00.000Z')} />)
    expect(html).toContain('Card ₱290')
    // The time kept on one line.
    expect(html).toMatch(/moved from Cash · <span class="whitespace-nowrap">11:02 PM<\/span>/)
    // Moved on a later day: the date too.
    expect(renderToStaticMarkup(<OrderCard {...props} order={moved('2026-10-03T01:15:00.000Z')} />)).toMatch(/moved from Cash · <span[^>]*>Oct 3, 9:15 AM</)
    expect(renderToStaticMarkup(<OrderCard {...props} order={{ ...order, payments: [{ _key: 'pay-0', method: 'card', amount: 290 }] }} />)).not.toContain('moved from')
  })

  it('says what part no payment covers, on an order begun before payments were recorded', () => {
    const partly: Sale = { ...order, total: 490, payments: [{ _key: 'pay-x-0', method: 'card', amount: 200, addedAt: '2026-10-01T14:58:00.000Z' }] }
    expect(renderToStaticMarkup(<OrderCard {...props} order={partly} />)).toContain('₱290 not recorded')
  })

  it('shows neither on an order from before they were recorded', () => {
    const html = renderToStaticMarkup(<OrderCard {...props} />)
    expect(html).not.toContain('>Paid<')
    expect(html).not.toContain('Take out')
    expect(html).not.toContain('Dine in')
  })
})

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
