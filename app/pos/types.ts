export type Variant = 'hot' | 'ice'

export interface MenuItem {
  id: string
  name: string
  subtitle: string
  priceHot: number | null
  priceIce: number | null
  priceFixed: number | null
}

export interface MenuCategory {
  id: string
  label: string
  items: MenuItem[]
}

export interface OrderItem {
  lineId: string
  name: string
  variant: Variant | null
  price: number
  qty: number
}
