'use client'

import { useState } from 'react'
import type { ReceiptBlock } from '@/lib/printer/receiptDocument'
import { downloadReceiptPdf } from '@/lib/printer/buildReceiptPdf'
import { printViaRawBT } from '@/lib/printer/printViaRawBT'
import { buildReceiptPdfFilename } from '@/lib/printer/receiptFilename'
import { THERMAL_COLUMNS, paperLabel } from '@/lib/printer/thermalConfig'
import ReceiptPreview from './ReceiptPreview'

interface ReceiptPreviewModalProps {
  blocks: ReceiptBlock[]
  onClose: () => void
}

type PendingAction = 'thermal' | 'pdf' | null

export default function ReceiptPreviewModal({ blocks, onClose }: ReceiptPreviewModalProps) {
  const [pending, setPending] = useState<PendingAction>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDownloadPdf() {
    if (pending) return
    setPending('pdf')
    setError(null)
    try {
      await downloadReceiptPdf(blocks, buildReceiptPdfFilename())
    } catch (err) {
      console.error('Receipt PDF failed', err)
      setError('Failed to generate PDF. Try again.')
    } finally {
      setPending(null)
    }
  }

  async function handlePrintThermal() {
    if (pending) return
    setPending('thermal')
    setError(null)
    try {
      await printViaRawBT(blocks)
      onClose()
    } catch (err) {
      console.error('Thermal print failed', err)
      setError('Could not prepare the receipt for printing. Try again.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-50 bg-white border border-foreground/12 rounded-sm shadow-2xl w-full max-w-sm max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/10 shrink-0">
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/55 font-semibold">Receipt Preview</p>
            <span className="text-[9px] uppercase tracking-widest text-foreground/40 font-semibold bg-foreground/5 border border-foreground/10 rounded-full px-2 py-0.5">
              {paperLabel(THERMAL_COLUMNS)} · {THERMAL_COLUMNS} col
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-foreground/50 hover:text-foreground text-xl leading-none w-8 h-8 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto py-4 bg-foreground/[0.03]">
          <ReceiptPreview blocks={blocks} columns={THERMAL_COLUMNS} />
        </div>

        <div className="px-5 py-4 border-t border-foreground/10 shrink-0 space-y-2">
          {error && (
            <p className="text-[10px] text-red-500 uppercase tracking-widest font-medium text-center">{error}</p>
          )}
          <button
            onClick={handlePrintThermal}
            disabled={pending !== null}
            className="w-full bg-foreground text-cream text-xs uppercase tracking-widest py-3 font-bold hover:bg-foreground/90 active:scale-[0.99] transition-all rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending === 'thermal' ? 'Preparing receipt…' : '🖶 Print to Thermal Printer'}
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={pending !== null}
            className="w-full border border-foreground/20 text-foreground/70 text-xs uppercase tracking-widest py-3 font-semibold hover:border-foreground/35 hover:text-foreground hover:bg-foreground/4 active:scale-[0.99] transition-all rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending === 'pdf' ? 'Preparing PDF…' : '⬇ Download PDF'}
          </button>
          <p className="text-[10px] text-foreground/40 text-center">
            Thermal print needs the RawBT app on this device · PDF downloads as a full page, handy for emailing.
          </p>
        </div>
      </div>
    </div>
  )
}
