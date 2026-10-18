import { describe, it, expect } from 'vitest'
import { HANDOFF_MS, handOffMenuEditing, takeMenuEditing } from './menuHandoff'

// A stand-in for sessionStorage.
function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    size: () => items.size,
  }
}

describe('the menu editing hand-over', () => {
  it('turns editing on for the next POS load only', () => {
    const storage = memoryStorage()
    handOffMenuEditing(storage, 1000)
    expect(takeMenuEditing(storage, 1500)).toBe(true)
    expect(takeMenuEditing(storage, 1600)).toBe(false)
    expect(storage.size()).toBe(0)
  })

  it('lapses when the POS loads too late, and is used up anyway', () => {
    const storage = memoryStorage()
    handOffMenuEditing(storage, 1000)
    expect(takeMenuEditing(storage, 1000 + HANDOFF_MS)).toBe(false)
    expect(storage.size()).toBe(0)
  })

  it('keeps the POS locked when nothing was handed over, or storage is refused', () => {
    expect(takeMenuEditing(memoryStorage(), 1000)).toBe(false)
    const refusing = { getItem: () => { throw new Error('denied') }, removeItem: () => {}, setItem: () => { throw new Error('denied') } }
    expect(() => handOffMenuEditing(refusing, 1000)).not.toThrow()
    expect(takeMenuEditing(refusing, 1000)).toBe(false)
  })
})
