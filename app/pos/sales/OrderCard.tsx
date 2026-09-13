'use client'

import { useState } from 'react'
import { variantClass, groupSaleItems } from '../utils'
import type { Sale, SaleItem } from '../types'
import type { ReceiptBlock } from '@/lib/printer/receiptDocument'
import { buildReceiptBlocksFromSale } from '@/lib/printer/receiptFromSale'
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

/** The staff ticket's PDF download, with its own busy/failed state so a retry is one tap away. */
function usePdfAction(order: Sale) {
  const [pdfState, setPdfState] = useState<ReceiptActionState>('idle')

  async function downloadPdf() {
    setPdfState('busy')
    try {
      await downloadReceiptPdf(buildReceiptBlocksFromSale(order), buildReceiptPdfFilename(order._createdAt))
      setPdfState('idle')
    } catch (error) {
      console.error('Receipt PDF download failed', error)
      setPdfState('failed')
    }
  }

  return { pdfState, downloadPdf }
}

const PDF_LABELS: Record<ReceiptActionState, string> = { idle: 'PDF', busy: 'Preparing…', failed: 'Retry PDF' }

export default function OrderCard(props: OrderCardProps) {
  const { order, mode, isConfirming, isDeleting, isCompleting, confirmItemKey, deletingItemKey } = props
  const { pdfState, downloadPdf } = usePdfAction(order)
  const itemCount = order.items.reduce((sum, item) => sum + (item.isAddon ? 0 : item.qty), 0)
  // Both "Print Staff" (kitchen ticket) and "Print" (full customer copy) preview before
  // printing, reusing the same ReceiptPreviewModal the checkout receipt uses.
  const [previewBlocks, setPreviewBlocks] = useState<ReceiptBlock[] | null>(null)
  const { topLevel, addonsByParent } = groupSaleItems(order.items)

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

      <div className="divide-y divide-border/60">
        {topLevel.map((item) => {
          const itemKey = `${order._id}:${item.lineId}`
          const addons = addonsByParent.get(item.lineId) ?? []
          return (
            <div key={item.lineId} className="px-4 py-2.5">
              <ItemRow
                item={item}
                isConfirming={confirmItemKey === itemKey}
                isDeleting={deletingItemKey === itemKey}
                onRequestRemove={() => props.onRequestDeleteItem(item.lineId)}
                onCancelRemove={props.onCancelDeleteItem}
                onConfirmRemove={() => props.onConfirmDeleteItem(item.lineId)}
              />
              {addons.length > 0 && (
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {addons.map((addon) => {
                    const addonKey = `${order._id}:${addon.lineId}`
                    return (
                      <AddonRow
                        key={addon.lineId}
                        addon={addon}
                        isConfirming={confirmItemKey === addonKey}
                        isDeleting={deletingItemKey === addonKey}
                        onRequestRemove={() => props.onRequestDeleteItem(addon.lineId)}
                        onCancelRemove={props.onCancelDeleteItem}
                        onConfirmRemove={() => props.onConfirmDeleteItem(addon.lineId)}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

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
              tone="amber"
              icon={<PrinterIcon />}
              onClick={() => setPreviewBlocks(buildReceiptBlocksFromSale(order))}
              title="Print kitchen/staff ticket — no logo or prices"
            >
              Print Staff
            </ActionButton>
            <ActionButton
              tone="rose"
              icon={<DownloadIcon />}
              busy={pdfState === 'busy'}
              failed={pdfState === 'failed'}
              onClick={downloadPdf}
              title="Download staff ticket PDF"
            >
              {PDF_LABELS[pdfState]}
            </ActionButton>
            <ActionButton
              tone="info"
              icon={<PrinterIcon />}
              onClick={() => setPreviewBlocks(buildReceiptBlocksFromSale(order, 'customer'))}
              title="Print the full customer receipt"
            >
              Print
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

      {previewBlocks && <ReceiptPreviewModal blocks={previewBlocks} onClose={() => setPreviewBlocks(null)} />}
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
    return <p className="text-[11px] uppercase tracking-widest text-foreground/35 animate-pulse">Removing…</p>
  }
  if (isConfirming) {
    return (
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
    )
  }
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4">
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
    </div>
  )
}

interface AddonRowProps {
  addon: SaleItem
  isConfirming: boolean
  isDeleting: boolean
  onRequestRemove: () => void
  onCancelRemove: () => void
  onConfirmRemove: () => void
}

/** An add-on nested under its parent item — a light-blue "+" chip rather than its own separate line/box. */
function AddonRow({ addon, isConfirming, isDeleting, onRequestRemove, onCancelRemove, onConfirmRemove }: AddonRowProps) {
  if (isDeleting) {
    return <p className="text-[11px] uppercase tracking-widest text-foreground/35 animate-pulse">Removing…</p>
  }
  if (isConfirming) {
    return (
      <InlineConfirm
        message={
          <>
            Remove <strong className="font-semibold text-foreground">{addon.name}</strong>?
          </>
        }
        confirmLabel="Remove"
        onCancel={onCancelRemove}
        onConfirm={onConfirmRemove}
      />
    )
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
        <span className="text-sky-500">+</span>
        {addon.name}
      </span>
      <div className="flex items-center gap-3">
        <span className="text-xs tabular-nums text-foreground/50">×{addon.qty}</span>
        <span className="w-16 text-right text-xs font-semibold tabular-nums text-foreground/80">
          ₱{(addon.price * addon.qty).toLocaleString()}
        </span>
        <RemoveButton aria-label={`Remove ${addon.name}`} onClick={onRequestRemove} />
      </div>
    </div>
  )
}
