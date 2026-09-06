// Shared receipt content model. Every printer transport (ESC/POS bytes, on-screen
// preview, browser window.print()) renders the same ReceiptBlock[] so the "look"
// of a receipt can never drift between what's previewed and what actually prints.

export type ReceiptBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'meta'; text: string }
  | { kind: 'rule'; style?: 'single' | 'double' }
  | { kind: 'item'; name: string; variant: string | null; qty: number; lineTotal: number }
  | { kind: 'itemNote'; text: string }
  | { kind: 'total'; label: string; value: number; emphasis?: boolean; isDiscount?: boolean }
  | { kind: 'note'; text: string }
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
  shopName: string
  timestamp: Date
  items: ReceiptItemInput[]
  subtotal: number
  discounts: ReceiptDiscountInput[]
  total: number
  paymentAmount: number
  change: number
  notes?: string
  footerMessage?: string
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function buildReceiptDocument(input: ReceiptInput): ReceiptBlock[] {
  const blocks: ReceiptBlock[] = []

  blocks.push({ kind: 'heading', text: input.shopName })
  blocks.push({ kind: 'meta', text: formatTimestamp(input.timestamp) })
  blocks.push({ kind: 'rule' })

  for (const item of input.items) {
    blocks.push({ kind: 'item', name: item.name, variant: item.variant, qty: item.qty, lineTotal: item.lineTotal })
    if (item.note?.trim()) {
      blocks.push({ kind: 'itemNote', text: item.note.trim() })
    }
  }

  blocks.push({ kind: 'rule' })

  if (input.discounts.length > 0) {
    blocks.push({ kind: 'total', label: 'Subtotal', value: input.subtotal })
    for (const discount of input.discounts) {
      blocks.push({ kind: 'total', label: discount.label, value: discount.amount, isDiscount: true })
    }
  }

  blocks.push({ kind: 'total', label: 'TOTAL', value: input.total, emphasis: true })
  blocks.push({ kind: 'total', label: 'Payment', value: input.paymentAmount })
  blocks.push({ kind: 'total', label: 'Change', value: input.change })

  if (input.notes?.trim()) {
    blocks.push({ kind: 'rule' })
    blocks.push({ kind: 'note', text: input.notes.trim() })
  }

  blocks.push({ kind: 'rule' })
  blocks.push({ kind: 'footer', text: input.footerMessage ?? 'Thank you! Come again.' })

  return blocks
}
