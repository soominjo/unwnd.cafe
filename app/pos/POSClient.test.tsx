import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PosMenu } from '@/lib/posMenu'
import POSClient from './POSClient'
import type { OpenOrder } from './addToOrder'

// Next's font loader only exists inside a running Next app (ReceiptPreview uses it at import).
vi.mock('next/font/google', () => ({ IBM_Plex_Mono: () => ({ className: '' }) }))

// The live menu as the server reads it: two tabs, one Sanity item, one built-in hidden.
const live: PosMenu = {
  categories: [
    { id: 'signature', label: 'Signature', type: 'drink', order: 1, isBuiltIn: true },
    { id: 'espresso', label: 'Espresso', type: 'drink', order: 2, isBuiltIn: true },
  ],
  items: [
    {
      _id: 'sanity-ube', name: 'Ube Cream Latte', subtitle: null, category: 'signature', priceHot: null,
      priceIce: 170, priceFixed: null, addonType: null, hiddenFromPos: false, applicableCategories: null,
    },
  ],
  hiddenItemIds: ['cereal-cream-latte'],
  categoryOrder: ['signature', 'espresso'],
}

// What the browser paints before any script runs.
const firstPaint = (initialMenu: PosMenu | null) =>
  renderToStaticMarkup(<POSClient initialMenu={initialMenu} initialCardHolders={[]} />)

describe('POSClient first paint', () => {
  it('already shows the live menu, so nothing swaps in after a reload', () => {
    const html = firstPaint(live)
    expect(html).toContain('Ube Cream Latte')
    expect(html).toContain('White Mocha Americano')
    expect(html).not.toContain('Cereal Cream Latte')
    // Only the live tabs, not the built-in menu's six.
    expect(html).not.toContain('Non-Coffee')
  })

  it('shows the built-in menu when the live one could not be read, and says so', () => {
    const html = firstPaint(null)
    expect(html).toContain('Cereal Cream Latte')
    expect(html).toContain('Non-Coffee')
    // Its prices can be out of date, so the cashier must know it is the fallback.
    expect(html).toContain('Showing the built-in menu')
    expect(firstPaint(live)).not.toContain('Showing the built-in menu')
  })

  it('keeps all menu editing behind the manager PIN, on the live menu and the fallback alike', () => {
    for (const html of [firstPaint(live), firstPaint(null)]) {
      expect(html).not.toContain('title="Edit item"')
      expect(html).not.toContain('title="Delete item"')
      expect(html).not.toContain('Add Item')
      expect(html).not.toContain('title="Manage menu"')
      // Dragging a tab saves a new order for every device, so the tabs only drag in manager mode.
      expect(html).not.toContain('draggable="true"')
    }
  })

  it('offers the Manager unlock only when there is a live menu to edit', () => {
    expect(firstPaint(live)).toContain('>Manager</span>')
    expect(firstPaint(null)).not.toContain('>Manager</span>')
  })

  it('puts Loyalty in the header between Manager and Sales, with or without the live menu', () => {
    const html = firstPaint(live)
    const at = (text: string) => html.indexOf(text)
    expect(at('>Loyalty</span>')).toBeGreaterThan(at('>Manager</span>'))
    expect(at('>Loyalty</span>')).toBeLessThan(at('href="/pos/sales"'))
    expect(firstPaint(null)).toContain('>Loyalty</span>')
  })

  it('links to Sales at every screen width: a sale no longer opens Sales by itself', () => {
    const link = firstPaint(live).match(/<a[^>]*href="\/pos\/sales"[^>]*>/)?.[0]
    expect(link).toBeDefined()
    expect(link).not.toMatch(/class="[^"]*\bhidden\b/)
  })
})

describe('POSClient first paint, adding to a saved order', () => {
  // The order in the owner's screenshot: no name, saved at 2:14 PM for ₱790.
  const saved: OpenOrder = {
    id: 'sale-214', rev: 'rev-9', createdAt: '2026-10-03T06:14:00Z', name: '', total: 790,
    items: [
      { lineId: 'tiramisu__ice', name: 'Tiramisu', variant: 'ice', price: 160, qty: 2 },
      { lineId: 'amber-cream-latte__ice', name: 'Amber Cream Latte', variant: 'ice', price: 150, qty: 1 },
    ],
    discounts: [], loyaltyMemberId: null, loyaltyRewards: [],
  }

  it('shows the order it adds to: a banner, its lines locked above an empty cart, and Review for the whole order', () => {
    const html = renderToStaticMarkup(<POSClient initialMenu={live} initialCardHolders={[]} initialOpenOrder={saved} />)
    expect(html).toContain('Adding to an order with no name · 2:14 PM')
    expect(html).toContain('Already ordered · 2:14 PM')
    // Tiramisu is not on this menu: it can only come from the saved lines.
    expect(html).toContain('Tiramisu')
    expect(html).toContain('Tap a drink to add it to this order.')
    expect(html).toContain('Review · ₱790')
    expect(html).not.toContain('Charge ₱')
  })

  it('keeps the name of an order being added to editable, unless the order is on a loyalty card', () => {
    const field = /<input[^>]*aria-label="Customer name or loyalty card number"[^>]*>/
    const juans = renderToStaticMarkup(<POSClient initialMenu={live} initialCardHolders={[]} initialOpenOrder={{ ...saved, name: 'Juan' }} />)
    expect(juans.match(field)?.[0]).toContain('value="Juan"')
    const kylene = { _id: 'k', name: 'Kylene', cardNumber: 12, joinedAt: '2026-10-02T03:00:00Z', card: { earned: 6, usedTen: 1, usedFree: 0 }, orderCount: 3 }
    const kylenes = renderToStaticMarkup(
      <POSClient initialMenu={live} initialCardHolders={[kylene]} initialOpenOrder={{ ...saved, name: 'Kylene', loyaltyMemberId: 'k', loyaltyRewards: ['ten'] }} />,
    )
    expect(kylenes).not.toMatch(field)
    expect(kylenes).toContain('Card No. 12')
  })

  it('opens a new order when the one asked for can’t take more items, and says why', () => {
    const html = renderToStaticMarkup(<POSClient initialMenu={live} initialCardHolders={[]} openOrderProblem="completed" />)
    expect(html).toContain('That order was completed, so nothing more can be added to it. This is a new order.')
    expect(html).toContain('Charge ₱0')
    expect(firstPaint(live)).not.toContain('This is a new order')
  })
})
