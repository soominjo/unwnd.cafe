import { describe, it, expect } from 'vitest'
import { splitNote, joinNote, CUSTOMIZE_PRESETS } from './CustomizeSection'

describe('splitNote', () => {
  it('separates known presets from the free-text remainder', () => {
    expect(splitNote('Less Sweet, no whip, No Ice')).toEqual({ presets: ['Less Sweet', 'No Ice'], custom: 'no whip' })
  })

  it('handles a missing or blank note', () => {
    expect(splitNote(undefined)).toEqual({ presets: [], custom: '' })
    expect(splitNote('  ')).toEqual({ presets: [], custom: '' })
  })

  it('keeps several free-text parts together', () => {
    expect(splitNote('no whip, extra hot').custom).toBe('no whip, extra hot')
  })
})

describe('joinNote', () => {
  it('writes presets first, then the trimmed free text, comma separated', () => {
    expect(joinNote(['No Sugar', 'Less Ice'], '  oat milk ')).toBe('No Sugar, Less Ice, oat milk')
  })

  it('drops an empty free-text part and survives no presets', () => {
    expect(joinNote(['No Sugar'], '   ')).toBe('No Sugar')
    expect(joinNote([], 'no whip')).toBe('no whip')
    expect(joinNote([], '')).toBe('')
  })

  it('round-trips every preset', () => {
    expect(splitNote(joinNote(CUSTOMIZE_PRESETS, '')).presets).toEqual(CUSTOMIZE_PRESETS)
  })
})
