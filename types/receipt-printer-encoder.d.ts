// @point-of-sale/receipt-printer-encoder ships no type declarations (pure JS
// package) — this covers only the subset of its API used by lib/printer/encodeReceipt.ts.
declare module '@point-of-sale/receipt-printer-encoder' {
  export type ReceiptEncoderAlign = 'left' | 'center' | 'right'
  export type ReceiptEncoderLanguage = 'esc-pos' | 'star-prnt' | 'star-line'
  export type ReceiptEncoderRuleStyle = 'single' | 'double'
  export type ReceiptEncoderCutMode = 'partial' | 'full'

  export interface ReceiptPrinterEncoderOptions {
    language?: ReceiptEncoderLanguage
    printerModel?: string
    columns?: number
    feedBeforeCut?: number
    newline?: string
    imageMode?: 'column' | 'raster'
  }

  export interface ReceiptEncoderTableColumn {
    width: number
    marginLeft?: number
    marginRight?: number
    align?: 'left' | 'right'
    verticalAlign?: 'top' | 'bottom'
  }

  export type ReceiptEncoderTableCell = string | ((encoder: ReceiptPrinterEncoder) => ReceiptPrinterEncoder)

  export default class ReceiptPrinterEncoder {
    constructor(options?: ReceiptPrinterEncoderOptions)
    initialize(): this
    text(value: string): this
    line(value: string): this
    newline(count?: number): this
    align(value: ReceiptEncoderAlign): this
    bold(value?: boolean): this
    italic(value?: boolean): this
    underline(value?: boolean): this
    size(width: number, height?: number): this
    width(value: number): this
    height(value: number): this
    rule(options?: { style?: ReceiptEncoderRuleStyle }): this
    table(columns: ReceiptEncoderTableColumn[], data: ReceiptEncoderTableCell[][]): this
    cut(value?: ReceiptEncoderCutMode): this
    raw(data: number[]): this
    encode(): Uint8Array
  }
}
