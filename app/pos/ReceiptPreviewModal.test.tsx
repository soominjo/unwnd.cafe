import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Sale } from './types'
import { buildReceiptBlocksFromSale } from '@/lib/printer/receiptFromSale'
import ReceiptPreviewModal, { shownBlocks } from './ReceiptPreviewModal'

// ReceiptPreview sets up its font through Next's compiler-only loader when imported.
vi.mock('next/font/google', () => ({ IBM_Plex_Mono: () => ({ className: '' }) }))

const noop = () => {}
const sale: Sale = {
  _id: 'sale-1', _createdAt: '2026-10-01T14:41:00.000Z', total: 270, paymentAmount: 270, change: 0,
  items: [
    { lineId: 'tiramisu__ice', name: 'Tiramisu', variant: 'ice', price: 160, qty: 1 },
    { lineId: 'cafe-latte__hot__ak3j9', name: 'Cafe Latte', variant: 'hot', price: 110, qty: 1, addedAt: '2026-10-01T14:58:00.000Z' },
  ],
}
const added = buildReceiptBlocksFromSale(sale, 'kitchen', 'latest')
const whole = buildReceiptBlocksFromSale(sale, 'kitchen')

describe('ReceiptPreviewModal', () => {
  it('previews the first of several tickets, with a switch to the others', () => {
    const html = renderToStaticMarkup(
      <ReceiptPreviewModal blocks={added} choices={[{ label: 'Added items', blocks: added }, { label: 'Whole order', blocks: whole }]} onClose={noop} />,
    )
    expect(html).toMatch(/aria-pressed="true"[^>]*>Added items</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Whole order</)
    expect(html).toContain('ADDED TO ORDER')
    expect(html).not.toContain('Tiramisu')
  })

  it('offers a second switch on a choice with versions, starting on the first', () => {
    const html = renderToStaticMarkup(
      <ReceiptPreviewModal
        blocks={added}
        choices={[
          { label: 'Staff ticket', blocks: added, versions: [{ label: 'Added items', blocks: added }, { label: 'Whole order', blocks: whole }] },
          { label: 'Receipt', blocks: whole },
        ]}
        onClose={noop}
      />,
    )
    expect(html).toMatch(/aria-pressed="true"[^>]*>Staff ticket</)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Added items</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Whole order</)
    expect(html).not.toContain('Tiramisu')
  })

  it('shows the gap to tear at between two tickets of one print', () => {
    const html = renderToStaticMarkup(<ReceiptPreviewModal blocks={[...added, { kind: 'tear' }, ...whole]} onClose={noop} />)
    expect(html).toMatch(/role="separator" aria-label="Tear here"/)
    expect(html.indexOf('Tear here')).toBeGreaterThan(html.indexOf('Cafe Latte'))
    expect(html.indexOf('Tear here')).toBeLessThan(html.indexOf('Tiramisu'))
  })

  it('names the PDF as the customer’s receipt when it is given apart from what prints', () => {
    const both = [...added, { kind: 'tear' } as const, ...whole]
    expect(renderToStaticMarkup(<ReceiptPreviewModal blocks={both} receiptPdf={whole} onClose={noop} />)).toContain('⬇ Download receipt PDF')
    expect(renderToStaticMarkup(<ReceiptPreviewModal blocks={whole} onClose={noop} />)).toContain('⬇ Download PDF')
  })

  it('offers a print button per print, in place of Print and the PDF, each with what it prints', () => {
    const both = [...whole, { kind: 'tear' } as const, ...added]
    const html = renderToStaticMarkup(
      <ReceiptPreviewModal
        blocks={whole}
        prints={[{ label: '🖶 Print receipt', blocks: whole }, { label: '🖶 Print for kitchen', blocks: both, hint: 'Items only, no prices.' }]}
        onClose={noop}
      />,
    )
    expect(html).toContain('🖶 Print receipt</button>')
    expect(html).toContain('🖶 Print for kitchen</button>')
    expect(html).toContain('Items only, no prices.')
    expect(html).not.toContain('Print to Thermal Printer')
    expect(html).not.toContain('Download')
  })

  it('says the order is saved when it opens after a sale, and that ✕ goes on to the next order', () => {
    const html = renderToStaticMarkup(
      <ReceiptPreviewModal blocks={whole} prints={[{ label: 'Print receipt', blocks: whole }]} notice="Saved. Print what you need, then ✕ for the next order." onClose={noop} />,
    )
    expect(html).toContain('role="status"')
    expect(html).toContain('Saved. Print what you need, then ✕ for the next order.')
    expect(html).toContain('aria-label="Done: next order"')
    expect(renderToStaticMarkup(<ReceiptPreviewModal blocks={whole} onClose={noop} />)).toContain('aria-label="Close"')
  })

  it('shows one ticket with no switch, as before', () => {
    const html = renderToStaticMarkup(<ReceiptPreviewModal blocks={whole} onClose={noop} />)
    expect(html).not.toContain('Whole order')
    expect(html).toContain('Tiramisu')
  })
})

describe('shownBlocks', () => {
  const receipt = buildReceiptBlocksFromSale(sale, 'customer')
  const choices = [
    { label: 'Staff ticket', blocks: added, versions: [{ label: 'Added items', blocks: added }, { label: 'Whole order', blocks: whole }] },
    { label: 'Receipt', blocks: receipt },
  ]

  it('shows the version picked of a choice with versions, else the choice itself', () => {
    expect(shownBlocks(added, choices, 0, 0)).toBe(added)
    expect(shownBlocks(added, choices, 0, 1)).toBe(whole)
    // The version picked stays picked; a choice without versions shows itself.
    expect(shownBlocks(added, choices, 1, 1)).toBe(receipt)
  })

  it('shows the one print when there is nothing to choose', () => {
    expect(shownBlocks(whole, undefined, 0, 0)).toBe(whole)
  })
})
