import { describe, it, expect } from 'vitest'

import { ADVANCE_EVERY_MS, LOOP_COPIES, SLIDE_MS, loopStrip, settle } from './carousel'

describe('the highlights strip', () => {
  it('moves on every 2.5 seconds, gliding slowly for most of that', () => {
    expect(ADVANCE_EVERY_MS).toBe(2500)
    expect(SLIDE_MS).toBeGreaterThanOrEqual(1000)
    expect(SLIDE_MS).toBeLessThan(ADVANCE_EVERY_MS)
  })

  it('follows the photos with copies of the first three, enough to fill three across while it loops', () => {
    expect(LOOP_COPIES).toBe(3)
    expect(loopStrip(['a', 'b', 'c', 'd'])).toEqual([
      { item: 'a', copy: false },
      { item: 'b', copy: false },
      { item: 'c', copy: false },
      { item: 'd', copy: false },
      { item: 'a', copy: true },
      { item: 'b', copy: true },
      { item: 'c', copy: true },
    ])
  })

  it('repeats the photos round when there are fewer than three', () => {
    expect(loopStrip(['a', 'b']).map((slot) => slot.item)).toEqual(['a', 'b', 'a', 'b', 'a'])
    expect(loopStrip([])).toEqual([])
  })

  it('brings a move that lands on the copies back to the same view among the real photos', () => {
    expect(settle(7, 7)).toBe(0)
    expect(settle(8, 7)).toBe(1)
    expect(settle(6, 7)).toBe(6)
    expect(settle(0, 7)).toBe(0)
  })
})
