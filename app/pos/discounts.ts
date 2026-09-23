import type {
  DiscountLine,
  LineDiscountKind,
  LineDiscountScope,
  LineDiscounts,
  OrderDiscounts,
  OrderItem,
} from './types'
import { isAddonLine } from './utils'

// Discount rules. Two kinds — the statutory PWD/Senior 20% and the Google Review
// 10% promo — which the owner allows to stack. Each kind is applied either per
// line (ALL units, or SOLO: one unit) or once to the whole order total, never
// both at the same time. Every row is computed on the undiscounted base, so each
// row on a receipt reads as a plain percentage of what it covers.

export const DISCOUNT_KINDS: LineDiscountKind[] = ['pwd', 'review']

export const DISCOUNT_RATES: Record<LineDiscountKind, number> = {
  pwd: 0.20,
  review: 0.10,
}

/** Customer-facing names — badges, whole-order rows, the receipt. */
export const DISCOUNT_NAMES: Record<LineDiscountKind, string> = {
  pwd: 'PWD/Senior',
  review: 'Google Review',
}

/** Cashier-facing shorthand for the per-line chips, where four must fit in a row. */
export const DISCOUNT_SHORT_NAMES: Record<LineDiscountKind, string> = {
  pwd: 'PWD/S',
  review: 'GR',
}

/** Shorthand for the two footer "Total items" buttons. */
export const DISCOUNT_FOOTER_NAMES: Record<LineDiscountKind, string> = {
  pwd: 'PWD/S',
  review: 'G Review',
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

/** The "item name" of a whole-order row: "PWD/Senior −20% (Total items)". */
export const ORDER_ROW_NAME = 'Total items'

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

// ALL: the rate off the whole line plus its add-ons. SOLO: the rate off one
// unit's share of that same base (one drink and its share of the extra shots),
// whatever the quantity. Whole pesos, half up.
export function lineDiscountAmount(
  item: OrderItem,
  addonsTotal: number,
  kind: LineDiscountKind,
  scope: LineDiscountScope,
): number {
  const lineBase = item.price * item.qty + addonsTotal
  const base = (lineBase / item.qty) * unitsDiscounted(item, scope)
  return Math.round(base * DISCOUNT_RATES[kind])
}

/** A whole-order row: the rate off the full pre-discount subtotal. */
export function orderDiscountAmount(subtotal: number, kind: LineDiscountKind): number {
  return Math.round(subtotal * DISCOUNT_RATES[kind])
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

/** Line badge in the order panel and the review screen: "PWD/Senior −20% ×1". */
export function discountBadge(kind: LineDiscountKind, item: OrderItem, scope: LineDiscountScope): string {
  return `${DISCOUNT_NAMES[kind]} ${DISCOUNT_RATE_LABELS[kind]}${unitSuffix(item, scope)}`
}

export function hasLineDiscount(item: OrderItem): boolean {
  return item.discounts !== undefined && Object.keys(item.discounts).length > 0
}

function lineRows(items: OrderItem[]): DiscountLine[] {
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

function orderRows(items: OrderItem[], order: OrderDiscounts): DiscountLine[] {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0)
  return DISCOUNT_KINDS.filter(kind => order[kind]).map((kind): DiscountLine => ({
    lineId: `order:${kind}`,
    name: ORDER_ROW_NAME,
    amount: orderDiscountAmount(subtotal, kind),
    kind,
    scope: 'order',
    label: `${DISCOUNT_NAMES[kind]} ${DISCOUNT_RATE_LABELS[kind]}`,
  }))
}

/**
 * Every discount row: line rows in order-line order (PWD before review on a
 * line), then the whole-order rows. Add-on lines never carry a row of their own.
 */
export function buildDiscountLines(items: OrderItem[], order: OrderDiscounts): DiscountLine[] {
  return [...lineRows(items), ...orderRows(items, order)]
}

export function totalDiscount(lines: DiscountLine[]): number {
  return lines.reduce((sum, d) => sum + d.amount, 0)
}

// The persisted name — exactly what the receipt prints and what sales history
// reprints. ASCII only: the thermal encoder has no glyph for the minus or ×.
export function savedDiscountName(line: DiscountLine): string {
  return `${line.label.replace('−', '-').replace('×', 'x')} (${line.name})`
}

/** Everything the discount controls act on: the lines and the whole-order toggles. */
export interface DiscountSelection {
  items: OrderItem[]
  order: OrderDiscounts
}

function withoutLineKind(discounts: LineDiscounts, kind: LineDiscountKind): LineDiscounts | undefined {
  const next: LineDiscounts = { ...discounts }
  delete next[kind]
  return Object.keys(next).length > 0 ? next : undefined
}

function withoutOrderKind(order: OrderDiscounts, kind: LineDiscountKind): OrderDiscounts {
  const next: OrderDiscounts = { ...order }
  delete next[kind]
  return next
}

// Chip tap on one line. Same kind at the same scope → off; same kind at the
// other scope → switch; another kind → stack. A kind picked per line comes off
// the whole-order total, since a kind applies per line or to the total, not both.
export function pickLineDiscount(
  sel: DiscountSelection,
  lineId: string,
  kind: LineDiscountKind,
  scope: LineDiscountScope,
): DiscountSelection {
  const target = sel.items.find(i => i.lineId === lineId)
  if (!target) return sel
  const turningOff = target.discounts?.[kind] === scope
  const items = sel.items.map(i => {
    if (i.lineId !== lineId) return i
    const discounts: LineDiscounts | undefined = turningOff
      ? withoutLineKind(i.discounts ?? {}, kind)
      : { ...i.discounts, [kind]: scope }
    return { ...i, discounts }
  })
  return { items, order: turningOff ? sel.order : withoutOrderKind(sel.order, kind) }
}

// Footer tap. On → the kind covers the whole total and comes off every line.
// Off → simply off; the lines are left as they are.
export function toggleOrderDiscount(sel: DiscountSelection, kind: LineDiscountKind): DiscountSelection {
  if (sel.order[kind]) return { items: sel.items, order: withoutOrderKind(sel.order, kind) }
  const items = sel.items.map(i =>
    i.discounts?.[kind] ? { ...i, discounts: withoutLineKind(i.discounts, kind) } : i
  )
  return { items, order: { ...sel.order, [kind]: true } }
}
