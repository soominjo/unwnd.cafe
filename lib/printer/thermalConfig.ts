// Physical parameters of the thermal receipt printer. Everything that has to
// agree between the ESC/POS encoder, the on-screen preview, and the raster
// assets (logo, QR code) reads from here.

export type ThermalColumns = 32 | 48

/** Characters per line: 32 for 58 mm paper, 48 for 80 mm paper. */
export const THERMAL_COLUMNS: ThermalColumns = 32

/** ESC/POS Font A is 12 dots wide, so a 32-column line spans 384 printable dots. */
export const DOTS_PER_COLUMN = 12

/**
 * Fixed column widths of the receipt body, in characters. Shared by the ESC/POS
 * encoder and the on-screen preview so the two can never drift apart; whatever
 * is left of the line goes to each row's flexible (name / label) column.
 */
export const RECEIPT_COLUMNS = {
  qty: 3,
  money: 10,
  detailLabel: 12,
  totalValue: 12,
} as const

/**
 * How bitmaps are sent to the printer. The cheap 58 mm Bluetooth printers
 * RawBT is usually paired with reliably support raster mode (GS v 0); switch
 * to 'column' (ESC *) if a printer prints images as garbage or with gaps.
 */
export const THERMAL_IMAGE_MODE: 'column' | 'raster' = 'raster'

export interface ThermalImageSizes {
  logo: number
  qr: number
}

/**
 * Bitmap edge lengths in printer dots, per paper width. ESC/POS packs 8 dots
 * per byte, so every value must be a multiple of 8.
 */
export const THERMAL_IMAGE_SIZES: Record<ThermalColumns, ThermalImageSizes> = {
  32: { logo: 216, qr: 208 },
  48: { logo: 288, qr: 256 },
}

export function paperLabel(columns: ThermalColumns): string {
  return columns === 32 ? '58mm' : '80mm'
}
