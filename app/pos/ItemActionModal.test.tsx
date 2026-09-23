import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ItemActionModal from './ItemActionModal'
import type { Addon, DiscountLine, OrderItem } from './types'

const noop = () => {}

const item: OrderItem = {
  lineId: 'l1',
  name: 'White Mocha Americano',
  variant: 'ice',
  price: 150,
  qty: 4,
  discounts: { pwd: 'solo', review: 'all' },
  note: 'Less Sweet, no whip',
  categoryId: 'signature',
}

const attachedAddons: OrderItem[] = [
  { lineId: 'addon__l1-shot', name: 'Extra Shot', variant: null, price: 30, qty: 2, parentLineId: 'l1' },
]

const discountLines: DiscountLine[] = [
  { lineId: 'l1', name: 'White Mocha Americano', amount: 33, kind: 'pwd', scope: 'solo', label: 'PWD Drink −20% ×1' },
  { lineId: 'l1', name: 'White Mocha Americano', amount: 66, kind: 'review', scope: 'all', label: 'Google Review −10% ×4' },
  { lineId: 'l2', name: 'Croissant', amount: 24, kind: 'pwd', scope: 'all', label: 'PWD Food −20%' },
]

const addonOptions: Addon[] = [
  { id: 'addon__shot', name: 'Espresso Shot', label: '+30 Espresso Shot', price: 30, type: 'drink' },
  { id: 'addon__oat', name: 'Oat Milk', label: '+40 Oat Milk', price: 40, type: 'drink' },
]

const base = {
  item,
  attachedAddons,
  addonOptions,
  discountLines,
  subtotal: 950,
  grandTotal: 827,
  onPickDiscount: noop,
  onSaveNote: noop,
  onAddAddon: noop,
  onClose: noop,
}

const render = (mode: 'customize' | 'addons' | 'discount') =>
  renderToStaticMarkup(<ItemActionModal {...base} mode={mode} />)

describe('ItemActionModal', () => {
  it('shows the item, its unit price × quantity, its add-ons and the order totals in every mode', () => {
    for (const mode of ['customize', 'addons', 'discount'] as const) {
      const html = render(mode)
      expect(html).toContain('White Mocha Americano')
      expect(html).toContain('₱150 × 4')
      expect(html).toContain('Extra Shot')
      expect(html).toContain('₱950')
      expect(html).toContain('₱827')
      expect(html).toContain('−₱123')
    }
  })

  it('keeps the header lean: no discount badges, no line total, no explanation lines', () => {
    const html = render('discount')
    expect(html).not.toContain('PWD/Senior −20% ×1')
    expect(html).not.toContain('Google Review −10% ×4</span>')
    expect(html).not.toContain('₱600')
    expect(html).not.toContain('ALL = every unit')
    expect(render('customize')).not.toContain('Tap a preset')
    expect(render('addons')).not.toContain('Tap an add-on')
  })

  it('discount mode offers the four chips with the active ones pressed and shows each row’s computation', () => {
    const html = render('discount')
    expect(html).toMatch(/aria-pressed="true"[^>]*>PWD\/S −20% · SOLO/)
    expect(html).toMatch(/aria-pressed="true"[^>]*>GR −10% · ALL/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>PWD\/S −20% · ALL/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>GR −10% · SOLO/)
    // SOLO: one unit’s share of (150 × 4 + 60) = 165 → 20% = 33. ALL: 10% of 660 = 66.
    expect(html).toContain('PWD Drink −20% ×1')
    expect(html).toContain('20% of ₱165')
    expect(html).toContain('−₱33')
    expect(html).toContain('Google Review −10% ×4')
    expect(html).toContain('10% of ₱660')
    expect(html).toContain('−₱66')
    expect(html).not.toContain('Croissant')
  })

  it('customize mode marks the presets already on the note and prefills the free-text part', () => {
    const html = render('customize')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Less Sweet/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>No Sugar/)
    expect(html).toContain('value="no whip"')
    expect(html).not.toContain('PWD/S −20%')
  })

  it('add-ons mode lists the add-ons that can attach to this item', () => {
    const html = render('addons')
    expect(html).toContain('+30 Espresso Shot')
    expect(html).toContain('+40 Oat Milk')
    // The Customize presets are not offered here (the header still shows the item's own note).
    expect(html).not.toContain('No Sugar')
  })

  it('add-ons mode says so when nothing can attach', () => {
    const html = renderToStaticMarkup(<ItemActionModal {...base} mode="addons" addonOptions={[]} />)
    expect(html).toContain('No add-ons available for this item')
  })
})
