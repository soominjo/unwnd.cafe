import type { jsPDF as PdfDocument } from 'jspdf'
import { renderReceiptBitmaps, type ReceiptBitmaps } from './rasterize'
import { assertNeverBlock, type ReceiptBlock } from './receiptDocument'

// A4 in millimetres — a full page, as opposed to the 32/48-char thermal-strip
// layout ReceiptPreview.tsx renders. Meant for emailing a receipt to a
// customer, not for the receipt printer.
const PAGE_WIDTH_MM = 210
const PAGE_HEIGHT_MM = 297
const MARGIN_MM = 20
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - MARGIN_MM * 2
const CENTER_X_MM = PAGE_WIDTH_MM / 2
const RIGHT_X_MM = PAGE_WIDTH_MM - MARGIN_MM

const LOGO_MM = 32
const QR_MM = 28
/** Source bitmap sizes in pixels — generous so the PDF stays crisp when zoomed. */
const LOGO_SOURCE_PX = 320
const QR_SOURCE_PX = 320

const QTY_COLUMN_MM = 10
const MONEY_COLUMN_MM = 30
const DETAIL_LABEL_MM = 35
const ITEM_NAME_WIDTH_MM = CONTENT_WIDTH_MM - QTY_COLUMN_MM - MONEY_COLUMN_MM
const ITEM_NOTE_WIDTH_MM = CONTENT_WIDTH_MM - QTY_COLUMN_MM
const DETAIL_VALUE_WIDTH_MM = CONTENT_WIDTH_MM - DETAIL_LABEL_MM
const LINE_HEIGHT_MM = 5.5
const NOTE_LINE_MM = 5
const DETAIL_LINE_MM = 6
const SPACER_MM = 5
/** Vertical room a single-line block needs before a new page is started for it. */
const DEFAULT_BLOCK_MM = 16

const INK = 0
const MUTED = 110
const DISCOUNT_RGB: [number, number, number] = [16, 122, 70]
const LINK_RGB: [number, number, number] = [0, 82, 160]

type FontStyle = 'normal' | 'italic'
type LogoBlock = Extract<ReceiptBlock, { kind: 'logo' }>
type ItemBlock = Extract<ReceiptBlock, { kind: 'item' }>
type TotalBlock = Extract<ReceiptBlock, { kind: 'total' }>
type DetailBlock = Extract<ReceiptBlock, { kind: 'detail' }>
type QrBlock = Extract<ReceiptBlock, { kind: 'qr' }>

// jsPDF's built-in core fonts use WinAnsiEncoding, which has no glyph for "₱" —
// the same constraint the ESC/POS thermal encoder works around (see
// encodeReceipt.ts). The on-screen preview is unaffected and always shows "₱".
function formatMoney(value: number): string {
  return `P${value.toFixed(2)}`
}

function setText(doc: PdfDocument, size: number, style: FontStyle = 'normal', gray = INK): void {
  doc.setFont('helvetica', style)
  doc.setFontSize(size)
  doc.setTextColor(gray)
}

function itemLabel(block: ItemBlock): string {
  return block.variant ? `${block.name} (${block.variant})` : block.name
}

// Wrapping helpers apply the font the text will be drawn in, then split it to
// the column width. Used both to measure a block for pagination and to draw it,
// so the two can never disagree.
function wrapItem(doc: PdfDocument, block: ItemBlock): string[] {
  setText(doc, 11)
  const width = block.lineTotal === null ? ITEM_NAME_WIDTH_MM + MONEY_COLUMN_MM : ITEM_NAME_WIDTH_MM
  return doc.splitTextToSize(itemLabel(block), width)
}

function wrapItemNote(doc: PdfDocument, text: string): string[] {
  setText(doc, 9.5, 'italic', MUTED)
  return doc.splitTextToSize(`» ${text}`, ITEM_NOTE_WIDTH_MM)
}

/** Detail values (e.g. a long customer name) wrap under the right-aligned column rather than running into the label. */
function wrapDetailValue(doc: PdfDocument, block: DetailBlock): string[] {
  setText(doc, 10.5)
  return doc.splitTextToSize(block.value, DETAIL_VALUE_WIDTH_MM)
}

const itemHeightMm = (lines: string[]) => lines.length * LINE_HEIGHT_MM + 2
const itemNoteHeightMm = (lines: string[]) => lines.length * NOTE_LINE_MM + 2
const detailHeightMm = (lines: string[]) => lines.length * DETAIL_LINE_MM

/** Vertical room a block will take, measured with the same wrapping the draw step uses. */
function roomNeeded(doc: PdfDocument, block: ReceiptBlock): number {
  switch (block.kind) {
    case 'logo':
      return LOGO_MM + 8
    case 'qr':
      return QR_MM + 18
    case 'item':
      return itemHeightMm(wrapItem(doc, block))
    case 'itemNote':
      return itemNoteHeightMm(wrapItemNote(doc, block.text))
    case 'detail':
      return detailHeightMm(wrapDetailValue(doc, block))
    default:
      return DEFAULT_BLOCK_MM
  }
}

