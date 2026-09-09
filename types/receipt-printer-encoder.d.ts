// @point-of-sale/receipt-printer-encoder ships no type declarations (pure JS
// package) — this covers only the subset of its API used by lib/printer/encodeReceipt.ts.
declare module '@point-of-sale/receipt-printer-encoder' {
  export type ReceiptEncoderAlign = 'left' | 'center' | 'right'
  export type ReceiptEncoderLanguage = 'esc-pos' | 'star-prnt' | 'star-line'
  export type ReceiptEncoderRuleStyle = 'single' | 'double'
  export type ReceiptEncoderCutMode = 'partial' | 'full'
  export type ReceiptEncoderFont = 'A' | 'B' | 'C'
  export type ReceiptEncoderImageAlgorithm = 'threshold' | 'bayer' | 'floydsteinberg' | 'atkinson'
  export type ReceiptEncoderQrErrorLevel = 'l' | 'm' | 'q' | 'h'

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

  /** A plain RGBA pixel buffer; the encoder also accepts browser ImageData, <img> and <canvas> elements. */
  export interface ReceiptEncoderRasterImage {
    width: number
    height: number
    data: Uint8ClampedArray | Uint8Array
  }

  export type ReceiptEncoderImageSource = ReceiptEncoderRasterImage | ImageData | HTMLImageElement | HTMLCanvasElement

  /** Only `model` has a library default; the encoder throws if `size` or `errorlevel` is missing. */
  export interface ReceiptEncoderQrCodeOptions {
    model?: 1 | 2
    /** Module width in dots, 1–8. */
    size: number
    errorlevel: ReceiptEncoderQrErrorLevel
  }

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
    invert(value?: boolean): this
    font(value: ReceiptEncoderFont): this
    size(width: number, height?: number): this
    width(value: number): this
    height(value: number): this
    rule(options?: { style?: ReceiptEncoderRuleStyle }): this
    table(columns: ReceiptEncoderTableColumn[], data: ReceiptEncoderTableCell[][]): this
    /** `width` and `height` must be multiples of 8; the source is resized to fit them. */
    image(
      source: ReceiptEncoderImageSource,
      width: number,
      height: number,
      algorithm?: ReceiptEncoderImageAlgorithm,
      threshold?: number,
    ): this
    qrcode(value: string, options?: ReceiptEncoderQrCodeOptions): this
    cut(value?: ReceiptEncoderCutMode): this
    raw(data: number[]): this
    encode(): Uint8Array
  }
}
