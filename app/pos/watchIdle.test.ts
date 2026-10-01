import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { watchIdle } from './watchIdle'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('watchIdle', () => {
  it('calls onIdle once the time passes with nothing happening', () => {
    const onIdle = vi.fn()
    watchIdle(new EventTarget(), 1000, onIdle)
    vi.advanceTimersByTime(999)
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('starts the wait over on every tap or key press', () => {
    const target = new EventTarget()
    const onIdle = vi.fn()
    watchIdle(target, 1000, onIdle)
    vi.advanceTimersByTime(800)
    target.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(800)
    target.dispatchEvent(new Event('keydown'))
    vi.advanceTimersByTime(999)
    expect(onIdle).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('stops watching once cleaned up', () => {
    const target = new EventTarget()
    const onIdle = vi.fn()
    const stop = watchIdle(target, 1000, onIdle)
    stop()
    target.dispatchEvent(new Event('pointerdown'))
    vi.advanceTimersByTime(5000)
    expect(onIdle).not.toHaveBeenCalled()
  })
})
