import type { ReceiptBlock } from './receiptDocument'

// A4 in millimeters — a full page, as opposed to the 32/48-char thermal-strip
// layout ReceiptPreview.tsx renders. Meant for emailing a receipt to a
// customer, not for the receipt printer.
const PAGE_WIDTH_MM    = 210
const PAGE_HEIGHT_MM   = 297
const MARGIN_MM        = 20
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2

// jsPDF's built-in core fonts use WinAnsiEncoding, which has no glyph for "₱" —
// the same constraint the ESC/POS thermal encoder works around (see
// encodeReceipt.ts). The on-screen preview is unaffected and always shows "₱".
function formatMoney(value: number): string {
  return `P${value.toFixed(2)}`
}

/** Renders a receipt document as a full-page (A4) PDF and triggers a browser download. */
export async function downloadReceiptPdf(blocks: ReceiptBlock[], filename: string): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  let y = MARGIN_MM

  function ensureRoom(mm: number): void {
    if (y + mm > PAGE_HEIGHT_MM - MARGIN_MM) {
      doc.addPage()
      y = MARGIN_MM
    }
  }

  for (const block of blocks) {
    ensureRoom(16)
    switch (block.kind) {
      case 'heading':
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(20)
        doc.setTextColor(0)
        doc.text(block.text, PAGE_WIDTH_MM / 2, y, { align: 'center' })
        y += 8
        break

      case 'meta':
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(110)
        doc.text(block.text, PAGE_WIDTH_MM / 2, y, { align: 'center' })
        doc.setTextColor(0)
        y += 9
        break

      case 'rule':
        doc.setDrawColor(200)
        doc.line(MARGIN_MM, y, PAGE_WIDTH_MM - MARGIN_MM, y)
        y += 6
        break

      case 'item': {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(11)
        const label = block.variant ? `${block.name} (${block.variant})` : block.name
        const lines = doc.splitTextToSize(label, CONTENT_WIDTH_MM - 45)
        doc.text(lines, MARGIN_MM, y)
        doc.text(`${block.qty}x`, PAGE_WIDTH_MM - MARGIN_MM - 28, y, { align: 'right' })
        doc.text(formatMoney(block.lineTotal), PAGE_WIDTH_MM - MARGIN_MM, y, { align: 'right' })
        y += lines.length * 5.5 + 2
        break
      }

      case 'total': {
        const bold = !!block.emphasis
        doc.setFont('helvetica', bold ? 'bold' : 'normal')
        doc.setFontSize(bold ? 13 : 11)
        if (block.isDiscount) {
          doc.setTextColor(16, 122, 70)
        }
        const value = `${block.isDiscount ? '-' : ''}${formatMoney(block.value)}`
        doc.text(block.label, MARGIN_MM, y)
        doc.text(value, PAGE_WIDTH_MM - MARGIN_MM, y, { align: 'right' })
        doc.setTextColor(0)
        y += bold ? 9 : 7
        break
      }

      case 'note': {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(10)
        const lines = doc.splitTextToSize(`Note: ${block.text}`, CONTENT_WIDTH_MM)
        doc.text(lines, MARGIN_MM, y)
        y += lines.length * 5 + 3
        break
      }

      case 'footer':
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(140)
        doc.text(block.text, PAGE_WIDTH_MM / 2, y, { align: 'center' })
        doc.setTextColor(0)
        y += 8
        break
    }
  }

  doc.save(filename)
}
