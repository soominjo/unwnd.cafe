'use client'

import type { ReceiptBlock } from '@/lib/printer/receiptDocument'
import ReceiptPreview from './ReceiptPreview'

interface ReceiptPreviewModalProps {
  blocks: ReceiptBlock[]
  onClose: () => void
}

export default function ReceiptPreviewModal({ blocks, onClose }: ReceiptPreviewModalProps) {
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
          <button
            onClick={() => window.print()}
            className="w-full bg-foreground text-cream text-xs uppercase tracking-widest py-3 font-bold hover:bg-foreground/90 active:scale-[0.99] transition-all rounded-sm"
          >
            Print / Save as PDF
          </button>
          <p className="text-[10px] text-foreground/40 text-center">
            No receipt printer connected yet — this prints via your browser.
          </p>
        </div>
      </div>
    </div>
  )
}
