import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CustomerNameField, { type CustomerNameFieldProps, type LoyaltyTenControls } from './CustomerNameField'
import LoyaltyBar from './LoyaltyBar'
import type { CardHolderWithCard } from '@/lib/loyalty'
import type { OrderItem } from './types'

const holder = (id: string, name: string, cardNumber: number, earned: number, usedTen = 0, usedFree = 0): CardHolderWithCard => ({
  _id: id, name, cardNumber, joinedAt: '2026-10-02T00:00:00Z', card: { earned, usedTen, usedFree }, orderCount: 1,
})
const kylene = holder('k', 'Kylene', 12, 5)
const holders = [kylene, holder('k2', 'Kylene', 4, 0), holder('b', 'Ben', 3, 3)]
const noop = () => {}
const latte: OrderItem = { lineId: 'cafe-latte__hot', name: 'Cafe Latte', variant: 'hot', price: 110, qty: 1, categoryId: 'espresso' }
const chocolate: OrderItem = { lineId: 'chocolate__ice', name: 'Chocolate', variant: 'ice', price: 120, qty: 1, categoryId: 'non-coffee' }
const ten = (over: Partial<LoyaltyTenControls> = {}): LoyaltyTenControls => ({
  lines: [], lineId: null, choosing: false, onStart: noop, onPick: noop, onCancel: noop, onClear: noop, ...over,
})

const field = (over: Partial<CustomerNameFieldProps>) => renderToStaticMarkup(
  <CustomerNameField
    value="" disabled={false} onChange={noop} holders={holders} linked={null} onLink={noop} onUnlink={noop}
    orderStamps={0} ten={ten()} hasFreeDrinkLine={false} freeActive={false} {...over}
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

  it('after “Use 10% off”, shows the order’s classic drinks to pick one', () => {
    const html = field({ value: 'Kylene', linked: kylene, orderStamps: 1, ten: ten({ choosing: true, lines: [latte, chocolate] }) })
    expect(html).toContain('10% off which drink?')
    expect(html).toContain('>Cafe Latte · Hot<')
    expect(html).toContain('>Chocolate · Iced<')
    expect(html).not.toContain('Use 10% off')
  })

  it('asks the customer to add a classic drink when the order has none', () => {
    const html = field({ value: 'Kylene', linked: kylene, orderStamps: 1, ten: ten({ choosing: true }) })
    expect(html).toContain('The 10% off is for one Espresso or Non-Coffee drink. Ask the customer to add one to use it.')
  })

  it('shows which drink has the 10% off', () => {
    const html = field({ value: 'Kylene', linked: kylene, orderStamps: 1, ten: ten({ lines: [latte, chocolate], lineId: latte.lineId }) })
    expect(html).toContain('✓ 10% off · Cafe Latte · Hot')
    expect(html).not.toContain('Chocolate')
  })

  it('says how to use a ready free drink', () => {
    const full = holder('f', 'Ana', 9, 11, 1)
    expect(field({ value: 'Ana', linked: full })).toContain('add an Espresso or Non-Coffee drink')
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

  it('says no stamps come from this order, not that the card has none', () => {
    expect(field({ value: 'Kylene', linked: kylene, orderStamps: 0 })).toContain('No stamps from this order yet')
  })
})
