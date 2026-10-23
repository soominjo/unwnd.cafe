import { UNWND_SHOP, type ShopDetails } from './shopDetails'
import { ORDER_TYPE_LABELS, PAYMENT_METHOD_LABELS, samePesos, type OrderType, type PaymentMethod } from '@/lib/sales/payments'

// Shared receipt content model. Every printer transport (ESC/POS bytes, on-screen
// preview, PDF) renders the same ReceiptBlock[] so the "look" of a receipt can
// never drift between what's previewed and what prints.

export type ReceiptBlock =
  | { kind: 'logo'; fallbackText: string }
  | { kind: 'meta'; text: string }
  | { kind: 'rule'; style?: 'single' | 'double' }
  | { kind: 'detail'; label: string; value: string }
  | { kind: 'item'; name: string; variant: string | null; qty: number; lineTotal: number | null }
  | { kind: 'itemNote'; text: string }
  | { kind: 'total'; label: string; value: number; emphasis?: boolean; isDiscount?: boolean }
  | { kind: 'spacer'; lines?: number }
  | { kind: 'qr'; url: string; caption: string }
  | { kind: 'footer'; text: string }
  /** A line at twice the size, for the staff ticket's TAKE OUT or DINE IN; inverted prints white on black. */
  | { kind: 'banner'; text: string; inverted: boolean }
  /** Where two tickets of one print come apart: a gap with a tear line (and a cut, given a cutter). */
  | { kind: 'tear' }

export interface ReceiptItemInput {
  name: string
  variant: string | null
  qty: number
  lineTotal: number
  note?: string
  /** An add-on attached to another line — printed like any other line, but excluded from the "Items" count. */
  isAddon?: boolean
}

export interface ReceiptDiscountInput {
  label: string
  amount: number
}

/** One payment on the receipt. */
export interface ReceiptPaymentInput {
  method: PaymentMethod
  amount: number
  /** Cash only: what was handed over; it prints instead of the amount, with the change below. */
  received?: number
  /** When it was paid. Times print only on an order paid at different times (items added later). */
  paidAt?: Date
}

/**
 * `customer` is the full receipt handed to the customer at checkout (branding, pricing,
 * payment breakdown). `kitchen` is a lean staff ticket reprinted from sales history to
 * prep an order — no logo or money figures, since those mean nothing back of house.
 */
export type ReceiptAudience = 'customer' | 'kitchen'

export interface ReceiptInput {
  timestamp: Date
  items: ReceiptItemInput[]
  subtotal: number
  discounts: ReceiptDiscountInput[]
  total: number
  paymentAmount: number
  change: number
  /** The customer's name from checkout — the POS stores it as the sale's `notes`. */
  customerName?: string
  footerMessage?: string
  shop?: ShopDetails
  /** Defaults to 'customer'. */
  audience?: ReceiptAudience
  /**
   * Set on a staff ticket of items added to an order after its checkout: the order's first
   * time. The ticket is headed ADDED TO ORDER, so the kitchen makes only these.
   */
  addedTo?: Date
  /** Dine in or take out: a detail on the receipt, a banner on the staff ticket. Absent on old orders. */
  orderType?: OrderType
  /**
   * Each payment. When they cover the whole total the receipt prints a row per payment, then the
   * change if any was cash; otherwise (orders begun before payments were recorded) it prints
   * Payment and Change as before.
   */
  payments?: readonly ReceiptPaymentInput[]
}

const RECEIPT_TIME_ZONE = 'Asia/Manila'
const DEFAULT_FOOTER = 'Thank you for visiting!'
const KITCHEN_TICKET_TITLE = 'KITCHEN TICKET'
const ADDED_TICKET_TITLE = 'ADDED TO ORDER'

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: RECEIPT_TIME_ZONE,
  })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: RECEIPT_TIME_ZONE })
}

/**
 * Compile-time exhaustiveness guard for `switch (block.kind)`. Every renderer
 * (ESC/POS, preview, PDF) puts this in its `default` branch, so adding a block
 * kind without handling it everywhere is a type error rather than a silently
 * missing line on the receipt.
 */
export function assertNeverBlock(block: never): never {
  throw new Error(`Unhandled receipt block kind: ${(block as ReceiptBlock).kind}`)
}

/** The staff ticket's TAKE OUT (white on black, so the bar packs it) or DINE IN. */
function orderTypeBanner(orderType: OrderType | undefined): ReceiptBlock[] {
  if (!orderType) return []
  return [{ kind: 'banner', text: ORDER_TYPE_LABELS[orderType].toUpperCase(), inverted: orderType === 'take-out' }]
}

function headerBlocks(shop: ShopDetails, audience: ReceiptAudience, addedTo?: Date, orderType?: OrderType): ReceiptBlock[] {
  if (audience === 'kitchen') {
    const added: ReceiptBlock[] = addedTo ? [{ kind: 'footer', text: ADDED_TICKET_TITLE }] : []
    return [{ kind: 'footer', text: KITCHEN_TICKET_TITLE }, ...added, ...orderTypeBanner(orderType), { kind: 'rule', style: 'double' }]
  }
  return [
    // The logo carries the brand; the shop name only prints if the bitmap can't be rendered.
    { kind: 'logo', fallbackText: shop.name },
    ...shop.addressLines.map((text): ReceiptBlock => ({ kind: 'meta', text })),
    ...shop.hoursLines.map((text): ReceiptBlock => ({ kind: 'meta', text })),
    { kind: 'rule', style: 'double' },
  ]
}

