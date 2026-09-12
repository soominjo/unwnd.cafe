'use client'

import { useState } from 'react'
import { variantClass } from '../utils'
import type { Sale, SaleItem } from '../types'
import type { ReceiptBlock } from '@/lib/printer/receiptDocument'
import { buildReceiptBlocksFromSale } from '@/lib/printer/receiptFromSale'
import { printViaRawBT } from '@/lib/printer/printViaRawBT'
import { downloadReceiptPdf } from '@/lib/printer/buildReceiptPdf'
import { buildReceiptPdfFilename } from '@/lib/printer/receiptFilename'
import ReceiptPreviewModal from '../ReceiptPreviewModal'
import { formatPHTime } from './dateRange'
import { CheckIcon, DownloadIcon, PrinterIcon, TrashIcon } from './icons'
import { ActionButton, Badge, InlineConfirm, RemoveButton } from './ui'

export type OrdersMode = 'recent' | 'completed'

export interface OrderCardProps {
  order: Sale
  mode: OrdersMode
  isConfirming: boolean
  isDeleting: boolean
  isCompleting: boolean
  confirmItemKey: string | null
  deletingItemKey: string | null
  onRequestDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
  onRequestDeleteItem: (lineId: string) => void
  onCancelDeleteItem: () => void
  onConfirmDeleteItem: (lineId: string) => void
  onCompleteOrder: () => void
}

type ReceiptActionState = 'idle' | 'busy' | 'failed'

/** Staff (kitchen-ticket) print / PDF actions for one order, each with its own busy and failed state so a retry is one tap away. */
function useReceiptActions(order: Sale) {
  const [printState, setPrintState] = useState<ReceiptActionState>('idle')
  const [pdfState, setPdfState] = useState<ReceiptActionState>('idle')

  async function run(setState: (state: ReceiptActionState) => void, what: string, task: () => Promise<void>) {
    setState('busy')
    try {
      await task()
      setState('idle')
    } catch (error) {
      console.error(`${what} failed`, error)
      setState('failed')
    }
  }

  return {
    printState,
    pdfState,
    print: () => run(setPrintState, 'Receipt reprint', () => printViaRawBT(buildReceiptBlocksFromSale(order))),
    downloadPdf: () =>
      run(setPdfState, 'Receipt PDF download', () =>
        downloadReceiptPdf(buildReceiptBlocksFromSale(order), buildReceiptPdfFilename(order._createdAt)),
      ),
  }
}

const PRINT_LABELS: Record<ReceiptActionState, string> = { idle: 'Print Staff', busy: 'Printing…', failed: 'Retry print' }
const PDF_LABELS: Record<ReceiptActionState, string> = { idle: 'PDF', busy: 'Preparing…', failed: 'Retry PDF' }

