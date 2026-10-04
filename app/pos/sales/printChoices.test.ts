import { describe, it, expect } from 'vitest'
import type { Sale } from '../types'
import type { ReceiptBlock } from '@/lib/printer/receiptDocument'
import { printChoices } from './printChoices'

const order: Sale = {
  _id: 'sale-214', _createdAt: '2026-10-03T06:14:00.000Z', total: 320, paymentAmount: 320, change: 0, notes: 'Juan',
  items: [{ lineId: 'tiramisu__ice', name: 'Tiramisu', variant: 'ice', price: 160, qty: 2 }],
}
const withAdded: Sale = {
  ...order,
  total: 430,
  items: [...order.items, { lineId: 'cafe-latte__hot__ak3j9', name: 'Cafe Latte', variant: 'hot', price: 110, qty: 1, addedAt: '2026-10-03T06:31:00.000Z' }],
}

const titles = (blocks: ReceiptBlock[]) => blocks.filter(b => b.kind === 'footer').map(b => (b as { text: string }).text)
const itemNames = (blocks: ReceiptBlock[]) => blocks.flatMap(b => (b.kind === 'item' ? [b.name] : []))
const tears = (blocks: ReceiptBlock[]) => blocks.filter(b => b.kind === 'tear').length

describe('printChoices', () => {
  it('offers the staff ticket, the receipt, and both in one print with the receipt on top', () => {
    const [staff, receipt, both] = printChoices(order)
    expect([staff.label, receipt.label, both.label]).toEqual(['Staff ticket', 'Receipt', 'Both'])
    expect(titles(staff.blocks)).toEqual(['KITCHEN TICKET'])
    expect(staff.blocks.some(b => b.kind === 'total')).toBe(false)
    expect(receipt.blocks.some(b => b.kind === 'total')).toBe(true)
    expect(tears(both.blocks)).toBe(1)
    // Both: the customer's receipt, the tear line, then the staff ticket below it.
    expect(both.blocks.slice(0, receipt.blocks.length)).toEqual(receipt.blocks)
    expect(both.blocks.findIndex(b => b.kind === 'tear')).toBe(receipt.blocks.length)
    expect(both.blocks.slice(receipt.blocks.length + 1)).toEqual(staff.blocks)
    expect(staff.versions).toBeUndefined()
  })

  it('starts the staff ticket and both on the items added last, with the whole order one switch away', () => {
    const [staff, receipt, both] = printChoices(withAdded)
    expect(staff.versions?.map(v => v.label)).toEqual(['Added items', 'Whole order'])
    expect(itemNames(staff.blocks)).toEqual(['Cafe Latte'])
    expect(itemNames(staff.versions![1].blocks)).toEqual(['Tiramisu', 'Cafe Latte'])
    // The receipt is always the whole order.
    expect(receipt.versions).toBeUndefined()
    expect(itemNames(receipt.blocks)).toEqual(['Tiramisu', 'Cafe Latte'])
    expect(both.versions?.map(v => v.label)).toEqual(['Added items', 'Whole order'])
    // Both: the whole order's receipt on top, then the staff ticket of the version picked.
    expect(itemNames(both.blocks)).toEqual(['Tiramisu', 'Cafe Latte', 'Cafe Latte'])
    expect(both.versions![0].blocks).toEqual([...receipt.blocks, { kind: 'tear' }, ...staff.versions![0].blocks])
    expect(both.versions![1].blocks).toEqual([...receipt.blocks, { kind: 'tear' }, ...staff.versions![1].blocks])
  })
})
