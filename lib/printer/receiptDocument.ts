import { UNWND_SHOP, type ShopDetails } from './shopDetails'

// Shared receipt content model. Every printer transport (ESC/POS bytes, on-screen
// preview, PDF) renders the same ReceiptBlock[] so the "look" of a receipt can
// never drift between what's previewed and what prints.

export type ReceiptBlock =
  | { kind: 'logo'; fallbackText: string }
  | { kind: 'meta'; text: string }
  | { kind: 'rule'; style?: 'single' | 'double' }
  | { kind: 'detail'; label: string; value: string }
  | { kind: 'item'; name: string; variant: string | null; qty: number; lineTotal: number }
  | { kind: 'itemNote'; text: string }
  | { kind: 'total'; label: string; value: number; emphasis?: boolean; isDiscount?: boolean }
  | { kind: 'spacer'; lines?: number }
  | { kind: 'qr'; url: string; caption: string }
  | { kind: 'footer'; text: string }

export interface ReceiptItemInput {
  name: string
  variant: string | null
  qty: number
  lineTotal: number
  note?: string
}

export interface ReceiptDiscountInput {
  label: string
  amount: number
}

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
}

const RECEIPT_TIME_ZONE = 'Asia/Manila'
const DEFAULT_FOOTER = 'Thank you for visiting!'
const REVIEW_PROMPT = 'Tell us about your experience:'
const REVIEW_CAPTION = 'Scan to leave a Google review'

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

function headerBlocks(shop: ShopDetails): ReceiptBlock[] {
  return [
    // The logo carries the brand; the shop name only prints if the bitmap can't be rendered.
    { kind: 'logo', fallbackText: shop.name },
    ...shop.addressLines.map((text): ReceiptBlock => ({ kind: 'meta', text })),
    { kind: 'meta', text: shop.hours },
    { kind: 'rule', style: 'double' },
  ]
}

function detailBlocks(input: ReceiptInput): ReceiptBlock[] {
  const itemCount = input.items.reduce((sum, item) => sum + item.qty, 0)
  const name = input.customerName?.trim()
  const nameRow: ReceiptBlock[] = name ? [{ kind: 'detail', label: 'Name', value: name }] : []
  return [
    ...nameRow,
    { kind: 'detail', label: 'Date', value: formatDate(input.timestamp) },
    { kind: 'detail', label: 'Time', value: formatTime(input.timestamp) },
    { kind: 'detail', label: 'Items', value: String(itemCount) },
    { kind: 'rule' },
  ]
}

function itemBlocks(items: ReceiptItemInput[]): ReceiptBlock[] {
  return items.flatMap((item): ReceiptBlock[] => {
    const note = item.note?.trim()
    const noteRow: ReceiptBlock[] = note ? [{ kind: 'itemNote', text: note }] : []
    return [
      { kind: 'item', name: item.name, variant: item.variant, qty: item.qty, lineTotal: item.lineTotal },
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
    { kind: 'total', label: 'Payment', value: input.paymentAmount },
    { kind: 'total', label: 'Change', value: input.change },
    { kind: 'rule', style: 'double' },
  ]
}

function footerBlocks(input: ReceiptInput, shop: ShopDetails): ReceiptBlock[] {
  return [
    { kind: 'spacer' },
    { kind: 'footer', text: input.footerMessage ?? DEFAULT_FOOTER },
    { kind: 'meta', text: REVIEW_PROMPT },
    { kind: 'spacer' },
    { kind: 'qr', url: shop.reviewUrl, caption: REVIEW_CAPTION },
    { kind: 'spacer' },
    { kind: 'meta', text: shop.instagram },
    { kind: 'rule' },
  ]
}

export function buildReceiptDocument(input: ReceiptInput): ReceiptBlock[] {
  const shop = input.shop ?? UNWND_SHOP
  return [
    ...headerBlocks(shop),
    ...detailBlocks(input),
    ...itemBlocks(input.items),
    ...totalBlocks(input),
    ...footerBlocks(input, shop),
  ]
}
