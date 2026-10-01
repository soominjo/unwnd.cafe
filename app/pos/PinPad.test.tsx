import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import PinPad, { PIN_LENGTH, pinAfterKey } from './PinPad'

describe('pinAfterKey', () => {
  it('adds a digit until the PIN is full, then ignores more', () => {
    expect(pinAfterKey('', '1')).toBe('1')
    expect(pinAfterKey('246', '8')).toBe('2468')
    expect(pinAfterKey('2468', '5')).toBe('2468')
  })

  it('takes the last digit off on ⌫, and leaves an empty PIN empty', () => {
    expect(pinAfterKey('246', '⌫')).toBe('24')
    expect(pinAfterKey('', '⌫')).toBe('')
  })

  it('ignores anything that is not a digit or ⌫', () => {
    expect(pinAfterKey('10', 'a')).toBe('10')
    expect(pinAfterKey('10', '')).toBe('10')
  })
})

describe('PinPad', () => {
  it('shows one empty dot per digit and a pad of ten digits plus delete', () => {
    const html = renderToStaticMarkup(<PinPad onComplete={async () => null} />)
    expect(html.match(/data-pin-dot/g)).toHaveLength(PIN_LENGTH)
    expect(html.match(/<button/g)).toHaveLength(11)
    expect(html).toContain('aria-label="Delete last digit"')
  })
})
