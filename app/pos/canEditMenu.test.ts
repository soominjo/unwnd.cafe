import { describe, it, expect } from 'vitest'
import type { PosMenu } from '@/lib/posMenu'
import { canEditMenu } from './canEditMenu'

const live: PosMenu = { categories: [], items: [], categoryOrder: [] }

describe('canEditMenu', () => {
  it('allows menu edits only in manager mode, and only on the live menu', () => {
    expect(canEditMenu(true, live)).toBe(true)
    expect(canEditMenu(false, live)).toBe(false)
    // With no live menu there is nothing saved to edit.
    expect(canEditMenu(true, null)).toBe(false)
    expect(canEditMenu(false, null)).toBe(false)
  })
})
