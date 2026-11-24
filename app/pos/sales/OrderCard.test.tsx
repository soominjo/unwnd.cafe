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
  confirmItemKey: null,
  deletingItemKey: null,
  onRequestDelete: noop,
  onCancelDelete: noop,
  onConfirmDelete: noop,
  onRequestDeleteItem: noop,
  onCancelDeleteItem: noop,
  onConfirmDeleteItem: noop,
  onCompleteOrder: noop,
  onServeLine: noop,
  onUnserveLine: noop,
  onOpenOtherTab: noop,
  onAddItems: noop,
  onRename: async () => null,
  onChangeMethod: async () => null,
}

const OUT = '2026-11-24T11:46:00.000Z' // 7:46 PM in Manila

/** Bea's order (7:40 PM). Pass the times the latte, Americano and nachos went out, and the fries'. */
const bea = (out?: string, fries?: string, extra: Partial<Sale> = {}): Sale => ({
  _id: 'bea',
  _createdAt: '2026-11-24T11:40:00.000Z',
  total: 580,
  paymentAmount: 580,
  change: 0,
  notes: 'Bea',
  items: [
    { lineId: 'spanish-latte__ice', name: 'Spanish Latte', variant: 'ice', price: 150, qty: 1, ...(out ? { servedAt: out } : {}) },
    { lineId: 'americano__hot', name: 'Americano', variant: 'hot', price: 120, qty: 1, ...(out ? { servedAt: out } : {}) },
    { lineId: 'nachos__fixed', name: 'Cheesy Beef Nachos', variant: null, price: 190, qty: 1, ...(out ? { servedAt: out } : {}) },
    { lineId: 'classic-fries__fixed', name: 'Classic Fries', variant: null, price: 120, qty: 1, ...(fries ? { servedAt: fries } : {}) },
  ],
  ...extra,
})

/** The opening tag of the element with this aria-label. */
function tagLabelled(html: string, label: string): string {
  const match = html.match(new RegExp(`<[a-z]+[^>]*aria-label="${label}"[^>]*>`))
  if (!match) throw new Error(`Nothing labelled "${label}"`)
  return match[0]
}

const count = (html: string, text: string) => html.split(text).length - 1

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

