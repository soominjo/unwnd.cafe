import type { DiscountLine, LineDiscountKind, OrderItem } from './types'
import { isAddonLine } from './utils'

// Discount rules for one order line. A line carries at most one discount: the
// statutory PWD/Senior discount and a promo never stack (the customer gets the
// higher one, and 20% always beats 10%), so "switch" is the only transition.

export const DISCOUNT_RATES: Record<LineDiscountKind, number> = {
  pwd: 0.20,
  review: 0.10,
}

/** Chip / badge label for each kind. Unicode minus — on-screen only, never persisted. */
export const DISCOUNT_LABELS: Record<LineDiscountKind, string> = {
  pwd: 'PWD/Senior −20%',
  review: 'Google Review −10%',
}

/** Sum of the add-ons attached to a line (price × qty each). */
export function attachedAddonsTotal(items: OrderItem[], lineId: string): number {
  return items
    .filter(i => i.parentLineId === lineId)
    .reduce((sum, i) => sum + i.price * i.qty, 0)
}

// PWD/Senior: 20% off ONE unit plus its add-ons — one ID covers one person's own
// order, so extra quantity on the same line stays full price. Google Review: a
// promo on the customer's order, so 10% off the whole line. Whole pesos, .5 up.
export function lineDiscountAmount(item: OrderItem, addonsTotal: number, kind: LineDiscountKind): number {
  const base = kind === 'pwd' ? item.price + addonsTotal : item.price * item.qty + addonsTotal
  return Math.round(base * DISCOUNT_RATES[kind])
}

// Breakdown-row label. PWD keeps its Food/Drink split (the name the receipt has
// always printed); the review promo is one label whatever the item.
export function discountRowLabel(kind: LineDiscountKind, item: OrderItem): string {
  if (kind === 'review') return DISCOUNT_LABELS.review
  return item.variant === null ? 'PWD Food −20%' : 'PWD Drink −20%'
}

/** One row per discounted order line, in order-line order. Add-on lines never carry a discount of their own. */
export function buildDiscountLines(items: OrderItem[]): DiscountLine[] {
  return items.flatMap((item): DiscountLine[] => {
    const kind = item.discount
    if (!kind || isAddonLine(item)) return []
    return [{
      lineId: item.lineId,
      name: item.name,
      amount: lineDiscountAmount(item, attachedAddonsTotal(items, item.lineId), kind),
      kind,
      label: discountRowLabel(kind, item),
    }]
  })
}

export function totalDiscount(lines: DiscountLine[]): number {
  return lines.reduce((sum, d) => sum + d.amount, 0)
}

// The persisted name — exactly what the receipt prints and what sales history
// reprints. ASCII hyphen: the thermal encoder has no glyph for the on-screen minus.
export function savedDiscountName(line: DiscountLine): string {
  return `${line.label.replace('−', '-')} (${line.name})`
}
