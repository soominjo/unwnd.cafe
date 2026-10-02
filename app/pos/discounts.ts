import type {
  DiscountLine,
  DiscountRowKind,
  LineDiscountKind,
  LineDiscountScope,
  LineDiscounts,
  LoyaltyChoice,
  OrderItem,
} from './types'
import { isAddonLine } from './utils'
import { isClassicDrinkLine } from '@/lib/loyalty'

// Discount rules. Two kinds — the statutory PWD/Senior 20% and the Google Review
// 10% promo — which the owner allows to stack. Each kind is applied per line,
// to ALL of its units or SOLO to one. Every row is computed on the undiscounted
// base, so each row on a receipt reads as a plain percentage of what it covers.
//
// A loyalty card adds two rewards, each on one unit of a classic (Espresso or
// Non-Coffee) drink the cashier picks, with any add-ons on it paid: 10% off, and a
// free drink. The loyalty 10% is the order's one 10%, so no line carries Google
// Review while it is on. Other discounts on a line with a free unit are worked out
// on the units still paid.

export const DISCOUNT_KINDS: LineDiscountKind[] = ['pwd', 'review']

export const DISCOUNT_RATES: Record<Exclude<DiscountRowKind, 'free'>, number> = {
  pwd: 0.20,
  review: 0.10,
  loyalty: 0.10,
}

export const NO_LOYALTY: LoyaltyChoice = { tenLineId: null, freeLineId: null }
export const LOYALTY_TEN_LABEL = 'Loyalty −10%'
export const LOYALTY_FREE_LABEL = 'Loyalty free drink'
/** The free drink's badge on its line, beside the item name. */
export const LOYALTY_FREE_BADGE = 'Free drink · loyalty'

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

/** SOLO always covers one unit, however many were ordered; ALL covers the units still paid. */
export function unitsDiscounted(item: OrderItem, scope: LineDiscountScope, freeUnits = 0): number {
  return scope === 'solo' ? 1 : item.qty - freeUnits
}

// What a line discount is taken off. ALL: the whole line plus its add-ons. SOLO:
// one unit's share of that same base (one drink and its share of the extra
// shots), whatever the quantity. Divide only for SOLO: (lineBase / qty) * qty is
// not the identity in floating point and can round a half-peso the wrong way.
// A loyalty free unit comes out of the base first; its add-ons are still paid.
export function lineDiscountBase(item: OrderItem, addonsTotal: number, scope: LineDiscountScope, freeUnits = 0): number {
  if (freeUnits > 0) {
    const paidUnits = item.qty - freeUnits
    if (scope === 'solo') return (paidUnits > 0 ? item.price : 0) + addonsTotal / item.qty
    return item.price * paidUnits + addonsTotal
  }
  const lineBase = item.price * item.qty + addonsTotal
  return scope === 'solo' ? lineBase / item.qty : lineBase
}

/** The rate off the line's base — whole pesos, half up. */
export function lineDiscountAmount(
  item: OrderItem,
  addonsTotal: number,
  kind: Exclude<DiscountRowKind, 'free'>,
  scope: LineDiscountScope,
  freeUnits = 0,
): number {
  return Math.round(lineDiscountBase(item, addonsTotal, scope, freeUnits) * DISCOUNT_RATES[kind])
}

// " ×1" / " ×4" — how many units the row covers, shown only when it could be ambiguous.
function unitSuffix(item: OrderItem, scope: LineDiscountScope, freeUnits = 0): string {
  return item.qty > 1 ? ` ×${unitsDiscounted(item, scope, freeUnits)}` : ''
}

// Breakdown-row label. PWD keeps its Food/Drink split (the name the receipt has
// always printed); the review promo is one name whatever the item.
export function discountRowLabel(kind: LineDiscountKind, item: OrderItem, scope: LineDiscountScope, freeUnits = 0): string {
  const head = kind === 'review' ? DISCOUNT_NAMES.review : item.variant === null ? 'PWD Food' : 'PWD Drink'
  return `${head} ${DISCOUNT_RATE_LABELS[kind]}${unitSuffix(item, scope, freeUnits)}`
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
  freeUnits = 0,
): string {
  const name = style === 'short' ? DISCOUNT_SHORT_NAMES[kind] : DISCOUNT_NAMES[kind]
  return `${name} ${DISCOUNT_RATE_LABELS[kind]}${unitSuffix(item, scope, freeUnits)}`
}

