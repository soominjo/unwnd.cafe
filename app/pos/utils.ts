import type { OrderItem, SaleItem } from './types'

export function variantClass(variant: string | null): string {
  if (variant === 'hot') return 'text-red-500'
  if (variant === 'ice') return 'text-sky-500'
  return 'text-foreground/30'
}

export interface GroupedOrderItems {
  parentItems: OrderItem[]
  addonsByParent: Map<string, OrderItem[]>
  orphanAddons: OrderItem[]
}

// Splits a flat OrderItem[] into orderable lines and their attached add-ons.
// Add-on lines carry the load-bearing 'addon__' lineId prefix (see constants.ts);
// an add-on with no parentLineId was added standalone (no line selected) and is
// its own order line rather than a nested attachment.
export function groupOrderItems(items: OrderItem[]): GroupedOrderItems {
  const parentItems = items.filter(i => !i.lineId.startsWith('addon__'))
  const addonItems  = items.filter(i =>  i.lineId.startsWith('addon__'))

  const addonsByParent = new Map<string, OrderItem[]>()
  const orphanAddons: OrderItem[] = []
  for (const addon of addonItems) {
    if (addon.parentLineId) {
      const existing = addonsByParent.get(addon.parentLineId)
      if (existing) existing.push(addon)
      else addonsByParent.set(addon.parentLineId, [addon])
    } else {
      orphanAddons.push(addon)
    }
  }

  return { parentItems, addonsByParent, orphanAddons }
}

export interface GroupedSaleItems {
  topLevel: SaleItem[]
  addonsByParent: Map<string, SaleItem[]>
}

// Same idea as groupOrderItems, but for a saved Sale record: nests each add-on
// under the parentLineId it was attached to. Sales saved before that link was
// persisted (or an add-on bought with nothing selected) simply have no match,
// so they fall back to their own top-level line rather than being nested.
export function groupSaleItems(items: SaleItem[]): GroupedSaleItems {
  const lineIds = new Set(items.map(i => i.lineId))
  const addonsByParent = new Map<string, SaleItem[]>()
  const topLevel: SaleItem[] = []
  for (const item of items) {
    if (item.parentLineId && lineIds.has(item.parentLineId)) {
      const existing = addonsByParent.get(item.parentLineId)
      if (existing) existing.push(item)
      else addonsByParent.set(item.parentLineId, [item])
    } else {
      topLevel.push(item)
    }
  }
  return { topLevel, addonsByParent }
}