/** Renders a receipt document as a full-page (A4) PDF and triggers a browser download. */
export async function downloadReceiptPdf(blocks: readonly ReceiptBlock[], filename: string): Promise<void> {
  const [{ jsPDF }, bitmaps] = await Promise.all([
    import('jspdf'),
    renderReceiptBitmaps(blocks, { logoSize: LOGO_SOURCE_PX, qrSize: QR_SOURCE_PX, monochromeLogo: false }),
  ])
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  let y = MARGIN_MM
  for (const block of blocks) {
    if (y + roomNeeded(doc, block) > PAGE_HEIGHT_MM - MARGIN_MM) {
      doc.addPage()
      y = MARGIN_MM
    }
    y = drawBlock(doc, block, y, bitmaps)
  }

  doc.save(filename)
}

/** Draws one block at vertical position `y` and returns where the next block starts. */
function drawBlock(doc: PdfDocument, block: ReceiptBlock, y: number, bitmaps: ReceiptBitmaps): number {
  switch (block.kind) {
    case 'logo':
      return drawLogo(doc, block, y, bitmaps)
    case 'meta':
      setText(doc, 10, 'normal', MUTED)
      doc.text(block.text, CENTER_X_MM, y, { align: 'center' })
      return y + LINE_HEIGHT_MM
    case 'rule':
      doc.setDrawColor(200)
      doc.setLineWidth(block.style === 'double' ? 0.6 : 0.2)
      doc.line(MARGIN_MM, y, RIGHT_X_MM, y)
      return y + 6
    case 'detail':
      return drawDetail(doc, block, y)
    case 'item':
      return drawItem(doc, block, y)
    case 'itemNote':
      return drawItemNote(doc, block.text, y)
    case 'total':
      return drawTotal(doc, block, y)
    case 'spacer':
      return y + (block.lines ?? 1) * SPACER_MM
    case 'qr':
      return drawQr(doc, block, y, bitmaps)
    case 'footer':
      setText(doc, 11)
      doc.text(block.text, CENTER_X_MM, y, { align: 'center' })
      return y + 7
    default:
      return assertNeverBlock(block)
  }
}

function drawLogo(doc: PdfDocument, block: LogoBlock, y: number, bitmaps: ReceiptBitmaps): number {
  if (!bitmaps.logo) {
    // Bitmap unavailable — the shop name stands in for it.
    setText(doc, 20)
    doc.text(block.fallbackText, CENTER_X_MM, y, { align: 'center' })
    return y + 9
  }
  doc.addImage(bitmaps.logo.canvas, 'PNG', CENTER_X_MM - LOGO_MM / 2, y, LOGO_MM, LOGO_MM)
  return y + LOGO_MM + 8
}

function drawDetail(doc: PdfDocument, block: DetailBlock, y: number): number {
  const lines = wrapDetailValue(doc, block)
  doc.setTextColor(MUTED)
  doc.text(block.label, MARGIN_MM, y)
  doc.setTextColor(INK)
  doc.text(lines, RIGHT_X_MM, y, { align: 'right' })
  return y + detailHeightMm(lines)
}

function drawItem(doc: PdfDocument, block: ItemBlock, y: number): number {
  const lines = wrapItem(doc, block)
  doc.text(String(block.qty), MARGIN_MM, y)
  doc.text(lines, MARGIN_MM + QTY_COLUMN_MM, y)
  if (block.lineTotal !== null) doc.text(formatMoney(block.lineTotal), RIGHT_X_MM, y, { align: 'right' })
  return y + itemHeightMm(lines)
}

function drawItemNote(doc: PdfDocument, text: string, y: number): number {
  const lines = wrapItemNote(doc, text)
  doc.text(lines, MARGIN_MM + QTY_COLUMN_MM, y)
  return y + itemNoteHeightMm(lines)
}

function drawTotal(doc: PdfDocument, block: TotalBlock, y: number): number {
  const emphasis = block.emphasis === true
  // The grand total is larger, never bolder — matching the thermal print.
  setText(doc, emphasis ? 14 : 11)
  if (block.isDiscount) doc.setTextColor(...DISCOUNT_RGB)
  const value = `${block.isDiscount ? '-' : ''}${formatMoney(block.value)}`
  doc.text(block.label, RIGHT_X_MM - MONEY_COLUMN_MM - 4, y, { align: 'right' })
  doc.text(value, RIGHT_X_MM, y, { align: 'right' })
  doc.setTextColor(INK)
  return y + (emphasis ? 9 : 7)
}

function drawQr(doc: PdfDocument, block: QrBlock, y: number, bitmaps: ReceiptBitmaps): number {
  let next = y
  if (bitmaps.qr) {
    doc.addImage(bitmaps.qr.canvas, 'PNG', CENTER_X_MM - QR_MM / 2, y, QR_MM, QR_MM)
    next += QR_MM + 5
  }
  setText(doc, 9.5, 'normal', MUTED)
  doc.text(block.caption, CENTER_X_MM, next, { align: 'center' })
  // A tappable link keeps the review reachable on screen, where a QR code can't be scanned.
  setText(doc, 9)
  doc.setTextColor(...LINK_RGB)
  doc.textWithLink(block.url, CENTER_X_MM - doc.getTextWidth(block.url) / 2, next + 5, { url: block.url })
  doc.setTextColor(INK)
  return next + 12
}
