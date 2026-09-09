// Pre-rendered bitmaps that accompany a ReceiptBlock[] to the ESC/POS encoder.
// Rasterising needs a canvas (browser); encoding does not. Keeping the two
// apart lets encodeReceipt.ts stay DOM-free and unit-testable.

/** RGBA pixel buffer in the exact shape the receipt-printer-encoder accepts. */
export interface RasterImage {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface ReceiptAssets {
  logo?: RasterImage
  qr?: RasterImage
}
