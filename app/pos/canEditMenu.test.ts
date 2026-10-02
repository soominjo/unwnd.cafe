import { describe, it, expect } from 'vitest'
import type { PosMenu } from '@/lib/posMenu'
import { canEditMenu } from './canEditMenu'

const live: PosMenu = { categories: [], items: [], hiddenItemIds: [], categoryOrder: [] }

describe('canEditMenu', () => {
  it('allows menu edits only in manager mode, and only on the live menu', () => {
    expect(canEditMenu(true, live)).toBe(true)
    expect(canEditMenu(false, live)).toBe(false)
    // The built-in fallback: no saved items to change, and a new tab would replace all the others.
    expect(canEditMenu(true, null)).toBe(false)
    expect(canEditMenu(false, null)).toBe(false)
  })
})
