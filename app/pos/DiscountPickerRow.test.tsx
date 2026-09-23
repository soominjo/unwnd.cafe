import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import DiscountPickerRow from './DiscountPickerRow'

const noop = () => {}

describe('DiscountPickerRow', () => {
  it('offers ALL and SOLO for both discounts, none pressed when the line has no discount', () => {
    const html = renderToStaticMarkup(<DiscountPickerRow itemName="White Mocha Americano" current={undefined} onPick={noop} />)
    for (const label of ['PWD/S −20% · ALL', 'GR −10% · ALL', 'PWD/S −20% · SOLO', 'GR −10% · SOLO']) {
      expect(html).toContain(label)
    }
    expect(html).toContain('→ White Mocha Americano')
    expect(html).not.toContain('aria-pressed="true"')
  })

  it('presses exactly the chips matching the line, one per kind', () => {
    const html = renderToStaticMarkup(
      <DiscountPickerRow itemName="X" current={{ pwd: 'solo', review: 'all' }} onPick={noop} />
    )
    expect(html).toMatch(/aria-pressed="true"[^>]*>PWD\/S −20% · SOLO/)
    expect(html).toMatch(/aria-pressed="true"[^>]*>GR −10% · ALL/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>PWD\/S −20% · ALL/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>GR −10% · SOLO/)
  })
})
