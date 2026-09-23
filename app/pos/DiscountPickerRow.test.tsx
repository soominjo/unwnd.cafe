import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import DiscountPickerRow from './DiscountPickerRow'

describe('DiscountPickerRow', () => {
  it('offers both discounts for the named item, none pressed when the line has no discount', () => {
    const html = renderToStaticMarkup(<DiscountPickerRow itemName="Spanish Latte" current={undefined} onPick={() => {}} />)
    expect(html).toContain('PWD/Senior −20%')
    expect(html).toContain('Google Review −10%')
    expect(html).toContain('→ Spanish Latte')
    expect(html).not.toContain('aria-pressed="true"')
  })

  it('marks the discount the line already carries as pressed', () => {
    const html = renderToStaticMarkup(<DiscountPickerRow itemName="Spanish Latte" current="review" onPick={() => {}} />)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Google Review −10%/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>PWD\/Senior −20%/)
  })
})
