import { create } from 'zustand'

interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
}

interface CartStore {
  items: CartItem[]
  isTrayOpen: boolean
  openTray: () => void
  closeTray: () => void
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (id: string) => void
  clearCart: () => void
  totalPrice: () => number
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  isTrayOpen: false,

  openTray: () => set({ isTrayOpen: true }),
  closeTray: () => set({ isTrayOpen: false }),

  addItem: (item) => {
    set((state) => {
      const existing = state.items.find((i) => i.id === item.id)
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        }
      }
      return { items: [...state.items, { ...item, quantity: 1 }] }
    })
  },

  removeItem: (id) => {
    set((state) => ({ items: state.items.filter((i) => i.id !== id) }))
  },

  clearCart: () => set({ items: [] }),

  totalPrice: () => {
    return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  },
}))
