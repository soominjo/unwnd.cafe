import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import DiscountSection from './DiscountSection'
import type { DiscountLine, OrderItem } from './types'

const latte: OrderItem = { lineId: 'latte', name: 'Spanish Latte', variant: 'hot', price: 130, qty: 2, categoryId: 'espresso', discounts: { pwd: 'all' } }
const noop = () => {}

describe('DiscountSection', () => {
  it('offers SOLO only: PWD/Senior or Google Review on one unit of the line, never ALL', () => {
    const html = renderToStaticMarkup(
      <DiscountSection item={latte} addonsTotal={0} lineRows={[]} onPick={noop} reviewLocked={false} freeUnits={0} />,
    )
    expect(html).toContain('PWD/S −20% · SOLO')
    expect(html).toContain('GR −10% · SOLO')
    expect(html).not.toContain('· ALL')
  })

  it('locks the Google Review chip while the loyalty 10% is on the order, and says why', () => {
    const html = renderToStaticMarkup(
      <DiscountSection item={latte} addonsTotal={0} lineRows={[]} onPick={noop} reviewLocked freeUnits={0} />,
    )
    expect(html.match(/disabled=""/g)).toHaveLength(1)
    expect(html).toContain('The loyalty 10% is on this order')
  })

  it('shows the free drink as one unit off and works PWD out on the unit still paid', () => {
    const rows: DiscountLine[] = [
      { lineId: 'latte', name: 'Spanish Latte', amount: 130, kind: 'free', scope: 'solo', label: 'Loyalty free drink' },
      { lineId: 'latte', name: 'Spanish Latte', amount: 26, kind: 'pwd', scope: 'all', label: 'PWD Drink −20% ×1' },
    ]
    const html = renderToStaticMarkup(
      <DiscountSection item={latte} addonsTotal={0} lineRows={rows} onPick={noop} reviewLocked={false} freeUnits={1} />,
    )
    expect(html).toContain('Loyalty free drink<span class="text-foreground/45 font-normal"> · one Spanish Latte</span>')
    expect(html).toContain('20% of ₱130')
    expect(html).not.toContain('disabled=""')
  })
})
