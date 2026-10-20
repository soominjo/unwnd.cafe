import type { MenuCategory } from './types'

export const MENU: MenuCategory[] = [
  {
    id: 'signature',
    label: 'Signature',
    items: [
      {
        id: 'white-mocha-americano',
        name: 'White Mocha Americano',
        subtitle: 'Espresso · White Chocolate Sauce · Breve',
        priceHot: 130,
        priceIce: 140,
        priceFixed: null,
      },
      {
        id: 'cereal-cream-latte',
        name: 'Cereal Cream Latte',
        subtitle: 'Espresso · Milk · Cereal · Sea Salt Cream',
        priceHot: 160,
        priceIce: 170,
        priceFixed: null,
      },
    ],
  },
  {
    // Shown as Classic since Oct 20, 2026; the id stays, as the loyalty rules key on it.
    id: 'espresso',
    label: 'Classic',
    items: [],
  },
  {
    id: 'non-coffee',
    label: 'Non-Coffee',
    items: [],
  },
  {
    id: 'meal',
    label: 'Meal',
    items: [],
  },
  {
    id: 'waffle',
    label: 'Waffle',
    items: [],
  },
  {
    id: 'snack',
    label: 'Snack',
    items: [],
  },
]
