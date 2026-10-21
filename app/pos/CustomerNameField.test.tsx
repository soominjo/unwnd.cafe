import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CustomerNameField, { type CustomerNameFieldProps, type LoyaltyTenControls } from './CustomerNameField'
import LoyaltyBar from './LoyaltyBar'
import { loyaltyCopy, type CardHolderWithCard } from '@/lib/loyalty'
import type { OrderItem } from './types'

const holder = (id: string, name: string, cardNumber: number, earned: number, usedTen = 0, usedFree = 0): CardHolderWithCard => ({
  _id: id, name, cardNumber, joinedAt: '2026-10-02T00:00:00Z', card: { earned, usedTen, usedFree }, orderCount: 1,
})
const kylene = holder('k', 'Kylene', 12, 5)
const holders = [kylene, holder('k2', 'Kylene', 4, 0), holder('b', 'Ben', 3, 3)]
const noop = () => {}
// The tabs as the menu names them, Espresso shown as Classic.
const LABELS: Record<string, string> = {
  signature: 'Signature', 'matcha-series': 'Matcha Series', meal: 'Meal',
  espresso: 'Classic', 'non-coffee': 'Non-Coffee', waffle: 'Waffle', snack: 'Snack',
}
const copy = loyaltyCopy((id) => LABELS[id])
const latte: OrderItem = { lineId: 'cafe-latte__hot', name: 'Cafe Latte', variant: 'hot', price: 110, qty: 1, categoryId: 'espresso' }
const chocolate: OrderItem = { lineId: 'chocolate__ice', name: 'Chocolate', variant: 'ice', price: 120, qty: 1, categoryId: 'non-coffee' }
const ten = (over: Partial<LoyaltyTenControls> = {}): LoyaltyTenControls => ({
  lines: [], lineId: null, choosing: false, onStart: noop, onPick: noop, onCancel: noop, onClear: noop, ...over,
})

const field = (over: Partial<CustomerNameFieldProps>) => renderToStaticMarkup(
  <CustomerNameField
    value="" disabled={false} onChange={noop} holders={holders} linked={null} onLink={noop} onUnlink={noop}
    orderStamps={0} ten={ten()} hasFreeDrinkLine={false} freeActive={false} copy={copy} {...over}
  />,
)

describe('LoyaltyBar', () => {
  it('draws 11 steps with 10% marked at 6 and FREE at 11, and counts stamps that spill over', () => {
    const html = renderToStaticMarkup(<LoyaltyBar saved={9} pending={4} />)
    expect(html.match(/data-step=/g)).toHaveLength(11)
    expect(html.match(/data-step="saved"/g)).toHaveLength(9)
    expect(html.match(/data-step="new"/g)).toHaveLength(2)
    expect(html).toContain('>10%<')
    expect(html).toContain('>FREE<')
    expect(html).toContain('plus 2 on a new card')
  })

  it('fills half a step for a half stamp, and says the halves aloud', () => {
    // 5½ saved, then this order's 1: the 6th step is half saved and half new, the 7th half new.
    const html = renderToStaticMarkup(<LoyaltyBar saved={5.5} pending={1} />)
    expect(html).toContain('data-step="saved-new"')
    expect(html).toContain('data-step="new-empty"')
    expect(html.match(/data-step="saved"/g)).toHaveLength(5)
    expect(html).toContain('aria-label="5½ of 11 stamps, plus 1 from this order"')
    expect(renderToStaticMarkup(<LoyaltyBar saved={10} pending={1.5} />)).toContain('plus ½ on a new card')
  })
})

