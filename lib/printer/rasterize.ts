import { create as createQrCode } from 'qrcode'
import logoAsset from '@/app/icon.jpg'
import type { RasterImage, ReceiptAssets } from './receiptAssets'
import type { ReceiptBlock } from './receiptDocument'
import { THERMAL_IMAGE_SIZES, type ThermalColumns } from './thermalConfig'

// Browser-only. Turns the brand logo and the review QR code into bitmaps sized
// for the thermal printer. The very same canvases back the on-screen preview,
// so what the cashier sees is pixel-for-pixel what the printer receives.

export interface Bitmap {
  canvas: HTMLCanvasElement
  image: RasterImage
}

export interface LogoOptions {
  /** Snap to pure black/white (thermal). Pass false for full-colour output (PDF). */
  monochrome?: boolean
}

export interface ReceiptBitmaps {
  logo?: Bitmap
  qr?: Bitmap
}

export interface RenderBitmapsOptions {
  logoSize: number
  qrSize: number
  monochromeLogo?: boolean
}

type QrBlock = Extract<ReceiptBlock, { kind: 'qr' }>

/** Luminance (0–255) below which a pixel prints black. */
const BLACK_THRESHOLD = 128
/** Fraction of the artwork's shorter side that fills the disc — zooms the wordmark in a little. */
const LOGO_CROP_FRACTION = 0.9
/** Standard QR quiet zone, in modules. */
const QR_QUIET_ZONE = 4
const QR_ERROR_CORRECTION = 'M'

function assertMultipleOfEight(value: number, what: string): void {
  if (value % 8 !== 0) throw new Error(`${what} must be a multiple of 8 dots, got ${value}`)
}

function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas is not available in this browser')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  return { canvas, ctx }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

function readPixels(ctx: CanvasRenderingContext2D, width: number, height: number): RasterImage {
  return { width, height, data: new Uint8ClampedArray(ctx.getImageData(0, 0, width, height).data) }
}

/** Flattens onto white and snaps every pixel to black or white, writing the result back to the canvas. */
function toMonochrome(ctx: CanvasRenderingContext2D, width: number, height: number): RasterImage {
  const source = ctx.getImageData(0, 0, width, height).data
  const data = new Uint8ClampedArray(source.length)
  for (let i = 0; i < source.length; i += 4) {
    const alpha = source[i + 3] / 255
    const luminance =
      (0.299 * source[i] + 0.587 * source[i + 1] + 0.114 * source[i + 2]) * alpha + 255 * (1 - alpha)
    const value = luminance < BLACK_THRESHOLD ? 0 : 255
    data[i] = value
    data[i + 1] = value
    data[i + 2] = value
    data[i + 3] = 255
  }
  ctx.putImageData(new ImageData(data, width, height), 0, 0)
  return { width, height, data }
}

/**
 * The round brand mark: the icon artwork cropped to a centred square and
 * clipped to a disc, so it prints as a solid disc with the wordmark knocked out.
 */
export async function renderLogoBitmap(size: number, { monochrome = true }: LogoOptions = {}): Promise<Bitmap> {
  assertMultipleOfEight(size, 'Logo size')
  const artwork = await loadImage(logoAsset.src)
  const { canvas, ctx } = createCanvas(size, size)

  // The source file is a portrait tile with the wordmark in its vertical
  // centre — a centred square crop keeps the text in the middle of the disc.
  const side = Math.min(artwork.naturalWidth, artwork.naturalHeight) * LOGO_CROP_FRACTION
  const sx = (artwork.naturalWidth - side) / 2
  const sy = (artwork.naturalHeight - side) / 2
  ctx.save()
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(artwork, sx, sy, side, side, 0, 0, size, size)
  ctx.restore()

  return { canvas, image: monochrome ? toMonochrome(ctx, size, size) : readPixels(ctx, size, size) }
}

/**
 * A QR code drawn with whole-dot modules (no anti-aliasing) so every module
 * edge lands exactly on a printer dot. `targetSize` is an upper bound; the
 * canvas is padded up to a byte boundary with the symbol centred in the slack.
 */
export async function renderQrBitmap(text: string, targetSize: number): Promise<Bitmap> {
  const { modules } = createQrCode(text, { errorCorrectionLevel: QR_ERROR_CORRECTION })
  const totalModules = modules.size + QR_QUIET_ZONE * 2
  const scale = Math.max(1, Math.floor(targetSize / totalModules))
  const symbolSize = totalModules * scale
  const side = Math.ceil(symbolSize / 8) * 8
  const offset = Math.floor((side - symbolSize) / 2) + QR_QUIET_ZONE * scale

  const { canvas, ctx } = createCanvas(side, side)
  ctx.fillStyle = '#000000'
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(row, col)) ctx.fillRect(offset + col * scale, offset + row * scale, scale, scale)
    }
  }
  return { canvas, image: toMonochrome(ctx, side, side) }
}

function isQrBlock(block: ReceiptBlock): block is QrBlock {
  return block.kind === 'qr'
}

function skipWithWarning(what: string) {
  return (error: unknown): undefined => {
    console.warn(`Receipt ${what} could not be rendered; continuing without it.`, error)
    return undefined
  }
}

/** Renders whichever of the logo / QR blocks the document contains. A failed asset is skipped, never fatal. */
export async function renderReceiptBitmaps(
  blocks: readonly ReceiptBlock[],
  options: RenderBitmapsOptions,
): Promise<ReceiptBitmaps> {
  const wantsLogo = blocks.some((block) => block.kind === 'logo')
  const qrBlock = blocks.find(isQrBlock)

  const [logo, qr] = await Promise.all([
    wantsLogo
      ? renderLogoBitmap(options.logoSize, { monochrome: options.monochromeLogo ?? true }).catch(skipWithWarning('logo'))
      : undefined,
    qrBlock ? renderQrBitmap(qrBlock.url, options.qrSize).catch(skipWithWarning('QR code')) : undefined,
  ])
  return { logo, qr }
}

/** The 1-bit bitmaps the ESC/POS encoder needs, sized for the given paper width. */
export async function renderReceiptAssets(blocks: readonly ReceiptBlock[], columns: ThermalColumns): Promise<ReceiptAssets> {
  const sizes = THERMAL_IMAGE_SIZES[columns]
  const bitmaps = await renderReceiptBitmaps(blocks, { logoSize: sizes.logo, qrSize: sizes.qr })
  return { logo: bitmaps.logo?.image, qr: bitmaps.qr?.image }
}
