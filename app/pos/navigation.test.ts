import { describe, it, expect, vi } from 'vitest'
import { LEAVE_ADDING_MESSAGE, LEAVE_ORDER_MESSAGE, leaveWarning, openPosPage } from './navigation'

describe('leaveWarning', () => {
  it('lets an empty cart go without asking', () => {
    expect(leaveWarning({ items: 0, kept: false, adding: false })).toBeNull()
    expect(leaveWarning({ items: 0, kept: false, adding: true })).toBeNull()
  })

  it('lets a new order kept on the tablet go without asking: it is back on /pos', () => {
    expect(leaveWarning({ items: 2, kept: true, adding: false })).toBeNull()
  })

  it('asks before leaving items being added, kept or not: /pos doesn’t show them, only Add items on their order', () => {
    expect(leaveWarning({ items: 1, kept: true, adding: true })).toBe(LEAVE_ADDING_MESSAGE)
    expect(LEAVE_ADDING_MESSAGE).toContain('Add items')
    expect(leaveWarning({ items: 1, kept: false, adding: true })).toBe(LEAVE_ORDER_MESSAGE)
  })

  it('warns the order will be cleared when the tablet couldn’t keep it', () => {
    expect(leaveWarning({ items: 2, kept: false, adding: false })).toBe(LEAVE_ORDER_MESSAGE)
  })
})

describe('openPosPage', () => {
  it('goes straight there with nothing to warn about', () => {
    const ask = vi.fn(() => true)
    const go = vi.fn()
    expect(openPosPage('/pos/timeclock', null, ask, go)).toBe(true)
    expect(ask).not.toHaveBeenCalled()
    expect(go).toHaveBeenCalledWith('/pos/timeclock')
  })

  it('asks with the warning first, and stays when told to', () => {
    const go = vi.fn()
    expect(openPosPage('/pos/manager', LEAVE_ADDING_MESSAGE, () => false, go)).toBe(false)
    expect(go).not.toHaveBeenCalled()
    const ask = vi.fn(() => true)
    expect(openPosPage('/pos/manager', LEAVE_ADDING_MESSAGE, ask, go)).toBe(true)
    expect(ask).toHaveBeenCalledWith(LEAVE_ADDING_MESSAGE)
    expect(go).toHaveBeenCalledWith('/pos/manager')
  })
})
