import { describe, it, expect } from 'vitest'
import type { MenuItemDoc } from '@/lib/posMenu'
import { toPublicMenu } from './publicMenu'

const tab = (id: string, label: string) => ({ id, label, type: 'drink' as const, order: 1, _sanityId: `menu-category-${id}` })
const item = (over: Partial<MenuItemDoc>): MenuItemDoc => ({
  _id: 'x', name: 'X', subtitle: null, category: 'espresso', priceHot: null, priceIce: null, priceFixed: null,
  addonType: null, hiddenFromPos: false, applicableCategories: null, description: null, image: null, ingredients: null, ...over,
})
const categories = [tab('signature', 'Signature'), tab('add-ons', 'Add ons'), tab('espresso', 'Classic')]

describe('what /menu shows', () => {
  it('the POS tabs in the POS order and names, without Add ons', () => {
    expect(toPublicMenu({ categories, items: [] }).categories).toEqual([{ id: 'signature', label: 'Signature' }, { id: 'espresso', label: 'Classic' }])
  })

  it('items in the order they were added, Hide from POS ones included, only in tabs it shows', () => {
    const items = [
      item({ _id: 'a', name: 'Americano' }), item({ _id: 's', name: 'Espresso Shot', category: 'add-ons' }),
      item({ _id: 'c', name: 'Caramel', hiddenFromPos: true }), item({ _id: 'g', name: 'Stray', category: 'gone' }),
      item({ _id: 'p', name: 'Spanish' }), item({ _id: 'l', name: 'Cafe Latte' }),
    ]
    expect(toPublicMenu({ categories, items }).items.map((i) => i.name)).toEqual(['Americano', 'Caramel', 'Spanish', 'Cafe Latte'])
  })

  it('prices and Hot/Iced as /menu shows them, and the description falling back to the subtitle', () => {
    const [both, iced, food] = toPublicMenu({ categories, items: [
      item({ priceHot: 120, priceIce: 130, subtitle: 'Espresso · Milk' }),
      item({ priceIce: 130, description: 'Cold and creamy' }),
      item({ priceFixed: 180, category: 'signature' }),
    ] }).items
    expect(both).toMatchObject({ price: 120, priceHot: 120, priceIce: 130, drinkType: 'both', description: 'Espresso · Milk' })
    expect(iced).toMatchObject({ price: 130, priceIce: 130, drinkType: 'iced', description: 'Cold and creamy' })
    expect(iced.priceHot).toBeUndefined()
    expect(food).toMatchObject({ price: 180 })
    expect(food.drinkType).toBeUndefined()
    expect(food.image).toBeUndefined()
  })

  it('the ingredients an item has, as /menu showed them before', async () => {
    const [latte, plain] = toPublicMenu({ categories, items: [item({ ingredients: ['Espresso', 'Milk'] }), item({})] }).items
    expect(latte.ingredients).toEqual(['Espresso', 'Milk'])
    expect(plain.ingredients).toBeUndefined()
  })
})
