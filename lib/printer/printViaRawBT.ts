import { encodeReceiptToEscPos } from './encodeReceipt'
import { renderReceiptAssets } from './rasterize'
import type { ReceiptBlock } from './receiptDocument'
import { THERMAL_COLUMNS, THERMAL_IMAGE_MODE } from './thermalConfig'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * Hands raw ESC/POS bytes to the RawBT Android app via its `rawbt:` URL
 * scheme. RawBT owns the actual transport (Bluetooth classic/BLE, USB, or
 * WiFi) to whatever printer it's paired with, so this stays transport-agnostic.
 *
 * Async because the logo and QR code are rasterised in the browser first.
 */
export async function printViaRawBT(blocks: readonly ReceiptBlock[]): Promise<void> {
  const assets = await renderReceiptAssets(blocks, THERMAL_COLUMNS)
  const bytes = encodeReceiptToEscPos(blocks, { columns: THERMAL_COLUMNS, assets, imageMode: THERMAL_IMAGE_MODE })
  window.location.href = `rawbt:base64,${bytesToBase64(bytes)}`
}
