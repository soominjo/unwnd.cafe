import { describe, it, expect } from 'vitest'
import { deletePrompt, deleteTabUrl, withoutTab, type MenuState } from './categoryEdits'

describe('deleting a tab', () => {
  it('asks first, with the item count and what the tab gives on loyalty cards', () => {
    expect(deletePrompt({ id: 'espresso', label: 'Classic' }, 3)).toEqual({
      question: 'Delete Classic and its 3 items? This can’t be undone.',
      loyaltyLine: 'Classic gives loyalty stamps, the free drink and 10% off. A tab you add later won’t, even with the same name.',
    })
    expect(deletePrompt({ id: 'waffle', label: 'Waffle' }, 1)).toEqual({
      question: 'Delete Waffle and its 1 item? This can’t be undone.',
      loyaltyLine: 'Waffle gives loyalty stamps and 10% off. Adding a tab named Waffle again brings them back; a tab under any other name won’t have them.',
    })
    expect(deletePrompt({ id: 'signature', label: 'Signature' }, 0).loyaltyLine)
      .toBe('Signature gives loyalty stamps. Adding a tab named Signature again brings them back; a tab under any other name won’t have them.')
    // Classic is the espresso tab: a new tab named Classic gets the id classic, which has no rules.
    expect(deletePrompt({ id: 'espresso', label: 'Classic' }, 0).loyaltyLine)
      .toBe('Classic gives loyalty stamps, the free drink and 10% off. A tab you add later won’t, even with the same name.')
    expect(deletePrompt({ id: 'add-ons-food', label: 'ADD ONS FOOD' }, 0)).toEqual({ question: 'Delete ADD ONS FOOD?', loyaltyLine: null })
  })

  const tab = (id: string) => ({ id, label: id, type: 'drink' as const, order: 1, _sanityId: `menu-category-${id}` })
  const item = (id: string, category: string) => ({
    _id: id, name: id, subtitle: null, category, priceHot: null, priceIce: 120, priceFixed: null,
    addonType: null, hiddenFromPos: false, applicableCategories: null,
  })
  const state = (activeCategoryId: string | null): MenuState => ({
    categories: [tab('signature'), tab('espresso'), tab('snack')],
    items: [item('a', 'espresso'), item('b', 'espresso'), item('c', 'snack')],
    categoryOrder: ['signature', 'espresso', 'snack'],
    activeCategoryId,
  })

  it('takes the tab, its items and its place in the order off the POS, and moves an open tab to the first', () => {
    expect(withoutTab(state('espresso'), 'espresso')).toEqual({
      categories: [tab('signature'), tab('snack')],
      items: [item('c', 'snack')],
      categoryOrder: ['signature', 'snack'],
      activeCategoryId: null,
    })
    expect(withoutTab(state('snack'), 'espresso').activeCategoryId).toBe('snack')
  })
})

describe('the delete request', () => {
  it('tells the server how many items the screen showed, so a changed tab is not wiped unseen', () => {
    expect(deleteTabUrl({ _sanityId: 'menu-category-espresso' }, 3)).toBe('/api/menu/categories/menu-category-espresso?items=3')
  })
})