export interface LineBadge {
  kind: DiscountRowKind
  text: string
}

/**
 * A line's badges, read from its discount rows so they always agree with the breakdown:
 * a unit made free is not counted, and Google Review never shows beside the loyalty 10%
 * that replaced it.
 */
export function lineBadges(rows: readonly DiscountLine[], item: OrderItem, style: 'full' | 'short' = 'full'): LineBadge[] {
  const own = rows.filter(r => r.lineId === item.lineId)
  const freeUnits = own.some(r => r.kind === 'free') ? 1 : 0
  return own.map(r => ({
    kind: r.kind,
    text: r.kind === 'free' ? LOYALTY_FREE_BADGE
      : r.kind === 'loyalty' ? r.label
      : discountBadge(r.kind, item, r.scope, style, freeUnits),
  }))
}

export function hasLineDiscount(item: OrderItem): boolean {
  return item.discounts !== undefined && Object.keys(item.discounts).length > 0
}

function rateRow(item: OrderItem, addons: number, kind: LineDiscountKind, scope: LineDiscountScope, freeUnits: number): DiscountLine {
  return {
    lineId: item.lineId,
    name: item.name,
    amount: lineDiscountAmount(item, addons, kind, scope, freeUnits),
    kind,
    scope,
    label: discountRowLabel(kind, item, scope, freeUnits),
  }
}

/** The loyalty 10%: one unit of the line's drink, its add-ons paid. */
function loyaltyTenRow(item: OrderItem): DiscountLine {
  return {
    lineId: item.lineId,
    name: item.name,
    amount: Math.round(item.price * DISCOUNT_RATES.loyalty),
    kind: 'loyalty',
    scope: 'solo',
    label: `${LOYALTY_TEN_LABEL}${item.qty > 1 ? ' ×1' : ''}`,
  }
}

/**
 * Every discount row, in order-line order: on each line the loyalty free drink, then
 * PWD/Senior, then the 10% (the loyalty one on its line, else Google Review). The 10%
 * needs a unit not already free. Add-on lines never carry a row of their own, and rows
 * that come to ₱0 are left out.
 */
export function buildDiscountLines(items: OrderItem[], loyalty: LoyaltyChoice = NO_LOYALTY): DiscountLine[] {
  const loyaltyTenOn = loyalty.tenLineId !== null
  return items.flatMap((item): DiscountLine[] => {
    if (isAddonLine(item)) return []
    const addons = attachedAddonsTotal(items, item.lineId)
    const classic = isClassicDrinkLine(item)
    const freeUnits = classic && loyalty.freeLineId === item.lineId ? 1 : 0
    const rows: DiscountLine[] = []
    if (freeUnits > 0) {
      rows.push({ lineId: item.lineId, name: item.name, amount: item.price, kind: 'free', scope: 'solo', label: LOYALTY_FREE_LABEL })
    }
    const pwd = item.discounts?.pwd
    if (pwd) rows.push(rateRow(item, addons, 'pwd', pwd, freeUnits))
    if (classic && loyalty.tenLineId === item.lineId && item.qty > freeUnits) rows.push(loyaltyTenRow(item))
    const review = item.discounts?.review
    if (review && !loyaltyTenOn) rows.push(rateRow(item, addons, 'review', review, freeUnits))
    return rows.filter(r => r.amount > 0)
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

/** The loyalty 10% replaces Google Review on the order: take it off every line that had it. */
export function withoutGoogleReview(items: OrderItem[]): OrderItem[] {
  return items.map(i => (i.discounts?.review ? { ...i, discounts: withoutLineKind(i.discounts, 'review') } : i))
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
