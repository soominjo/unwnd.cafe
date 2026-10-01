import type {
  DiscountLine,
  LineDiscountKind,
  LineDiscountScope,
  LineDiscounts,
  OrderItem,
} from './types'
import { isAddonLine } from './utils'

// Discount rules. Two kinds — the statutory PWD/Senior 20% and the Google Review
// 10% promo — which the owner allows to stack. Each kind is applied per line,
// to ALL of its units or SOLO to one. Every row is computed on the undiscounted
// base, so each row on a receipt reads as a plain percentage of what it covers.

export const DISCOUNT_KINDS: LineDiscountKind[] = ['pwd', 'review']

export const DISCOUNT_RATES: Record<LineDiscountKind, number> = {
  pwd: 0.20,
  review: 0.10,
}

/** Customer-facing names — the review screen's badges and the Google Review row on the receipt. */
export const DISCOUNT_NAMES: Record<LineDiscountKind, string> = {
  pwd: 'PWD/Senior',
  review: 'Google Review',
}

/** Cashier-facing shorthand for the per-line chips, where four must fit in a row. */
export const DISCOUNT_SHORT_NAMES: Record<LineDiscountKind, string> = {
  pwd: 'PWD/S',
  review: 'GR',
}

/** Unicode minus — on-screen only; savedDiscountName swaps it for the printer. */
export const DISCOUNT_RATE_LABELS: Record<LineDiscountKind, string> = {
  pwd: '−20%',
  review: '−10%',
}

export const SCOPE_LABELS: Record<LineDiscountScope, string> = {
  all: 'ALL',
  solo: 'SOLO',
}

/** Sum of the add-ons attached to a line (price × qty each). */
export function attachedAddonsTotal(items: OrderItem[], lineId: string): number {
  return items
    .filter(i => i.parentLineId === lineId)
    .reduce((sum, i) => sum + i.price * i.qty, 0)
}

/** SOLO always covers one unit, however many were ordered; ALL covers the whole quantity. */
export function unitsDiscounted(item: OrderItem, scope: LineDiscountScope): number {
  return scope === 'solo' ? 1 : item.qty
}

// What a line discount is taken off. ALL: the whole line plus its add-ons. SOLO:
// one unit's share of that same base (one drink and its share of the extra
// shots), whatever the quantity. Divide only for SOLO: (lineBase / qty) * qty is
// not the identity in floating point and can round a half-peso the wrong way.
export function lineDiscountBase(item: OrderItem, addonsTotal: number, scope: LineDiscountScope): number {
  const lineBase = item.price * item.qty + addonsTotal
  return scope === 'solo' ? lineBase / item.qty : lineBase
}

/** The rate off the line's base — whole pesos, half up. */
export function lineDiscountAmount(
  item: OrderItem,
  addonsTotal: number,
  kind: LineDiscountKind,
  scope: LineDiscountScope,
): number {
  return Math.round(lineDiscountBase(item, addonsTotal, scope) * DISCOUNT_RATES[kind])
}

// " ×1" / " ×4" — how many units the row covers, shown only when it could be ambiguous.
function unitSuffix(item: OrderItem, scope: LineDiscountScope): string {
  return item.qty > 1 ? ` ×${unitsDiscounted(item, scope)}` : ''
}

// Breakdown-row label. PWD keeps its Food/Drink split (the name the receipt has
// always printed); the review promo is one name whatever the item.
export function discountRowLabel(kind: LineDiscountKind, item: OrderItem, scope: LineDiscountScope): string {
  const head = kind === 'review' ? DISCOUNT_NAMES.review : item.variant === null ? 'PWD Food' : 'PWD Drink'
  return `${head} ${DISCOUNT_RATE_LABELS[kind]}${unitSuffix(item, scope)}`
}

/**
 * Line badge: "PWD/Senior −20% ×1" for the customer-facing review screen, or
 * "PWD/S −20% ×1" where space is tight — the order panel's line rows, which sit
 * beside the item name and its buttons.
 */
export function discountBadge(
  kind: LineDiscountKind,
  item: OrderItem,
  scope: LineDiscountScope,
  style: 'full' | 'short' = 'full',
): string {
  const name = style === 'short' ? DISCOUNT_SHORT_NAMES[kind] : DISCOUNT_NAMES[kind]
  return `${name} ${DISCOUNT_RATE_LABELS[kind]}${unitSuffix(item, scope)}`
}

export function hasLineDiscount(item: OrderItem): boolean {
  return item.discounts !== undefined && Object.keys(item.discounts).length > 0
}

/**
 * Every discount row, in order-line order (PWD before review on a line). Add-on
 * lines never carry a row of their own.
 */
export function buildDiscountLines(items: OrderItem[]): DiscountLine[] {
  return items.flatMap((item): DiscountLine[] => {
    if (!item.discounts || isAddonLine(item)) return []
    const addons = attachedAddonsTotal(items, item.lineId)
    return DISCOUNT_KINDS.flatMap((kind): DiscountLine[] => {
      const scope = item.discounts?.[kind]
      if (!scope) return []
      return [{
        lineId: item.lineId,
        name: item.name,
        amount: lineDiscountAmount(item, addons, kind, scope),
        kind,
        scope,
        label: discountRowLabel(kind, item, scope),
      }]
    })
  })
}

export function totalDiscount(lines: DiscountLine[]): number {
  return lines.reduce((sum, d) => sum + d.amount, 0)
}

// The persisted name — exactly what the receipt prints and what sales history
// reprints. ASCII only: the thermal encoder has no glyph for the minus or ×.
export function savedDiscountName(line: DiscountLine): string {
  return `${line.label.replace('−', '-').replace('×', 'x')} (${line.name})`
}

function withoutLineKind(discounts: LineDiscounts, kind: LineDiscountKind): LineDiscounts | undefined {
  const next: LineDiscounts = { ...discounts }
  delete next[kind]
  return Object.keys(next).length > 0 ? next : undefined
}

// Chip tap on one line. Same kind at the same scope → off; same kind at the
// other scope → switch; another kind → stack.
export function pickLineDiscount(
  items: OrderItem[],
  lineId: string,
  kind: LineDiscountKind,
  scope: LineDiscountScope,
): OrderItem[] {
  const target = items.find(i => i.lineId === lineId)
  if (!target) return items
  const turningOff = target.discounts?.[kind] === scope
  return items.map(i => {
    if (i.lineId !== lineId) return i
    const discounts: LineDiscounts | undefined = turningOff
      ? withoutLineKind(i.discounts ?? {}, kind)
      : { ...i.discounts, [kind]: scope }
    return { ...i, discounts }
  })
}
