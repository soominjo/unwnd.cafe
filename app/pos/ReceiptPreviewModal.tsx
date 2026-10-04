'use client'

import { useState } from 'react'
import type { ReceiptBlock } from '@/lib/printer/receiptDocument'
import { downloadReceiptPdf } from '@/lib/printer/buildReceiptPdf'
import { printViaRawBT } from '@/lib/printer/printViaRawBT'
import { buildReceiptPdfFilename } from '@/lib/printer/receiptFilename'
import { THERMAL_COLUMNS, paperLabel } from '@/lib/printer/thermalConfig'
import ReceiptPreview from './ReceiptPreview'

/** A version of a choice, e.g. an order's added items or its whole order. */
export interface ReceiptVersion {
  label: string
  blocks: ReceiptBlock[]
}

/** One thing the preview can print, e.g. the staff ticket, the receipt, or both. */
export interface ReceiptChoice extends ReceiptVersion {
  /** Versions to switch between under the choices; the first shows first, in place of `blocks`. */
  versions?: ReceiptVersion[]
}

/** A print button of its own, e.g. the kitchen ticket or the receipt. */
export interface ReceiptPrint {
  label: string
  /** What the button prints, which can be more than the preview shows. */
  blocks: ReceiptBlock[]
  /** A line under the button saying what it prints, when the label can't. */
  hint?: string
}

interface ReceiptPreviewModalProps {
  blocks: ReceiptBlock[]
  /** Things to switch between; the first shows first, in place of `blocks`. */
  choices?: ReceiptChoice[]
  /** The time a downloaded PDF is named after (a reprint's order time); now when absent. */
  pdfTime?: string
  /**
   * The customer's receipt, which Download PDF saves whatever prints: a PDF is for emailing the
   * customer, never the staff ticket. Without it the PDF is what prints.
   */
  receiptPdf?: ReceiptBlock[]
  /**
   * Print buttons in place of Print and Download PDF, each printing its own ticket: after a sale,
   * the kitchen ticket and the receipt. The preview stays open after a print, so the other can
   * be printed too, and marks each one printed; ✕ closes it. The preview shows `blocks`.
   */
  prints?: ReceiptPrint[]
  /** A line under the title, such as that the order is saved and closing this skips printing. */
  notice?: string
  onClose: () => void
}

/** The print button being prepared (by its place), or the PDF. */
type PendingAction = number | 'pdf' | null

const PRINT_BUTTON = 'w-full text-xs uppercase tracking-widest py-3 active:scale-[0.99] transition-all rounded-sm disabled:opacity-50 disabled:cursor-not-allowed'
const MAIN_PRINT = 'bg-foreground text-cream font-bold hover:bg-foreground/90'
const OTHER_PRINT = 'border border-foreground/20 text-foreground/70 font-semibold hover:border-foreground/35 hover:text-foreground hover:bg-foreground/4'

const SWITCH_BUTTON = 'flex-1 rounded-sm border px-3 font-bold uppercase tracking-widest transition-colors disabled:opacity-50'

/** What the preview shows, and so prints: the version picked of the choice picked, else that choice, else the one print. */
export function shownBlocks(only: ReceiptBlock[], choices: ReceiptChoice[] | undefined, chosen: number, version: number): ReceiptBlock[] {
  const choice = choices?.[chosen]
  return choice?.versions?.[version]?.blocks ?? choice?.blocks ?? only
}

