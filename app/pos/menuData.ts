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
      {
        id: 'amber-cream-latte',
        name: 'Amber Cream Latte',
        subtitle: 'Espresso · Condensed Milk · Caramel · Milk · Sea Salt Cream',
        priceHot: 140,
        priceIce: 150,
        priceFixed: null,
      },
    ],
  },
  {
    id: 'espresso',
    label: 'Espresso',
    items: [
      {
        id: 'cafe-latte',
        name: 'Cafe Latte',
        subtitle: 'Espresso · Milk',
        priceHot: 110,
        priceIce: 120,
        priceFixed: null,
      },
      {
        id: 'spanish-latte',
        name: 'Spanish Latte',
        subtitle: 'Espresso · Condensed Milk · Milk',
        priceHot: 120,
        priceIce: 130,
        priceFixed: null,
      },
      {
        id: 'mocha-latte',
        name: 'Mocha Latte',
        subtitle: 'Espresso · Chocolate Sauce · Milk',
        priceHot: 130,
        priceIce: 140,
        priceFixed: null,
      },
      {
        id: 'white-chocolate-mocha',
        name: 'White Chocolate Mocha',
        subtitle: 'Espresso · White Chocolate Sauce · Milk',
        priceHot: 130,
        priceIce: 140,
        priceFixed: null,
      },
    ],
  },
  {
    id: 'non-coffee',
    label: 'Non-Coffee',
    items: [
      {
        id: 'chocolate-milk',
        name: 'Chocolate Milk',
        subtitle: 'Chocolate Sauce · Milk',
        priceHot: 110,
        priceIce: 120,
        priceFixed: null,
      },
      {
        id: 'strawberry-milk',
        name: 'Strawberry Milk',
        subtitle: 'Strawberry Jam · Milk',
        priceHot: null,
        priceIce: 120,
        priceFixed: null,
      },
    ],
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