export default function OrderCard(props: OrderCardProps) {
  const { order, mode, isConfirming, isDeleting, isCompleting, confirmItemKey, deletingItemKey } = props
  const receipt = useReceiptActions(order)
  const itemCount = order.items.reduce((sum, item) => sum + item.qty, 0)
  // Reuses the same preview/print/PDF flow the checkout receipt uses (ReceiptPreviewModal),
  // fed with the full customer receipt — logo, prices, thank-you footer — instead of the staff ticket.
  const [reprintBlocks, setReprintBlocks] = useState<ReceiptBlock[] | null>(null)

  return (
    <article
      className={`overflow-hidden rounded-lg border border-border bg-white/80 transition-opacity ${
        isDeleting ? 'pointer-events-none opacity-50' : ''
      }`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/70 bg-foreground/3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {order.notes ? (
            <Badge tone="name" className="max-w-48 truncate" title={order.notes}>
              {order.notes}
            </Badge>
          ) : (
            <span className="text-xs italic text-foreground/40">No name</span>
          )}
          <span className="whitespace-nowrap text-xs tabular-nums text-foreground/50">{formatPHTime(order._createdAt)}</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {mode === 'completed' ? <Badge tone="success">✓ Done</Badge> : <Badge tone="pending">Pending</Badge>}
          <span className="font-display text-base font-bold tabular-nums tracking-tight text-foreground">
            ₱{order.total.toLocaleString()}
          </span>
        </div>
      </header>

      <ul className="divide-y divide-border/60">
        {order.items.map((item) => {
          const itemKey = `${order._id}:${item.lineId}`
          return (
            <ItemRow
              key={item.lineId}
              item={item}
              isConfirming={confirmItemKey === itemKey}
              isDeleting={deletingItemKey === itemKey}
              onRequestRemove={() => props.onRequestDeleteItem(item.lineId)}
              onCancelRemove={props.onCancelDeleteItem}
              onConfirmRemove={() => props.onConfirmDeleteItem(item.lineId)}
            />
          )
        })}
      </ul>

      <footer className="border-t border-border/70 px-4 py-3">
        {isDeleting ? (
          <p className="text-[11px] uppercase tracking-widest text-foreground/40 animate-pulse">Deleting…</p>
        ) : isConfirming ? (
          <InlineConfirm
            message="Delete this order?"
            confirmLabel="Delete order"
            onCancel={props.onCancelDelete}
            onConfirm={props.onConfirmDelete}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {mode === 'recent' && (
              <ActionButton tone="success" icon={<CheckIcon />} busy={isCompleting} onClick={props.onCompleteOrder}>
                {isCompleting ? 'Completing…' : 'Complete'}
              </ActionButton>
            )}
            <ActionButton
              tone="neutral"
              icon={<PrinterIcon />}
              busy={receipt.printState === 'busy'}
              failed={receipt.printState === 'failed'}
              onClick={receipt.print}
              title="Print kitchen/staff ticket — no logo or prices"
            >
              {PRINT_LABELS[receipt.printState]}
            </ActionButton>
            <ActionButton
              tone="neutral"
              icon={<DownloadIcon />}
              busy={receipt.pdfState === 'busy'}
              failed={receipt.pdfState === 'failed'}
              onClick={receipt.downloadPdf}
              title="Download staff ticket PDF"
            >
              {PDF_LABELS[receipt.pdfState]}
            </ActionButton>
            <ActionButton
              tone="neutral"
              icon={<PrinterIcon />}
              onClick={() => setReprintBlocks(buildReceiptBlocksFromSale(order, 'customer'))}
              title="Reprint the full customer receipt"
            >
              Reprint
            </ActionButton>
            <span className="ml-auto hidden text-[11px] tabular-nums text-foreground/40 sm:inline">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </span>
            <ActionButton tone="danger" icon={<TrashIcon />} onClick={props.onRequestDelete} className="ml-auto sm:ml-2">
              Delete
            </ActionButton>
          </div>
        )}
      </footer>

      {reprintBlocks && <ReceiptPreviewModal blocks={reprintBlocks} onClose={() => setReprintBlocks(null)} />}
    </article>
  )
}

interface ItemRowProps {
  item: SaleItem
  isConfirming: boolean
  isDeleting: boolean
  onRequestRemove: () => void
  onCancelRemove: () => void
  onConfirmRemove: () => void
}

function ItemRow({ item, isConfirming, isDeleting, onRequestRemove, onCancelRemove, onConfirmRemove }: ItemRowProps) {
  if (isDeleting) {
    return <li className="px-4 py-3 text-[11px] uppercase tracking-widest text-foreground/35 animate-pulse">Removing…</li>
  }
  if (isConfirming) {
    return (
      <li className="px-4 py-2.5">
        <InlineConfirm
          message={
            <>
              Remove <strong className="font-semibold text-foreground">{item.name}</strong>?
            </>
          }
          confirmLabel="Remove"
          onCancel={onCancelRemove}
          onConfirm={onConfirmRemove}
        />
      </li>
    )
  }
  return (
    <li className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 px-4 py-2.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{item.name}</span>
          {item.variant && (
            <span className={`text-[10px] font-bold uppercase tracking-wider ${variantClass(item.variant)}`}>{item.variant}</span>
          )}
        </div>
        {item.note && <p className="mt-0.5 text-[11px] text-amber-700">{item.note}</p>}
      </div>
      <span className="text-xs tabular-nums text-foreground/50">×{item.qty}</span>
      <span className="w-20 text-right text-sm font-semibold tabular-nums text-foreground">
        ₱{(item.price * item.qty).toLocaleString()}
      </span>
      <RemoveButton aria-label={`Remove ${item.name}`} onClick={onRequestRemove} />
    </li>
  )
}
