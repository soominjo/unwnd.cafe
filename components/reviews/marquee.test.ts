import { describe, it, expect } from 'vitest'
import { fillLoop, splitIntoRows } from './marquee'

describe('splitIntoRows', () => {
  it('keeps fewer than eight reviews in one row, in order', () => {
    expect(splitIntoRows(['a', 'b', 'c', 'd', 'e', 'f', 'g'])).toEqual([['a', 'b', 'c', 'd', 'e', 'f', 'g']])
  })

  it('deals eight or more into two rows, alternately, so each row mixes newer and older reviews', () => {
    expect(splitIntoRows(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])).toEqual([
      ['a', 'c', 'e', 'g'],
      ['b', 'd', 'f', 'h'],
    ])
    expect(splitIntoRows(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'])).toEqual([
      ['a', 'c', 'e', 'g', 'i'],
      ['b', 'd', 'f', 'h'],
    ])
  })

  it('makes no rows without reviews', () => {
    expect(splitIntoRows([])).toEqual([])
  })
})

describe('fillLoop', () => {
  it('repeats a short row until one loop holds at least eight cards, wider than a wide screen', () => {
    expect(fillLoop(['a', 'b', 'c'])).toEqual([
      { item: 'a', copy: 0 }, { item: 'b', copy: 0 }, { item: 'c', copy: 0 },
      { item: 'a', copy: 1 }, { item: 'b', copy: 1 }, { item: 'c', copy: 1 },
      { item: 'a', copy: 2 }, { item: 'b', copy: 2 }, { item: 'c', copy: 2 },
    ])
    expect(fillLoop(['a', 'b', 'c', 'd'])).toHaveLength(8)
  })

  it('leaves a row of eight or more as it is', () => {
    expect(fillLoop(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'])).toEqual([
      { item: 'a', copy: 0 }, { item: 'b', copy: 0 }, { item: 'c', copy: 0 }, { item: 'd', copy: 0 },
      { item: 'e', copy: 0 }, { item: 'f', copy: 0 }, { item: 'g', copy: 0 }, { item: 'h', copy: 0 },
      { item: 'i', copy: 0 }, { item: 'j', copy: 0 },
    ])
  })

  it('gives an empty row no cards', () => {
    expect(fillLoop([])).toEqual([])
  })
})
