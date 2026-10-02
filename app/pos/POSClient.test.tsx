import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PosMenu } from '@/lib/posMenu'
import POSClient from './POSClient'

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
const firstPaint = (initialMenu: PosMenu | null) => renderToStaticMarkup(<POSClient initialMenu={initialMenu} />)

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
})
