import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder'
import type { ReceiptAssets } from './receiptAssets'
import { assertNeverBlock, type ReceiptBlock } from './receiptDocument'
import { RECEIPT_COLUMNS, THERMAL_COLUMNS, type ThermalColumns } from './thermalConfig'

export interface EncodeReceiptOptions {
  /** Characters per line: 32 for 58mm paper, 48 for 80mm paper. Defaults to THERMAL_COLUMNS. */
  columns?: ThermalColumns
  /**
   * Prefix used for money amounts when encoding to ESC/POS bytes. Defaults to
   * the letter "P" rather than "₱" — most thermal printers' default code pages
   * (e.g. CP437) have no glyph for the peso sign, and an unsupported character
   * can either be dropped or replaced with a garbled substitute on real paper.
   * The on-screen preview is not affected by this and always shows "₱".
   */
  currencyPrefix?: string
  /** Pre-rendered bitmaps for the logo and QR blocks (see rasterize.ts). A missing one degrades gracefully. */
  assets?: ReceiptAssets
  /** Bitmap transfer mode; the encoder's own default ('column') applies when omitted. */
  imageMode?: 'column' | 'raster'
}

type LogoBlock = Extract<ReceiptBlock, { kind: 'logo' }>
type TotalBlock = Extract<ReceiptBlock, { kind: 'total' }>
type ItemBlock = Extract<ReceiptBlock, { kind: 'item' }>
type ItemNoteBlock = Extract<ReceiptBlock, { kind: 'itemNote' }>
type DetailBlock = Extract<ReceiptBlock, { kind: 'detail' }>
type QrBlock = Extract<ReceiptBlock, { kind: 'qr' }>

interface EncodeContext {
  columns: ThermalColumns
  assets: ReceiptAssets
  money: (value: number) => string
}

// Everything prints in regular weight — no bold. Double-height text is
// reserved for the grand total (and the shop-name fallback when the logo
// bitmap is unavailable) so the receipt reads tall and airy rather than heavy.
const {
  qty: QTY_COLUMN,
  money: MONEY_COLUMN,
  detailLabel: DETAIL_LABEL_COLUMN,
  totalValue: TOTAL_VALUE_COLUMN,
} = RECEIPT_COLUMNS
/** Blank lines after the last rule so there is room to tear the paper off cleanly. */
const FEED_LINES_BEFORE_CUT = 4
/** Module width in dots (1–8) for the printer-drawn QR used when no bitmap is available. */
const NATIVE_QR_MODULE_SIZE = 6

/** Encodes a receipt document into raw ESC/POS bytes ready to send to a printer. */
export function encodeReceiptToEscPos(blocks: readonly ReceiptBlock[], options: EncodeReceiptOptions = {}): Uint8Array {
  const columns = options.columns ?? THERMAL_COLUMNS
  const currencyPrefix = options.currencyPrefix ?? 'P'
  const context: EncodeContext = {
    columns,
    assets: options.assets ?? {},
    money: (value) => `${currencyPrefix}${value.toFixed(2)}`,
  }

  const encoder = new ReceiptPrinterEncoder({
    language: 'esc-pos',
    columns,
    ...(options.imageMode ? { imageMode: options.imageMode } : {}),
  })
  encoder.initialize()

  for (const block of blocks) encodeBlock(encoder, block, context)

  return encoder.newline(FEED_LINES_BEFORE_CUT).cut().encode()
}

function encodeBlock(encoder: ReceiptPrinterEncoder, block: ReceiptBlock, context: EncodeContext): void {
  switch (block.kind) {
    case 'logo':
      encodeLogo(encoder, block, context)
      break
    case 'meta':
    case 'footer':
      encoder.align('center').line(block.text).align('left')
      break
    case 'rule':
      encoder.rule({ style: block.style ?? 'single' })
      break
    case 'detail':
      encodeDetail(encoder, block, context)
      break
    case 'item':
      encodeItem(encoder, block, context)
      break
    case 'itemNote':
      encodeItemNote(encoder, block, context)
      break
    case 'total':
      encodeTotal(encoder, block, context)
      break
    case 'spacer':
      encoder.newline(block.lines ?? 1)
      break
    case 'qr':
      encodeQr(encoder, block, context)
      break
    default:
      assertNeverBlock(block)
  }
}

function encodeLogo(encoder: ReceiptPrinterEncoder, block: LogoBlock, { assets }: EncodeContext): void {
  if (!assets.logo) {
    // Bitmap unavailable (failed to load) — the shop name stands in, double height.
    encoder.align('center').size(1, 2).line(block.fallbackText).size(1, 1).align('left')
    return
  }
  // The encoder already feeds one line after a bitmap, which is the gap we want.
  encoder.align('center').image(assets.logo, assets.logo.width, assets.logo.height, 'threshold').align('left')
}

function encodeDetail(encoder: ReceiptPrinterEncoder, block: DetailBlock, { columns }: EncodeContext): void {
  encoder.table(
    [
      { width: DETAIL_LABEL_COLUMN, align: 'left' },
      { width: columns - DETAIL_LABEL_COLUMN, align: 'right' },
    ],
    [[block.label, block.value]],
  )
}

function encodeItem(encoder: ReceiptPrinterEncoder, block: ItemBlock, { columns, money }: EncodeContext): void {
  const label = block.variant ? `${block.name} (${block.variant})` : block.name
  encoder.table(
    [
      { width: QTY_COLUMN, align: 'left' },
      { width: columns - QTY_COLUMN - MONEY_COLUMN, align: 'left' },
      { width: MONEY_COLUMN, align: 'right' },
    ],
    [[String(block.qty), label, money(block.lineTotal)]],
  )
}

function encodeItemNote(encoder: ReceiptPrinterEncoder, block: ItemNoteBlock, { columns }: EncodeContext): void {
  // Indented under the item name. A table cell keeps the indent — the encoder
  // trims leading spaces from plain lines — and wraps long notes in place.
  encoder.table(
    [
      { width: QTY_COLUMN, align: 'left' },
      { width: columns - QTY_COLUMN, align: 'left' },
    ],
    [['', `» ${block.text}`]],
  )
}

function encodeTotal(encoder: ReceiptPrinterEncoder, block: TotalBlock, { columns, money }: EncodeContext): void {
  const value = `${block.isDiscount ? '-' : ''}${money(block.value)}`
  const layout = [
    { width: columns - TOTAL_VALUE_COLUMN, align: 'right' as const },
    { width: TOTAL_VALUE_COLUMN, align: 'right' as const },
  ]
  // Double height, regular weight: taller strokes, not heavier ones.
  const stretched = (text: string) => (cell: ReceiptPrinterEncoder) => cell.size(1, 2).text(text).size(1, 1)
  encoder.table(layout, block.emphasis ? [[stretched(block.label), stretched(value)]] : [[block.label, value]])
}

function encodeQr(encoder: ReceiptPrinterEncoder, block: QrBlock, { assets }: EncodeContext): void {
  encoder.align('center')
  if (assets.qr) {
    encoder.image(assets.qr, assets.qr.width, assets.qr.height, 'threshold')
  } else {
    // Rasterising failed — let the printer draw the QR code itself.
    encoder.qrcode(block.url, { model: 2, size: NATIVE_QR_MODULE_SIZE, errorlevel: 'm' })
  }
  encoder.line(block.caption).align('left')
}
