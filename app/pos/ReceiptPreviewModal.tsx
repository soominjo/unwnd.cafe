'use client'

import { useState } from 'react'
import type { ReceiptBlock } from '@/lib/printer/receiptDocument'
import { downloadReceiptPdf } from '@/lib/printer/buildReceiptPdf'
import { printViaRawBT } from '@/lib/printer/printViaRawBT'
import ReceiptPreview from './ReceiptPreview'

interface ReceiptPreviewModalProps {
  blocks: ReceiptBlock[]
  onClose: () => void
}

function buildPdfFilename(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
  return `unwnd-receipt-${stamp}.pdf`
}

export default function ReceiptPreviewModal({ blocks, onClose }: ReceiptPreviewModalProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  async function handleDownloadPdf() {
    if (isDownloading) return
    setIsDownloading(true)
    setDownloadError(null)
    try {
      await downloadReceiptPdf(blocks, buildPdfFilename())
    } catch {
      setDownloadError('Failed to generate PDF. Try again.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 bg-white border border-foreground/12 rounded-sm shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/10 shrink-0">
          <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/55 font-semibold">Receipt Preview</p>
          <button
            onClick={onClose}
            className="text-foreground/50 hover:text-foreground text-xl leading-none w-8 h-8 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto py-4">
          <ReceiptPreview blocks={blocks} />
        </div>

        <div className="px-5 py-4 border-t border-foreground/10 shrink-0 space-y-2">
          {downloadError && (
            <p className="text-[10px] text-red-500 uppercase tracking-widest font-medium text-center">{downloadError}</p>
          )}
          <button
            onClick={() => printViaRawBT(blocks)}
            className="w-full bg-foreground text-cream text-xs uppercase tracking-widest py-3 font-bold hover:bg-foreground/90 active:scale-[0.99] transition-all rounded-sm"
          >
            🖶 Print to Thermal Printer
          </button>
          <button
            onClick={() => window.print()}
            className="w-full border border-foreground/20 text-foreground/70 text-xs uppercase tracking-widest py-3 font-semibold hover:border-foreground/35 hover:text-foreground hover:bg-foreground/4 active:scale-[0.99] transition-all rounded-sm"
          >
            🖨 Print via Browser
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="w-full border border-foreground/20 text-foreground/70 text-xs uppercase tracking-widest py-3 font-semibold hover:border-foreground/35 hover:text-foreground hover:bg-foreground/4 active:scale-[0.99] transition-all rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? 'Preparing PDF…' : '⬇ Download PDF'}
          </button>
          <p className="text-[10px] text-foreground/40 text-center">
            Thermal print needs the RawBT app on this device · Browser print uses the system dialog · PDF downloads as a full page, handy for emailing.
          </p>
        </div>
      </div>
    </div>
  )
}
