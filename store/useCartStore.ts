import { create } from 'zustand'

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  drinkType?: string
  ounce?: string
}

interface CartStore {
  items: CartItem[]
  isTrayOpen: boolean
  openTray: () => void
  closeTray: () => void
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (item: Pick<CartItem, 'id' | 'drinkType' | 'ounce'>) => void
  clearCart: () => void
  totalPrice: () => number
}

function isSameItem(a: CartItem, b: Omit<CartItem, 'quantity'>) {
  return a.id === b.id && a.drinkType === b.drinkType && a.ounce === b.ounce
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  isTrayOpen: false,

  openTray: () => set({ isTrayOpen: true }),
  closeTray: () => set({ isTrayOpen: false }),

  addItem: (item) => {
    set((state) => {
      const existing = state.items.find((i) => isSameItem(i, item))
      if (existing) {
        return {
          items: state.items.map((i) =>
            isSameItem(i, item) ? { ...i, quantity: i.quantity + 1 } : i
          ),
        }
      }
      return { items: [...state.items, { ...item, quantity: 1 }] }
    })
  },

  removeItem: ({ id, drinkType, ounce }) => {
    set((state) => ({
      items: state.items.filter(
        (i) => !(i.id === id && i.drinkType === drinkType && i.ounce === ounce)
      ),
    }))
  },

  clearCart: () => set({ items: [] }),

  totalPrice: () => {
    return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  },
}))
