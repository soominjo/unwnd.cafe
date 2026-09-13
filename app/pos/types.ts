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
  applicableCategories?: string[] | null
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
  note?: string
  categoryId?: string
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
  note?: string
  /** An add-on attached to another line, not an orderable menu item on its own. */
  isAddon?: boolean
  /** The lineId of the item this add-on is attached to — absent on sales saved before this was tracked. */
  parentLineId?: string
  /** The menu category this was ordered from — absent for add-ons and sales saved before this was tracked. */
  categoryId?: string
}

export interface Sale {
  _id: string
  _createdAt: string
  total: number
  paymentAmount: number
  change: number
  items: SaleItem[]
  subtotal?: number
  discounts?: LineDiscount[]
  notes?: string
  isCompleted?: boolean
}

export interface TopItem {
  name: string
  variant: string | null
  qtySold: number
  revenue: number
  /** Null for add-ons and sales saved before category tracking — filtered out of the category sub-tabs, still shown under "All". */
  categoryId: string | null
}

export interface TopItemCategory {
  id: string
  label: string
}

export interface TopCustomer {
  name: string
  orderCount: number
  totalSpent: number
}

export interface SalesSummary {
  totalRevenue: number
  orderCount: number
  avgOrderValue: number
  topItems: TopItem[]
  /** Only the categories actually present in topItems, in menu order — the Top Items sub-tabs. */
  topItemCategories: TopItemCategory[]
  topCustomers: TopCustomer[]
  /** Whole-period counts (not just the current page) — what the Recent/Completed tab badges show. */
  pendingCount: number
  completedCount: number
}
