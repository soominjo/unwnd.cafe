/**
 * File name for a downloaded receipt PDF, stamped with the sale's local date
 * and time (defaults to now, for a receipt downloaded straight from checkout).
 */
export function buildReceiptPdfFilename(createdAt: Date | string = new Date()): string {
  const d = typeof createdAt === 'string' ? new Date(createdAt) : createdAt
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
  return `unwnd-receipt-${stamp}.pdf`
}
