import type { OrderItem, SaleItem } from './types'

// Add-on lines carry the load-bearing 'addon__' lineId prefix (set where the
// order panel attaches an add-on) — the one reliable way to tell an add-on line
// from an orderable menu item, in the live cart and in saved sales alike.
export function isAddonLine(item: { lineId: string }): boolean {
  return item.lineId.startsWith('addon__')
}

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
  const parentItems = items.filter(i => !isAddonLine(i))
  const addonItems  = items.filter(isAddonLine)

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
// under the item it belongs to. Prefers the explicit parentLineId link; when
// that's missing (sales saved before it was tracked, or an add-on whose parent
// line wasn't selected at the time) it falls back to nesting under whichever
// non-addon line came just before it — add-ons are always saved with the
// load-bearing 'addon__' lineId prefix (see constants.ts), so that's still a
// reliable way to tell an add-on apart from a real order line either way. Only
// an add-on with nothing ordered before it at all stays on its own top-level line.
export function groupSaleItems(items: SaleItem[]): GroupedSaleItems {
  const lineIds = new Set(items.map(i => i.lineId))
  const addonsByParent = new Map<string, SaleItem[]>()
  const topLevel: SaleItem[] = []
  let lastTopLevelLineId: string | null = null

  for (const item of items) {
    const isAddon = isAddonLine(item)
    const parentLineId =
      item.parentLineId && lineIds.has(item.parentLineId) ? item.parentLineId : isAddon ? lastTopLevelLineId : null

    if (parentLineId) {
      const existing = addonsByParent.get(parentLineId)
      if (existing) existing.push(item)
      else addonsByParent.set(parentLineId, [item])
    } else {
      topLevel.push(item)
      lastTopLevelLineId = item.lineId
    }
  }

  return { topLevel, addonsByParent }
}