function detailBlocks(input: ReceiptInput): ReceiptBlock[] {
  const itemCount = input.items.reduce((sum, item) => sum + (item.isAddon ? 0 : item.qty), 0)
  const name = input.customerName?.trim()
  const nameRow: ReceiptBlock[] = name ? [{ kind: 'detail', label: 'Name', value: name }] : []
  const orderRow: ReceiptBlock[] = input.addedTo ? [{ kind: 'detail', label: 'Order from', value: formatTime(input.addedTo) }] : []
  // The staff ticket has the banner instead.
  const typeRow: ReceiptBlock[] =
    input.orderType && input.audience !== 'kitchen' ? [{ kind: 'detail', label: 'Order', value: ORDER_TYPE_LABELS[input.orderType] }] : []
  return [
    ...nameRow,
    ...typeRow,
    { kind: 'detail', label: 'Date', value: formatDate(input.timestamp) },
    { kind: 'detail', label: 'Time', value: formatTime(input.timestamp) },
    ...orderRow,
    { kind: 'detail', label: 'Items', value: String(itemCount) },
    { kind: 'rule' },
  ]
}

function itemBlocks(items: ReceiptItemInput[], audience: ReceiptAudience): ReceiptBlock[] {
  return items.flatMap((item): ReceiptBlock[] => {
    const note = item.note?.trim()
    const noteRow: ReceiptBlock[] = note ? [{ kind: 'itemNote', text: note }] : []
    return [
      {
        kind: 'item',
        name: item.name,
        variant: item.variant,
        qty: item.qty,
        lineTotal: audience === 'kitchen' ? null : item.lineTotal,
      },
      ...noteRow,
    ]
  })
}

function totalBlocks(input: ReceiptInput): ReceiptBlock[] {
  const discountRows: ReceiptBlock[] =
    input.discounts.length > 0
      ? [
          { kind: 'total', label: 'Subtotal', value: input.subtotal },
          ...input.discounts.map(
            (discount): ReceiptBlock => ({ kind: 'total', label: discount.label, value: discount.amount, isDiscount: true }),
          ),
        ]
      : []
  return [
    { kind: 'rule' },
    ...discountRows,
    { kind: 'total', label: 'TOTAL', value: input.total, emphasis: true },
    ...paymentRows(input),
    { kind: 'rule', style: 'double' },
  ]
}

/**
 * A row per payment (cash as handed over), then the change when any was cash; each with its time
 * on an order paid at different times. Payments that don't cover the total (an order begun before
 * they were recorded) print the one Payment and Change rows instead.
 */
function paymentRows(input: ReceiptInput): ReceiptBlock[] {
  const payments = input.payments ?? []
  const covered = payments.length > 0 && samePesos(payments.reduce((sum, p) => sum + p.amount, 0), input.total)
  if (!covered) {
    return [
      { kind: 'total', label: 'Payment', value: input.paymentAmount },
      { kind: 'total', label: 'Change', value: input.change },
    ]
  }
  const showTimes = new Set(payments.map(p => (p.paidAt ? formatTime(p.paidAt) : ''))).size > 1
  const rows = payments.map((p): ReceiptBlock => ({
    kind: 'total',
    label: showTimes && p.paidAt ? `${PAYMENT_METHOD_LABELS[p.method]} ${formatTime(p.paidAt)}` : PAYMENT_METHOD_LABELS[p.method],
    value: p.method === 'cash' ? p.received ?? p.amount : p.amount,
  }))
  const cash = payments.filter(p => p.method === 'cash')
  if (cash.length === 0) return rows
  const change = cash.reduce((sum, p) => sum + (p.received ?? p.amount) - p.amount, 0)
  return [...rows, { kind: 'total', label: 'Change', value: change }]
}

function footerBlocks(input: ReceiptInput, shop: ShopDetails, audience: ReceiptAudience): ReceiptBlock[] {
  if (audience === 'kitchen') return [{ kind: 'spacer' }]
  return [
    { kind: 'spacer' },
    { kind: 'footer', text: input.footerMessage ?? DEFAULT_FOOTER },
    { kind: 'meta', text: shop.instagram },
    { kind: 'rule' },
  ]
}

/** What the line between two tickets of one print says: ASCII, for the printer's code page. */
export const TEAR_LABEL = 'tear here'

/**
 * The customer's receipt and the staff ticket as one print, with a gap between them to tear the
 * paper at. The receipt comes first, for the customer at the counter; the staff ticket below it
 * goes to the bar.
 */
export function receiptThenStaff(receipt: readonly ReceiptBlock[], staff: readonly ReceiptBlock[]): ReceiptBlock[] {
  return [...receipt, { kind: 'tear' }, ...staff]
}

export function buildReceiptDocument(input: ReceiptInput): ReceiptBlock[] {
  const shop = input.shop ?? UNWND_SHOP
  const audience = input.audience ?? 'customer'
  return [
    ...headerBlocks(shop, audience, input.addedTo, input.orderType),
    ...detailBlocks(input),
    ...itemBlocks(input.items, audience),
    ...(audience === 'kitchen' ? [] : totalBlocks(input)),
    ...footerBlocks(input, shop, audience),
  ]
}
