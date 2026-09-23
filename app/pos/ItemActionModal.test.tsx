import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ItemActionModal from './ItemActionModal'
import { addonLineId } from './utils'
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

// Two of the espresso shots are already on the line; the oat milk is not.
const attachedAddons: OrderItem[] = [
  { lineId: addonLineId('addon__shot', 'l1'), name: 'Espresso Shot', variant: null, price: 30, qty: 2, parentLineId: 'l1' },
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
    expect(html).not.toContain('Espresso Shot')
    expect(html).not.toContain('Oat Milk')
    expect(html).not.toContain('Less Sweet')
    expect(html).not.toContain('No Sugar')
  })

  it('discount mode presses the active chips and shows each row’s computation', () => {
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
  })

  it('discount mode totals this item: menu subtotal, add-ons, its own discount, total', () => {
    const html = render('discount')
    expect(html).toContain('Subtotal')
    expect(html).toContain('>₱600<')
    expect(html).toContain('Add-ons')
    expect(html).toContain('>₱60<')
    // This line's own rows only: 33 + 66. The other line's ₱24 belongs to the order, not here.
    expect(html).toContain('Discount')
    expect(html).toContain('−₱99')
    expect(html).toContain('>₱561<')
    expect(html).not.toContain('Croissant')
  })

  it('add-ons mode carries both the add-ons and the customize presets, with the note prefilled', () => {
    const html = render('addons')
    expect(html).toContain('+30 Espresso Shot')
    expect(html).toContain('+40 Oat Milk')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Less Sweet/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>No Sugar/)
    expect(html).toContain('value="no whip"')
  })

  it('add-ons mode fills the add-ons already on the line and counts them', () => {
    const html = render('addons')
    expect(html).toMatch(/aria-pressed="true"[^>]*><span>\+30 Espresso Shot<\/span><span[^>]*>×2<\/span>/)
    expect(html).toMatch(/aria-pressed="false"[^>]*><span>\+40 Oat Milk<\/span><\/button>/)
  })

  it('add-ons mode totals this item: menu subtotal, add-ons, both together — and no discount', () => {
    const html = render('addons')
    expect(html).toContain('Subtotal')
    expect(html).toContain('>₱600<')
    expect(html).toContain('Add-ons')
    expect(html).toContain('>₱60<')
    expect(html).toContain('Item total')
    expect(html).toContain('>₱660<')
    expect(html).not.toContain('Discount')
    expect(html).not.toContain('PWD')
    expect(html).not.toContain('−₱99')
  })

  it('says so when no add-on can attach, and still offers the presets', () => {
    const html = renderToStaticMarkup(<ItemActionModal {...base} mode="addons" addonOptions={[]} />)
    expect(html).toContain('No add-ons available for this item')
    expect(html).toContain('No Sugar')
  })
})
