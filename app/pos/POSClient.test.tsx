import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PosMenu } from '@/lib/posMenu'
import POSClient from './POSClient'
import type { OpenOrder } from './addToOrder'

// Next's font loader only exists inside a running Next app (ReceiptPreview uses it at import).
vi.mock('next/font/google', () => ({ IBM_Plex_Mono: () => ({ className: '' }) }))

// The live menu as the server reads it: two tabs and one item, all saved in Sanity.
const live: PosMenu = {
  categories: [
    { id: 'signature', label: 'Signature', type: 'drink', order: 1, _sanityId: 'menu-category-signature' },
    { id: 'espresso', label: 'Classic', type: 'drink', order: 2, _sanityId: 'menu-category-espresso' },
  ],
  items: [
    {
      _id: 'sanity-ube', name: 'Ube Cream Latte', subtitle: null, category: 'signature', priceHot: null,
      priceIce: 170, priceFixed: null, addonType: null, hiddenFromPos: false, applicableCategories: null,
    },
  ],
  categoryOrder: ['signature', 'espresso'],
}

// What the browser paints before any script runs.
const firstPaint = (initialMenu: PosMenu | null) =>
  renderToStaticMarkup(<POSClient initialMenu={initialMenu} initialCardHolders={[]} />)

describe('POSClient first paint', () => {
  it('already shows the live menu, so nothing swaps in after a reload', () => {
    const html = firstPaint(live)
    expect(html).toContain('Ube Cream Latte')
    // No drink comes from code any more: a saved one renamed (say, with a ⭐) can't bring an old copy back.
    expect(html).not.toContain('White Mocha Americano')
    expect(html).not.toContain('Cereal Cream Latte')
    // Only the saved tabs, under their saved names; none comes from code.
    expect(html).toContain('>Classic</button>')
    expect(html).not.toContain('Non-Coffee')
  })

  it('shows no menu and asks for a reload when the live menu could not be read', () => {
    const html = firstPaint(null)
    expect(html).toContain('Could not load the menu. Reload to try again.')
    expect(html).not.toContain('>Signature</button>')
    expect(html).not.toContain('Showing the built-in menu')
    expect(firstPaint(live)).not.toContain('Could not load')
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

  // The grid scrolls inside a fixed-height area and its cards hide what spills over, so rows
  // left to fit that area were squeezed on a phone (and on a tablet in a long tab): prices cut off.
  it('sizes the menu rows to their cards, so no card is cut short', () => {
    expect(firstPaint(live)).toMatch(/<div class="[^"]*grid-cols-2[^"]*auto-rows-max[^"]*"/)
  })

  // The floating "View Order" pill (below 1024px) sits over the bottom of the grid: the last row's
  // prices were hidden behind it, however far the cashier scrolled.
  it('keeps room under the last row for the View Order pill, below 1024px only', () => {
    const grid = firstPaint(live).match(/<div class="([^"]*grid-cols-2[^"]*)"/)?.[1] ?? ''
    expect(grid.split(' ')).toEqual(expect.arrayContaining(['pb-28', 'lg:pb-5']))
  })

  it('breaks a long item name rather than run it under the edit and delete buttons', () => {
    const html = renderToStaticMarkup(<POSClient initialMenu={live} initialCardHolders={[]} initialMenuEditing />)
    expect(html).toMatch(/<p class="[^"]*wrap-break-word[^"]*">Ube Cream Latte<\/p>/)
  })

  it('keeps the header to one line on a phone: the wordmark and Order never wrap', () => {
    const html = firstPaint(live)
    expect(html).toMatch(/<a class="[^"]*whitespace-nowrap[^"]*" href="\/">unwnd\. pos<\/a>/)
    expect(html).toMatch(/<button class="[^"]*whitespace-nowrap[^"]*">Order<span class="max-sm:hidden"> ›<\/span><\/button>/)
  })

  // The words fit beside the wordmark only once the Order button gives way to the order panel (lg);
  // below that they wrapped ("TIME / CLOCK") on a tablet held upright.
  it('names Time clock, Manager and Loyalty in words from 1024px, as icons below', () => {
    const html = firstPaint(live)
    for (const label of ['Time clock', 'Manager', 'Loyalty']) expect(html).toContain(`<span class="hidden lg:inline">${label}</span>`)
    expect(html).toContain('Sales<span class="hidden lg:inline"> ↗</span>')
  })

  it('leaves room beside an item’s name for the edit and delete buttons while the menu is edited', () => {
    const html = renderToStaticMarkup(<POSClient initialMenu={live} initialCardHolders={[]} initialMenuEditing />)
    // On a phone the two buttons stack, so the name keeps more of a narrow card's width.
    expect(html).toMatch(/<div class="[^"]*pr-18 max-sm:pr-10[^"]*"><p[^>]*>Ube Cream Latte<\/p>/)
    expect(html).toMatch(/<div class="[^"]*max-sm:flex-col[^"]*"><button title="Edit item"/)
    expect(firstPaint(live)).not.toMatch(/<div class="[^"]*pr-18[^"]*"><p[^>]*>Ube Cream Latte<\/p>/)
  })

  it('offers Manager with or without the live menu: its page holds the staff hours too', () => {
    for (const html of [firstPaint(live), firstPaint(null)]) {
      expect(html).toContain('>Manager</span>')
      expect(html).toContain('aria-label="Manager"')
      // Menu editing is turned on from the Manager page, never on first paint.
      expect(html).not.toContain('>Lock</span>')
    }
  })

  it('opens with menu editing still on when the manager left it on, so a reload keeps it until Lock', () => {
    const html = renderToStaticMarkup(<POSClient initialMenu={live} initialCardHolders={[]} initialMenuEditing />)
    expect(html).toContain('>Lock</span>')
    expect(html).not.toContain('>Manager</span>')
    expect(html).toContain('title="Edit item"')
    expect(html).toContain('title="Delete item"')
    expect(html).toContain('title="Manage menu"')
    expect(html).toContain('draggable="true"')
  })

  it('keeps editing off on the fallback even when it was left on: there is nothing saved to edit', () => {
    const html = renderToStaticMarkup(<POSClient initialMenu={null} initialCardHolders={[]} initialMenuEditing />)
    expect(html).toContain('>Manager</span>')
    expect(html).not.toContain('>Lock</span>')
    expect(html).not.toContain('title="Edit item"')
  })

  it('puts Time clock in the header just before Manager, with no count until someone is on shift', () => {
    const html = firstPaint(live)
    expect(html.indexOf('>Time clock</span>')).toBeGreaterThan(-1)
    expect(html.indexOf('>Time clock</span>')).toBeLessThan(html.indexOf('>Manager</span>'))
    expect(html).toContain('aria-label="Time clock"')
    expect(firstPaint(null)).toContain('>Time clock</span>')
  })

  it('puts Loyalty in the header between Manager and Sales, with or without the live menu', () => {
    const html = firstPaint(live)
    const at = (text: string) => html.indexOf(text)
    expect(at('>Loyalty</span>')).toBeGreaterThan(at('>Manager</span>'))
    expect(at('>Loyalty</span>')).toBeLessThan(at('href="/pos/sales"'))
    expect(firstPaint(null)).toContain('>Loyalty</span>')
  })

  it('leaves Dine in or Take out and the payment to the review screen, and says so on the order panel', () => {
    const html = firstPaint(live)
    expect(html).not.toContain('placeholder="Custom amount"')
    expect(html).not.toMatch(/>₱(500|1000|2000)<\/button>/)
    expect(html).not.toContain('Dine in or take out?')
    expect(html).toContain('Dine in or take out, and how they pay, are picked on the next screen.')
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
    orderType: 'dine-in', payments: [{ _key: 'pay-0', method: 'ewallet', amount: 790 }],
  }

  it('shows the order it adds to: a banner, its lines locked above an empty cart, and Review for what is due now', () => {
    const html = renderToStaticMarkup(<POSClient initialMenu={live} initialCardHolders={[]} initialOpenOrder={saved} />)
    expect(html).toContain('Adding to an order with no name · 2:14 PM')
    expect(html).toContain('Already ordered · 2:14 PM')
    // Tiramisu is not on this menu: it can only come from the saved lines.
    expect(html).toContain('Tiramisu')
    expect(html).toContain('Tap a drink to add it to this order.')
    // The saved ₱790 was paid when it was saved: only new lines are due now, and there are none yet.
    expect(html).toContain('Due now')
    expect(html).toContain('Review · ₱0')
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
