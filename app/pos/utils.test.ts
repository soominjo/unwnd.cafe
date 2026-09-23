import { describe, it, expect } from 'vitest'
import { addonLineId, isAddonLine } from './utils'

describe('addonLineId', () => {
  it('suffixes the add-on id with the line it attaches to', () => {
    expect(addonLineId('addon__shot', 'latte__ice')).toBe('addon__shot__latte__ice')
  })

  it('leaves a standalone add-on on its own id when there is no parent', () => {
    expect(addonLineId('addon__shot', null)).toBe('addon__shot')
  })

  it('always produces something isAddonLine recognises', () => {
    expect(isAddonLine({ lineId: addonLineId('addon__shot', 'latte__ice') })).toBe(true)
    expect(isAddonLine({ lineId: addonLineId('addon__shot', null) })).toBe(true)
  })
})
