import { describe, it, expect, afterEach, vi } from 'vitest'
import { isPosPin } from './posPin'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isPosPin', () => {
  it('accepts only the POS PIN', () => {
    vi.stubEnv('POS_PIN', '2468')
    expect(isPosPin('2468')).toBe(true)
    expect(isPosPin('2469')).toBe(false)
    expect(isPosPin('24680')).toBe(false)
  })

  it('refuses anything that is not 4 to 8 digits, and everything when POS_PIN is not set', () => {
    vi.stubEnv('POS_PIN', '2468')
    expect(isPosPin(2468)).toBe(false)
    expect(isPosPin('24a8')).toBe(false)
    vi.stubEnv('POS_PIN', '')
    expect(isPosPin('2468')).toBe(false)
  })
})