export default function ReceiptPreviewModal({ blocks: onlyBlocks, choices, pdfTime, receiptPdf, prints, notice, onClose }: ReceiptPreviewModalProps) {
  const [pending, setPending] = useState<PendingAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [chosen, setChosen] = useState(0)
  // Kept across choices that share versions, such as the staff ticket and both.
  const [version, setVersion] = useState(0)
  // The print buttons of a sale already printed (by place): each can be printed again.
  const [printed, setPrinted] = useState<ReadonlySet<number>>(() => new Set())
  const versions = choices?.[chosen]?.versions
  // What is previewed is what prints, unless the preview has print buttons of its own.
  const blocks = shownBlocks(onlyBlocks, choices, chosen, version)
  const printButtons: ReceiptPrint[] = prints ?? [{ label: '🖶 Print to Thermal Printer', blocks }]
  // After a sale this is the last step, so only ✕ closes it, never a stray tap beside it; and
  // nothing closes it while a print is being prepared.
  const closesOnBackdrop = !prints && pending === null

  async function handleDownloadPdf() {
    if (pending !== null) return
    setPending('pdf')
    setError(null)
    try {
      await downloadReceiptPdf(receiptPdf ?? blocks, buildReceiptPdfFilename(pdfTime))
    } catch (err) {
      console.error('Receipt PDF failed', err)
      setError('Failed to generate PDF. Try again.')
    } finally {
      setPending(null)
    }
  }

  async function handlePrint(index: number) {
    if (pending !== null) return
    setPending(index)
    setError(null)
    try {
      await printViaRawBT(printButtons[index].blocks)
      // A sale's prints stay open for the other ticket; any other print is done.
      if (prints) setPrinted(done => new Set(done).add(index))
      else onClose()
    } catch (err) {
      console.error('Thermal print failed', err)
      setError('Could not prepare the receipt for printing. Try again.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/50" onClick={closesOnBackdrop ? onClose : undefined} />
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
            disabled={pending !== null}
            aria-label={prints ? 'Done: next order' : 'Close'}
            title={prints ? 'Done: next order' : 'Close'}
            className="text-foreground/60 hover:text-foreground text-xl leading-none w-10 h-10 -mr-2 flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ✕
          </button>
        </div>
        {notice && <p role="status" className="px-5 pt-3 text-xs font-semibold text-emerald-700 shrink-0">{notice}</p>}

        {choices && choices.length > 1 && (
          <div role="group" aria-label="What to print" className="flex gap-1.5 px-5 pt-3 shrink-0">
            {choices.map((option, i) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={i === chosen}
                onClick={() => { setChosen(i); setError(null) }}
                disabled={pending !== null}
                className={`${SWITCH_BUTTON} py-2 text-[11px] ${
                  i === chosen ? 'bg-foreground text-cream border-foreground' : 'border-foreground/20 text-foreground/65 hover:border-foreground/40'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        {versions && versions.length > 1 && (
          <div role="group" aria-label="Which items the staff ticket lists" className="flex gap-1.5 px-5 pt-2 shrink-0">
            {versions.map((option, i) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={i === version}
                onClick={() => { setVersion(i); setError(null) }}
                disabled={pending !== null}
                className={`${SWITCH_BUTTON} py-1.5 text-[10px] ${
                  i === version ? 'bg-sky-100 text-sky-800 border-sky-300' : 'border-foreground/15 text-foreground/55 hover:border-foreground/35'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        <div className="overflow-y-auto py-4 bg-foreground/[0.03]">
          <ReceiptPreview blocks={blocks} columns={THERMAL_COLUMNS} />
        </div>

        <div className="px-5 py-4 border-t border-foreground/10 shrink-0 space-y-2">
          {error && (
            <p className="text-[10px] text-red-500 uppercase tracking-widest font-medium text-center">{error}</p>
          )}
          {printButtons.map((print, i) => (
            <div key={print.label}>
              <button
                onClick={() => handlePrint(i)}
                disabled={pending !== null}
                className={`${PRINT_BUTTON} ${i === 0 ? MAIN_PRINT : OTHER_PRINT}`}
              >
                {pending === i ? 'Preparing…' : print.label}
                {printed.has(i) && pending !== i && (
                  <span className="ml-2">
                    <span className="sr-only">, </span>✓ Printed
                  </span>
                )}
              </button>
              {print.hint && <p className="mt-1 text-[10px] text-foreground/50 text-center">{print.hint}</p>}
            </div>
          ))}
          {prints && (
            <p className="sr-only" aria-live="polite">
              {printButtons.filter((_, i) => printed.has(i)).map(print => `${print.label}: sent to the printer.`).join(' ')}
            </p>
          )}
          {!prints && (
            <button
              onClick={handleDownloadPdf}
              disabled={pending !== null}
              className={`${PRINT_BUTTON} ${OTHER_PRINT}`}
            >
              {pending === 'pdf' ? 'Preparing PDF…' : receiptPdf ? '⬇ Download receipt PDF' : '⬇ Download PDF'}
            </button>
          )}
          <p className="text-[10px] text-foreground/40 text-center">
            {prints
              ? 'Thermal print needs the RawBT app on this device.'
              : 'Thermal print needs the RawBT app on this device · PDF downloads as a full page, handy for emailing.'}
          </p>
        </div>
      </div>
    </div>
  )
}
