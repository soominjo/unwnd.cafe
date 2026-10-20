import type { MenuCategory } from './types'

export const MENU: MenuCategory[] = [
  {
    // Its drinks are all saved in Sanity. Code copies came back whenever a saved one was renamed.
    id: 'signature',
    label: 'Signature',
    items: [],
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
