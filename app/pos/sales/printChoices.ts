import type { Sale } from '../types'
import type { ReceiptChoice } from '../ReceiptPreviewModal'
import { receiptThenStaff } from '@/lib/printer/receiptDocument'
import { buildReceiptBlocksFromSale } from '@/lib/printer/receiptFromSale'
import { saleRounds } from '@/lib/sales/rounds'

/**
 * What a Sales order's Print sheet offers: its staff ticket, its receipt, or both in one print
 * (the receipt, a tear line, then the staff ticket below it). When items were added to the order later, the staff ticket (alone
 * or in both) starts on those items, so the bar makes only them; the whole order is a switch
 * away. The receipt is always the whole order.
 */
export function printChoices(order: Sale): ReceiptChoice[] {
  const receipt = buildReceiptBlocksFromSale(order, 'customer')
  const whole = buildReceiptBlocksFromSale(order, 'kitchen')
  const rounds = saleRounds(order.items)
  if (!rounds[rounds.length - 1]?.addedAt) {
    return [
      { label: 'Staff ticket', blocks: whole },
      { label: 'Receipt', blocks: receipt },
      { label: 'Both', blocks: receiptThenStaff(receipt, whole) },
    ]
  }
  const added = buildReceiptBlocksFromSale(order, 'kitchen', 'latest')
  const bothAdded = receiptThenStaff(receipt, added)
  return [
    { label: 'Staff ticket', blocks: added, versions: [{ label: 'Added items', blocks: added }, { label: 'Whole order', blocks: whole }] },
    { label: 'Receipt', blocks: receipt },
    {
      label: 'Both',
      blocks: bothAdded,
      versions: [{ label: 'Added items', blocks: bothAdded }, { label: 'Whole order', blocks: receiptThenStaff(receipt, whole) }],
    },
  ]
}
