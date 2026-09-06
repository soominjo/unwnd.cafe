import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder'
import type { ReceiptBlock } from './receiptDocument'

export interface EncodeReceiptOptions {
  /** Characters per line: 32 for 58mm paper, 48 for 80mm paper. */
  columns?: 32 | 48
  /**
   * Prefix used for money amounts when encoding to ESC/POS bytes. Defaults to
   * the letter "P" rather than "₱" — most thermal printers' default code pages
   * (e.g. CP437) have no glyph for the peso sign, and an unsupported character
   * can either be dropped or replaced with a garbled substitute on real paper.
   * The on-screen preview is not affected by this and always shows "₱".
   */
  currencyPrefix?: string
}

/** Encodes a receipt document into raw ESC/POS bytes ready to send to a printer. */
export function encodeReceiptToEscPos(blocks: ReceiptBlock[], options: EncodeReceiptOptions = {}): Uint8Array {
  const columns = options.columns ?? 32
  const currencyPrefix = options.currencyPrefix ?? 'P'
  const money = (value: number) => `${currencyPrefix}${value.toFixed(2)}`

  const encoder = new ReceiptPrinterEncoder({ language: 'esc-pos', columns })
  encoder.initialize()

  for (const block of blocks) {
    switch (block.kind) {
      case 'heading':
        encoder.align('center').bold(true).size(2, 2).line(block.text).size(1, 1).bold(false).align('left')
        break
      case 'meta':
        encoder.align('center').line(block.text).align('left')
        break
      case 'rule':
        encoder.rule({ style: block.style ?? 'single' })
        break
      case 'item': {
        const label = block.variant ? `${block.name} (${block.variant})` : block.name
        encoder.table(
          [
            { width: columns - 14, align: 'left' },
            { width: 4, align: 'right' },
            { width: 10, align: 'right' },
          ],
          [[label, `${block.qty}x`, money(block.lineTotal)]],
        )
        break
      }
      case 'itemNote':
        encoder.line(`  » ${block.text}`)
        break
      case 'total': {
        const value = `${block.isDiscount ? '-' : ''}${money(block.value)}`
        encoder.table(
          [
            { width: columns - 10, align: 'left' },
            { width: 10, align: 'right' },
          ],
          block.emphasis
            ? [[(enc) => enc.bold().text(block.label).bold(), (enc) => enc.bold().text(value).bold()]]
            : [[block.label, value]],
        )
        break
      }
      case 'note':
        encoder.line(`Note: ${block.text}`)
        break
      case 'footer':
        encoder.newline().align('center').line(block.text).align('left')
        break
    }
  }

  return encoder.newline(3).cut().encode()
}
