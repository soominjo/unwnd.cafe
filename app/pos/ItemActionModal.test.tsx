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

const render = (mode: 'addons' | 'discount') => renderToStaticMarkup(<ItemActionModal {...base} mode={mode} />)

describe('ItemActionModal', () => {
  it('names the item and shows a large unit price × quantity in both modes', () => {
    for (const mode of ['addons', 'discount'] as const) {
      const html = render(mode)
      expect(html).toContain('White Mocha Americano')
      expect(html).toContain('₱150 × 4')
    }
  })

  it('discount mode shows only the discount — no add-ons, no note, no customize presets', () => {
    const html = render('discount')
    expect(html).not.toContain('Extra Shot')
    expect(html).not.toContain('Espresso Shot')
    expect(html).not.toContain('Less Sweet')
    expect(html).not.toContain('No Sugar')
  })

  it('discount mode presses the active chips and shows each row’s computation over the order totals', () => {
    const html = render('discount')
    expect(html).toMatch(/aria-pressed="true"[^>]*>PWD\/S −20% · SOLO/)
    expect(html).toMatch(/aria-pressed="true"[^>]*>GR −10% · ALL/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>PWD\/S −20% · ALL/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>GR −10% · SOLO/)
    // SOLO: one unit's share of (150 × 4 + 60) = 165 → 20% = 33. ALL: 10% of 660 = 66.
    expect(html).toContain('20% of ₱165')
    expect(html).toContain('−₱33')
    expect(html).toContain('10% of ₱660')
    expect(html).toContain('−₱66')
    // The add-ons are not listed in this mode, so the base says where its extra pesos came from.
    expect(html).toContain('incl. add-ons')
    expect(html).toContain('Subtotal')
    expect(html).toContain('₱950')
    expect(html).toContain('−₱123')
    expect(html).toContain('₱827')
    expect(html).not.toContain('Croissant')
  })

  it('add-ons mode carries both the add-ons and the customize presets, with the note prefilled', () => {
    const html = render('addons')
    expect(html).toContain('+30 Espresso Shot')
    expect(html).toContain('+40 Oat Milk')
    expect(html).toContain('Extra Shot')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Less Sweet/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>No Sugar/)
    expect(html).toContain('value="no whip"')
  })

  it('add-ons mode shows the item total with its add-ons, and no discount information', () => {
    const html = render('addons')
    // 150 × 4 + 30 × 2 = 660
    expect(html).toContain('₱660')
    expect(html).toContain('₱60')
    expect(html).not.toContain('PWD')
    expect(html).not.toContain('GR −10%')
    expect(html).not.toContain('Subtotal')
    expect(html).not.toContain('−₱123')
    expect(html).not.toContain('₱827')
  })

  it('says so when no add-on can attach, and still offers the presets', () => {
    const html = renderToStaticMarkup(<ItemActionModal {...base} mode="addons" addonOptions={[]} />)
    expect(html).toContain('No add-ons available for this item')
    expect(html).toContain('No Sugar')
  })
})
