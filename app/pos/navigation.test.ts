import { describe, it, expect, vi } from 'vitest'
import { LEAVE_ORDER_MESSAGE, openPosPage } from './navigation'

describe('openPosPage', () => {
  it('goes straight there when no order is on screen', () => {
    const ask = vi.fn(() => true)
    const go = vi.fn()
    expect(openPosPage('/pos/timeclock', 0, ask, go)).toBe(true)
    expect(ask).not.toHaveBeenCalled()
    expect(go).toHaveBeenCalledWith('/pos/timeclock')
  })

  it('asks first when the order on screen would be lost, and stays when told to', () => {
    const go = vi.fn()
    expect(openPosPage('/pos/manager', 2, () => false, go)).toBe(false)
    expect(go).not.toHaveBeenCalled()
    const ask = vi.fn(() => true)
    expect(openPosPage('/pos/manager', 2, ask, go)).toBe(true)
    expect(ask).toHaveBeenCalledWith(LEAVE_ORDER_MESSAGE)
    expect(go).toHaveBeenCalledWith('/pos/manager')
  })
})
