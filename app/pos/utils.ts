import type { OrderItem } from './types'

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