describe('CustomerNameField', () => {
  it('suggests card holders as the name is typed, by name or card number', () => {
    expect(field({ value: 'kyl' })).toContain('Kylene · No. 4')
    expect(field({ value: 'kyl' })).toContain('Kylene · No. 12')
    const byNumber = field({ value: '#12' })
    expect(byNumber).toContain('Kylene · No. 12')
    expect(byNumber).not.toContain('No. 4')
  })

  it('marks an exact name, whatever the capitals, as the one to tap', () => {
    expect(field({ value: 'BEN' })).toContain('tap to add stamps')
  })

  it('asks "did you mean" for a near-miss spelling', () => {
    expect(field({ value: 'Bem' })).toContain('Did you mean')
  })

  it('shows the stamp bar only once a card holder is linked', () => {
    expect(field({ value: 'Kylene' })).not.toContain('data-step=')
    const linked = field({ value: 'Kylene', linked: kylene, orderStamps: 2 })
    expect(linked).toContain('data-step=')
    expect(linked).toContain('+2 stamps this order')
    expect(linked).toContain('Not Kylene? Unlink')
  })

  it('offers 10% off as soon as this order reaches stamp 6', () => {
    expect(field({ value: 'Kylene', linked: kylene, orderStamps: 0 })).not.toContain('Use 10% off')
    expect(field({ value: 'Kylene', linked: kylene, orderStamps: 1 })).toContain('Use 10% off')
  })

  it('after “Use 10% off”, shows the order’s items it can go on, to pick one', () => {
    const html = field({ value: 'Kylene', linked: kylene, orderStamps: 1, ten: ten({ choosing: true, lines: [latte, chocolate] }) })
    expect(html).toContain('10% off which item?')
    expect(html).toContain('>Cafe Latte · Hot<')
    expect(html).toContain('>Chocolate · Iced<')
    expect(html).not.toContain('Use 10% off')
  })

  it('asks the customer to add an item the 10% can go on when the order has none', () => {
    const html = field({ value: 'Kylene', linked: kylene, orderStamps: 1, ten: ten({ choosing: true }) })
    expect(html).toContain('The 10% off is for one Classic, Non-Coffee, Waffle or Snack item. Ask the customer to add one to use it.')
  })

  it('writes half stamps as ½: on a suggestion, on the card and for this order', () => {
    expect(field({ value: 'Han', holders: [holder('h', 'Hana', 7, 6.5)] })).toContain('Hana · No. 7 · 6½ stamps')
    const html = field({ value: 'Kylene', linked: kylene, orderStamps: 1.5 })
    expect(html).toContain('+1½ stamps this order')
    expect(html).toContain('6½/11')
    expect(html).toContain('4½ more for a free drink')
  })

  it('shows which drink has the 10% off', () => {
    const html = field({ value: 'Kylene', linked: kylene, orderStamps: 1, ten: ten({ lines: [latte, chocolate], lineId: latte.lineId }) })
    expect(html).toContain('✓ 10% off · Cafe Latte · Hot')
    expect(html).not.toContain('Chocolate')
  })

  it('says how to use a ready free drink', () => {
    const full = holder('f', 'Ana', 9, 11, 1)
    expect(field({ value: 'Ana', linked: full })).toContain('add a Classic or Non-Coffee drink')
    expect(field({ value: 'Ana', linked: full, hasFreeDrinkLine: true })).toContain('tap “Make free”')
  })

  it('stays a plain name field when the card holders could not be loaded, and says so', () => {
    const html = field({ value: 'Kylene', holders: null })
    expect(html).not.toContain('Kylene · No.')
    expect(html).toContain('Loyalty cards could not load')
  })

  it('waits for two letters before suggesting names, but finds a card number at once', () => {
    expect(field({ value: 'k' })).not.toContain('Kylene · No.')
    expect(field({ value: '3' })).toContain('Ben · No. 3')
  })

  it('shows four suggestions and says how many more match', () => {
    const many = Array.from({ length: 6 }, (_, i) => holder(`m${i}`, `Mae ${i + 1}`, 20 + i, 0))
    const html = field({ value: 'mae', holders: many })
    expect(html.match(/Mae \d · No\./g)).toHaveLength(4)
    expect(html).toContain('+2 more')
  })

  it('says no stamps come from this order, not that the card has none, and what earns them now', () => {
    expect(field({ value: 'Kylene', linked: kylene, orderStamps: 0 })).toContain(
      'No stamps from this order yet: Signature, Matcha Series and Meal items earn 1, Classic, Non-Coffee, Waffle and Snack items ½.',
    )
  })

  it('shows a saved order’s name fixed while items are added to it: no typing, no unlink', () => {
    const html = field({ value: 'Kylene', linked: kylene, orderStamps: 1, locked: true })
    expect(html).not.toContain('<input')
    expect(html).toContain('Kylene')
    expect(html).not.toContain('Unlink')
    expect(html).toContain('+1 stamp this order')
    const plain = field({ value: 'Juan', holders: [], locked: true })
    expect(plain).not.toContain('<input')
    expect(plain).toContain('Juan')
  })

  it('keeps a reward the order used already for the next order, and says so', () => {
    // Ana's card is full: a 10% and a free drink ready.
    const ana = holder('a', 'Ana', 9, 11)
    const tenUsed = field({ value: 'Ana', linked: ana, locked: true, blocked: ['ten'] })
    expect(tenUsed).not.toContain('Use 10% off')
    expect(tenUsed).toContain('10% off is ready for their next order: this order has its 10% already.')
    expect(tenUsed).toContain('Free drink ready')
    const freeUsed = field({ value: 'Ana', linked: ana, locked: true, blocked: ['free'], hasFreeDrinkLine: true })
    expect(freeUsed).toContain('Use 10% off')
    expect(freeUsed).not.toContain('tap “Make free”')
    expect(freeUsed).toContain('A free drink is ready for their next order: this order used one already.')
  })
})
