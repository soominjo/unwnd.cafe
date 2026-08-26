export type Variant = 'hot' | 'ice'
export type AddonType = 'drink' | 'food'

export interface MenuItem {
  id: string
  _sanityId?: string
  name: string
  subtitle: string
  priceHot: number | null
  priceIce: number | null
  priceFixed: number | null
  addonType?: AddonType | null
  hiddenFromPos?: boolean
}

export interface MenuCategory {
  id: string
  label: string
  items: MenuItem[]
}

export interface Addon {
  id: string
  _sanityId?: string
  name: string
  label: string
  price: number
  type?: AddonType | null
}

export interface OrderItem {
  lineId: string
  name: string
  variant: Variant | null
  price: number
  qty: number
  pwdDiscounted?: boolean
  parentLineId?: string
}

export interface LineDiscount {
  lineId: string
  name: string
  amount: number
}

export interface SaleItem {
  lineId: string
  name: string
  variant: string | null
  price: number
  qty: number
}

export interface Sale {
  _id: string
  _createdAt: string
  total: number
  paymentAmount: number
  change: number
  items: SaleItem[]
  notes?: string
  isCompleted?: boolean
}

export interface TopItem {
  name: string
  variant: string | null
  qtySold: number
  revenue: number
}

export interface SalesSummary {
  totalRevenue: number
  orderCount: number
  avgOrderValue: number
  topItems: TopItem[]
}
