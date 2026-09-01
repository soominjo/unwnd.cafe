import { encodeReceiptToEscPos } from './encodeReceipt'
import type { ReceiptBlock } from './receiptDocument'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * Hands raw ESC/POS bytes to the RawBT Android app via its `rawbt:` URL
 * scheme. RawBT owns the actual transport (Bluetooth classic/BLE, USB, or
 * WiFi) to whatever printer it's paired with, so this stays transport-agnostic.
 */
export function printViaRawBT(blocks: ReceiptBlock[]): void {
  const bytes = encodeReceiptToEscPos(blocks, { columns: 32 })
  window.location.href = `rawbt:base64,${bytesToBase64(bytes)}`
}
