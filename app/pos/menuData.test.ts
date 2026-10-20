import { describe, it, expect } from 'vitest'
import { MENU } from './menuData'

const names = MENU.flatMap((tab) => tab.items.map((item) => item.name))

describe('the built-in menu', () => {
  it('no longer has the items the owner took off on Oct 20, 2026', () => {
    for (const gone of ['Amber Cream Latte', 'Cafe Latte', 'Spanish Latte', 'Mocha Latte', 'White Chocolate Mocha', 'Chocolate Milk', 'Strawberry Milk']) {
      expect(names).not.toContain(gone)
    }
  })

  it('has no drinks at all, so renaming or deleting a saved one never brings an old copy back', () => {
    // The owner starred the saved Cereal Cream Latte ("Cereal Cream Latte⭐") and the code copy
    // reappeared beside it, as the POS only hid a code item behind a saved one of the same name.
    expect(names).toEqual([])
  })

  it('keeps the Classic (espresso) and Non-Coffee tabs, empty until items are added on the POS', () => {
    const tab = (id: string) => MENU.find((t) => t.id === id)
    expect(tab('espresso')).toMatchObject({ label: 'Classic', items: [] })
    expect(tab('non-coffee')).toMatchObject({ label: 'Non-Coffee', items: [] })
  })
})