describe('OrderCard, serving items one by one', () => {
  it('under Recent, shows only what is still to serve, each with a check to tick it', () => {
    const html = renderToStaticMarkup(<OrderCard {...props} order={bea(OUT)} mode="recent" />)
    expect(html).toContain('aria-label="Remove Classic Fries"')
    for (const gone of ['Spanish Latte', 'Americano', 'Cheesy Beef Nachos']) expect(html).not.toContain(gone)
    // One label whatever its state: aria-pressed says whether it is ticked.
    expect(tagLabelled(html, 'Classic Fries served')).toContain('aria-pressed="false"')
    expect(count(html, 'aria-pressed="false"')).toBe(1)
  })

  it('under Recent, says how much of a partly served order is out, and where the rest is', () => {
    const html = renderToStaticMarkup(<OrderCard {...props} order={bea(OUT)} mode="recent" />)
    expect(html).toContain('3 of 4 served')
    expect(html).not.toContain('>Pending<')
    expect(html).toContain('3 items already out, in Completed')
    expect(html).toContain('style="width:75%"')
    // Complete still ticks whatever is left.
    expect(html).toContain('Complete</button>')
    expect(html).toContain('Add items</button>')
  })

  it('under Recent, an order with nothing out yet reads Pending, with no strip and no bar', () => {
    const html = renderToStaticMarkup(<OrderCard {...props} order={bea()} mode="recent" />)
    expect(html).toContain('>Pending<')
    expect(html).not.toContain('already out')
    expect(html).not.toContain('style="width:')
    expect(count(html, 'aria-pressed="false"')).toBe(4)
  })

  it('under Completed, shows what went out with its time, each tappable to send it back', () => {
    const html = renderToStaticMarkup(<OrderCard {...props} order={bea(OUT)} mode="completed" />)
    for (const out of ['Spanish Latte', 'Americano', 'Cheesy Beef Nachos']) expect(html).toContain(`aria-label="Remove ${out}"`)
    expect(html).not.toContain('aria-label="Remove Classic Fries"')
    expect(count(html, 'Served 7:46 PM')).toBe(3)
    expect(tagLabelled(html, 'Spanish Latte served')).toContain('aria-pressed="true"')
    expect(html).not.toContain('aria-pressed="false"')
  })

  it('under Completed, says what is still to serve on a partly served order, and offers no Complete or Add items', () => {
    const html = renderToStaticMarkup(<OrderCard {...props} order={bea(OUT)} mode="completed" />)
    expect(html).toContain('1 still to serve: Classic Fries')
    expect(html).toContain('In Recent')
    expect(html).toContain('3 of 4 served')
    expect(html).not.toContain('✓ Done')
    expect(html).toContain('style="width:75%"')
    expect(html).not.toContain('Complete</button>')
    expect(html).not.toContain('Add items')
  })

  it('under Completed, a fully served order reads Done, with no strip and no bar', () => {
    const html = renderToStaticMarkup(<OrderCard {...props} order={bea(OUT, '2026-11-24T11:53:00.000Z', { isCompleted: true })} mode="completed" />)
    expect(html).toContain('✓ Done')
    expect(html).toContain('Served 7:53 PM')
    expect(html).not.toContain('still to serve')
    expect(html).not.toContain('style="width:')
  })

  it('shows an order completed before ticking as fully served, with no times', () => {
    const html = renderToStaticMarkup(<OrderCard {...props} order={bea(undefined, undefined, { isCompleted: true })} mode="completed" />)
    expect(html).toContain('✓ Done')
    for (const out of ['Spanish Latte', 'Americano', 'Cheesy Beef Nachos', 'Classic Fries']) expect(html).toContain(`aria-label="Remove ${out}"`)
    expect(html).not.toContain('Served ')
    expect(tagLabelled(html, 'Classic Fries served')).toContain('aria-pressed="true"')
  })

  it('keeps an add-on with its item: no check of its own, and on the same side as the item', () => {
    // Only the mocha carries a time: an add-on goes out with its item.
    const mochaOut: Sale = { ...order, items: order.items.map(item => (item.lineId === 'wcm__ice' ? { ...item, servedAt: OUT } : item)) }
    const recent = renderToStaticMarkup(<OrderCard {...props} order={mochaOut} mode="recent" />)
    expect(recent).toContain('aria-label="Remove Sea Salt Cookie"')
    expect(recent).not.toContain('Espresso Shot')
    const completed = renderToStaticMarkup(<OrderCard {...props} order={mochaOut} mode="completed" />)
    expect(completed.indexOf('aria-label="Remove White Chocolate Mocha"')).toBeLessThan(completed.indexOf('aria-label="Remove Espresso Shot"'))
    expect(completed).not.toContain('aria-label="Remove Sea Salt Cookie"')
    // Nothing out yet: both items get a check, the shot rides with the mocha.
    const pending = renderToStaticMarkup(<OrderCard {...props} mode="recent" />)
    expect(count(pending, 'aria-pressed="false"')).toBe(2)
    expect(pending).not.toContain('aria-label="Espresso Shot served"')
  })

  it('groups what the card shows by when it was ordered: the Added group shows where its lines are', () => {
    const friesAdded: Sale = {
      ...bea(OUT),
      items: bea(OUT).items.map(item => (item.lineId === 'classic-fries__fixed' ? { ...item, addedAt: '2026-11-24T11:52:00.000Z' } : item)),
    }
    const recent = renderToStaticMarkup(<OrderCard {...props} order={friesAdded} mode="recent" />)
    expect(recent).toContain('Added 7:52 PM · 1 item')
    const completed = renderToStaticMarkup(<OrderCard {...props} order={friesAdded} mode="completed" />)
    expect(completed).not.toContain('Added 7:52 PM · ')
    expect(completed).toContain('aria-label="Remove Spanish Latte"')
  })

  it('warns that Delete takes the whole order when part of it is out, on either tab', () => {
    for (const mode of ['recent', 'completed'] as const) {
      expect(renderToStaticMarkup(<OrderCard {...props} order={bea(OUT)} mode={mode} isConfirming />)).toContain('Delete the whole order (4 items)?')
    }
    expect(renderToStaticMarkup(<OrderCard {...props} order={bea()} isConfirming />)).toContain('Delete this order?')
  })
})
