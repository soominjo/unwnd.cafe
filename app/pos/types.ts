export type Variant = 'hot' | 'ice'

export interface MenuItem {
  id: string
  _sanityId?: string
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
  pwdDiscounted?: boolean
  parentLineId?: string
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
