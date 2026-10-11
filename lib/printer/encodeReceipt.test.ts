import { describe, it, expect } from 'vitest'
import { encodeReceiptToEscPos } from './encodeReceipt'
import { buildReceiptDocument, receiptThenStaff, type ReceiptInput } from './receiptDocument'

const sale: ReceiptInput = {
  timestamp: new Date('2026-10-04T06:31:00.000Z'),
  items: [{ name: 'Cafe Latte', variant: 'hot', qty: 1, lineTotal: 110 }],
  subtotal: 110,
  discounts: [],
  total: 110,
  paymentAmount: 200,
  change: 90,
  customerName: 'Juan',
}
const staff = buildReceiptDocument({ ...sale, audience: 'kitchen' })
const receipt = buildReceiptDocument({ ...sale, audience: 'customer' })

const PARTIAL_CUT = [0x1d, 0x56, 0x01]
const FULL_CUT = [0x1d, 0x56, 0x00]

function positions(bytes: Uint8Array, needle: number[] | string): number[] {
  const seq = typeof needle === 'string' ? [...needle].map(c => c.charCodeAt(0)) : needle
  const found: number[] = []
  for (let i = 0; i + seq.length <= bytes.length; i++) {
    if (seq.every((b, j) => bytes[i + j] === b)) found.push(i)
  }
  return found
}

describe('encodeReceiptToEscPos', () => {
  it('prints two tickets in one go with a tear line and a partial cut between them, and the full cut at the end', () => {
    const bytes = encodeReceiptToEscPos(receiptThenStaff(receipt, staff))
    const tear = positions(bytes, '- - - - - tear here - - - - -')
    const partial = positions(bytes, PARTIAL_CUT)
    const full = positions(bytes, FULL_CUT)
    expect(tear).toHaveLength(1)
    expect(partial).toHaveLength(1)
    expect(full).toHaveLength(1)
    // The receipt, tear line, partial cut, then the staff ticket below, then the end.
    expect(positions(bytes, 'Thank you for visiting!')[0]).toBeLessThan(tear[0])
    expect(tear[0]).toBeLessThan(partial[0])
    expect(partial[0]).toBeLessThan(positions(bytes, 'KITCHEN TICKET')[0])
    expect(positions(bytes, 'KITCHEN TICKET')[0]).toBeLessThan(full[0])
  })

  it('leaves blank paper either side of the tear line, so the tickets tear apart cleanly by hand', () => {
    const bytes = encodeReceiptToEscPos(receiptThenStaff(receipt, staff))
    const handle = positions(bytes, '@unwnd.cafe')[0]
    const tear = positions(bytes, '- - - - - tear here - - - - -')[0]
    const partial = positions(bytes, PARTIAL_CUT)[0]
    const lineFeeds = (from: number, to: number) => bytes.slice(from, to).filter(b => b === 0x0a).length
    // Above the line: the receipt's handle and closing rule end their lines, then the gap. Below
    // it: the line's own end, then the gap. Three blank lines either side.
    expect(lineFeeds(handle, tear)).toBeGreaterThanOrEqual(5)
    expect(lineFeeds(tear, partial)).toBeGreaterThanOrEqual(4)
  })

  it('prints TAKE OUT white on black on the staff ticket, and DINE IN without the inversion', () => {
    const INVERT_ON = [0x1d, 0x42, 0x01]
    const INVERT_OFF = [0x1d, 0x42, 0x00]
    const takeOut = encodeReceiptToEscPos(buildReceiptDocument({ ...sale, audience: 'kitchen', orderType: 'take-out' }))
    const at = positions(takeOut, 'TAKE OUT')[0]
    expect(at).toBeGreaterThan(-1)
    expect(positions(takeOut, INVERT_ON).some(p => p < at)).toBe(true)
    expect(positions(takeOut, INVERT_OFF).some(p => p > at)).toBe(true)
    // Nothing after the banner prints inverted: the inversion ends before the next line's text.
    expect(positions(takeOut, INVERT_OFF)[0]).toBeLessThan(positions(takeOut, 'Juan')[0])

    const dineIn = encodeReceiptToEscPos(buildReceiptDocument({ ...sale, audience: 'kitchen', orderType: 'dine-in' }))
    expect(positions(dineIn, 'DINE IN')).toHaveLength(1)
    expect(positions(dineIn, INVERT_ON)).toHaveLength(0)
  })

  it('prints one ticket as before: no tear line, no partial cut, one full cut at the end', () => {
    const bytes = encodeReceiptToEscPos(receipt)
    expect(positions(bytes, 'tear here')).toHaveLength(0)
    expect(positions(bytes, PARTIAL_CUT)).toHaveLength(0)
    expect(positions(bytes, FULL_CUT)).toHaveLength(1)
  })
})

// The bytes of one printed row: from where `text` starts to the end of its line.
function rowOf(bytes: Uint8Array, text: string): number[] {
  const start = positions(bytes, text)[0]
  return [...bytes.slice(start, bytes.indexOf(0x0a, start))]
}
const controlBytes = (row: number[]) => row.filter(b => b < 0x20 || b === 0x7f)

describe('encodeReceiptToEscPos, text that could pass for printer commands', () => {
  it('prints the glyphs cp437 keeps in its control-code slots as ?, so a name never resets the printer or cuts the paper', () => {
    // As typed, ← is ESC, ↔ is GS and • is BEL in cp437, and NUL passes as itself: "←@" resets the
    // printer and "↔V" + NUL cuts the paper.
    const row = rowOf(encodeReceiptToEscPos([{ kind: 'detail', label: 'Name', value: '←@ ↔V\u0000 •' }]), 'Name')
    expect(controlBytes(row)).toEqual([])
    expect(String.fromCharCode(...row)).toMatch(/\?@ \?V\? \?$/)
  })

  it('does the same for any text on the receipt, an item’s note say', () => {
    const row = rowOf(encodeReceiptToEscPos([{ kind: 'itemNote', text: 'extra ↔V\u0000 shot' }]), 'extra')
    expect(controlBytes(row)).toEqual([])
    expect(String.fromCharCode(...row)).toContain('extra ?V? shot')
  })

  it('keeps the letters names are written with, ñ and é included', () => {
    const row = rowOf(encodeReceiptToEscPos([{ kind: 'detail', label: 'Name', value: 'Niño José' }]), 'Name')
    // cp437 has ñ at 0xA4 and é at 0x82.
    expect(row).toEqual(expect.arrayContaining([0xa4, 0x82]))
    expect(controlBytes(row)).toEqual([])
  })
})
