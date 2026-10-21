import { describe, it, expect } from 'vitest'
import type { PosMenu } from '@/lib/posMenu'
import { SAVED_MENU_KEY, readSavedMenu, saveMenu } from './savedMenu'

function memory() {
  const items = new Map<string, string>()
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) }
}
const menu: PosMenu = {
  categories: [{ id: 'espresso', label: 'Classic', type: 'drink', order: 2, _sanityId: 'menu-category-espresso' }],
  items: [{ _id: 'a', name: 'Americano', subtitle: null, category: 'espresso', priceHot: 120, priceIce: 130, priceFixed: null, addonType: null, hiddenFromPos: false, applicableCategories: null }],
  categoryOrder: ['espresso'],
}

describe('the last menu this tablet loaded', () => {
  it('is kept, to show when the next load fails', () => {
    const storage = memory()
    saveMenu(menu, storage)
    expect(readSavedMenu(storage)).toEqual(menu)
  })

  it('is ignored when missing, corrupt, half-written or of another shape', () => {
    const storage = memory()
    expect(readSavedMenu(storage)).toBeNull()
    for (const text of ['{not json', JSON.stringify({ categories: 'x' }), JSON.stringify({ categories: [], items: [] }), 'null']) {
      storage.setItem(SAVED_MENU_KEY, text)
      expect(readSavedMenu(storage)).toBeNull()
    }
  })

  it('never breaks the POS when storage is refused', () => {
    const refusing = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(() => saveMenu(menu, refusing)).not.toThrow()
    expect(readSavedMenu(refusing)).toBeNull()
  })
})
