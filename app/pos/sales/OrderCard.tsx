'use client'

import { useRef, useState, type FormEvent } from 'react'
import type { Sale, SaleItem } from '../types'
import { saleRounds } from '@/lib/sales/rounds'
import { splitServed } from '@/lib/sales/served'
import { buildReceiptBlocksFromSale } from '@/lib/printer/receiptFromSale'
import { MAX_NOTES_LENGTH } from '@/lib/sales/validateSaleInput'
import ReceiptPreviewModal from '../ReceiptPreviewModal'
import { formatPHClock, formatPHTime } from './dateRange'
import { CheckIcon, ChevronRightIcon, PencilIcon, PlusIcon, PrinterIcon, StampCardIcon, TrashIcon } from './icons'
import { printChoices } from './printChoices'
import { ActionButton, Badge, InlineConfirm } from './ui'
import OrderLines from './OrderLines'
import OrderPayments from './OrderPayments'
import OrderTypeBadge from './OrderTypeBadge'
import type { PaymentMethod } from '@/lib/sales/payments'

export type OrdersMode = 'recent' | 'completed'

export interface OrderCardProps {
  order: Sale
  /** Recent orders shows the order's lines still to serve; Completed shows those that went out. */
  mode: OrdersMode
  isConfirming: boolean
  isDeleting: boolean
  confirmItemKey: string | null
  deletingItemKey: string | null
  onRequestDelete: () => void
  onCancelDelete: () => void
  onConfirmDelete: () => void
  onRequestDeleteItem: (lineId: string) => void
  onCancelDeleteItem: () => void
  onConfirmDeleteItem: (lineId: string) => void
  /** Ticks every line still to serve: the order is complete. */
  onCompleteOrder: () => void
  /** Ticks a line as gone out to the customer (its check under Recent orders). */
  onServeLine: (lineId: string) => void
  /** Sends a line that went out back to Recent orders (its filled check under Completed). */
  onUnserveLine: (lineId: string) => void
  /** Opens the other tab, where the rest of this order is. */
  onOpenOtherTab: () => void
  /** Opens the order on the POS to add the customer's follow-up to it. */
  onAddItems: () => void
  /** Saves the order's name (empty clears it): resolves to null when done, else to why it wasn't saved. */
  onRename: (name: string) => Promise<string | null>
  /** Moves one payment to the method it was really taken by: null when done, else why not. */
  onChangeMethod: (paymentKey: string, method: PaymentMethod) => Promise<string | null>
}

export default function OrderCard(props: OrderCardProps) {
  const { order, mode, isConfirming, isDeleting } = props
  const itemCount = order.items.reduce((sum, item) => sum + (item.isAddon ? 0 : item.qty), 0)
  // One Print button: its sheet previews the staff ticket, the receipt or both, and prints
  // them or downloads a PDF, reusing the ReceiptPreviewModal the checkout receipt uses.
  const [printing, setPrinting] = useState(false)
  // When the customer's follow-up was last added with Add items: the order's, whichever tab shows it.
  const rounds = saleRounds(order.items)
  const lastAddedAt = rounds[rounds.length - 1]?.addedAt ?? null
  // The order's two halves: what is still to serve (Recent orders) and what went out (Completed).
  const split = splitServed(order)
  const servedCount = split.served.length
  const lineCount = servedCount + split.toServe.length
  const partlyServed = servedCount > 0 && split.toServe.length > 0
  const recent = mode === 'recent'

  return (
    <article
      className={`overflow-hidden rounded-lg border border-border bg-white/80 transition-opacity ${
        isDeleting ? 'pointer-events-none opacity-50' : ''
      }`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/70 bg-foreground/3 px-4 py-3">
        {/* On a phone the name, time and Added badge wrap whole onto a second line rather than break. */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          <OrderName order={order} onRename={props.onRename} />
          <span className="whitespace-nowrap text-xs tabular-nums text-foreground/50">{formatPHTime(order._createdAt)}</span>
          {order.orderType && <OrderTypeBadge type={order.orderType} />}
          {lastAddedAt && <Badge tone="added" className="whitespace-nowrap">+ Added {formatPHClock(lastAddedAt)}</Badge>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <ServedBadge mode={mode} served={servedCount} lines={lineCount} />
          <span className="font-display text-base font-bold tabular-nums tracking-tight text-foreground">
            ₱{order.total.toLocaleString()}
          </span>
        </div>
      </header>

      {partlyServed && <ServedBar served={servedCount} lines={lineCount} />}

      <OrderPayments order={order} onChangeMethod={props.onChangeMethod} />

      {recent && servedCount > 0 && <OutStrip count={servedCount} onOpen={props.onOpenOtherTab} />}

      <OrderLines
        orderId={order._id}
        lines={recent ? split.toServeLines : split.servedLines}
        served={!recent}
        confirmItemKey={props.confirmItemKey}
        deletingItemKey={props.deletingItemKey}
        onToggleServed={recent ? props.onServeLine : props.onUnserveLine}
        onRequestDeleteItem={props.onRequestDeleteItem}
        onCancelDeleteItem={props.onCancelDeleteItem}
        onConfirmDeleteItem={props.onConfirmDeleteItem}
      />

      {!recent && split.toServe.length > 0 && <LeftStrip lines={split.toServe} onOpen={props.onOpenOtherTab} />}

      <footer className="border-t border-border/70 px-4 py-3">
        {isDeleting ? (
          <p className="text-[11px] uppercase tracking-widest text-foreground/40 animate-pulse">Deleting…</p>
        ) : isConfirming ? (
          <InlineConfirm
            // Part of it is under the other tab: say that Delete takes the whole order.
            message={partlyServed ? `Delete the whole order (${itemCount} ${itemCount === 1 ? 'item' : 'items'})?` : 'Delete this order?'}
            confirmLabel="Delete order"
            onCancel={props.onCancelDelete}
            onConfirm={props.onConfirmDelete}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {recent && (
              <ActionButton tone="success" icon={<CheckIcon />} onClick={props.onCompleteOrder} title="Tick everything still to serve">
                Complete
              </ActionButton>
            )}
            {recent && (
              <ActionButton tone="add" icon={<PlusIcon />} onClick={props.onAddItems} title="Open this order on the POS to add the customer’s follow-up to it">
                Add items
              </ActionButton>
            )}
            <ActionButton
              tone="info"
              icon={<PrinterIcon />}
              onClick={() => setPrinting(true)}
              title="Print the staff ticket, the receipt or both, or download a PDF"
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

      {printing && <PrintSheet order={order} onClose={() => setPrinting(false)} />}
    </article>
  )
}

// A tap on the name extends past the small chip, so it is an easy target on the tablet (the
// header's padding holds the overhang); the chip itself stays the size of the badges beside it.
const NAME_TAP_AREA = "relative after:absolute after:-inset-2 after:content-['']"

// The customer's name on the card. A tap edits it in place (an empty name clears it); an order on
// a loyalty card keeps the card holder's name, so it can't be changed here.
function OrderName({ order, onRename }: { order: Sale; onRename: OrderCardProps['onRename'] }) {
  const [draft, setDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set when the field closes on Cancel, so focus returns to the name rather than the page.
  const refocus = useRef(false)
  const name = order.notes?.trim() ?? ''

  function focusOnReturn(button: HTMLButtonElement | null) {
    if (!button || !refocus.current) return
    refocus.current = false
    button.focus()
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (draft === null || saving) return
    const next = draft.trim()
    // Saved as it was: nothing to send, and no reload of the list.
    if (next === name) {
      setDraft(null)
      setError(null)
      return
    }
    setSaving(true)
    setError(null)
    const problem = await onRename(next)
    setSaving(false)
    if (problem) setError(problem)
    else setDraft(null)
  }

  function cancel() {
    refocus.current = true
    setDraft(null)
    setError(null)
  }

  if (order.loyaltyMemberId) {
    return name ? (
      <Badge tone="name" className="max-w-48 truncate" title={`${name}: on a loyalty card, so the name stays the card holder’s`}>
        {name}
        <StampCardIcon width={12} height={12} className="ml-1.5 inline-block align-[-2px] opacity-70" />
        <span className="sr-only">, on a loyalty card</span>
      </Badge>
    ) : (
      <span className="text-xs italic text-foreground/40">No name</span>
    )
  }
  if (draft !== null) {
    return (
      <form onSubmit={save} className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          aria-label="Customer name"
          placeholder="Customer name"
          value={draft}
          maxLength={MAX_NOTES_LENGTH}
          // Held while the name saves: text typed meanwhile would be dropped unseen.
          readOnly={saving}
          onChange={e => setDraft(e.target.value)}
          className="h-9 w-44 rounded-md border border-foreground/25 bg-white px-2.5 text-sm max-sm:text-base text-foreground read-only:bg-foreground/5 focus:border-foreground/50 focus:outline-none"
        />
        <ActionButton tone="primary" type="submit" busy={saving}>Save</ActionButton>
        <ActionButton tone="ghost" onClick={cancel} disabled={saving}>Cancel</ActionButton>
        {error && <span role="alert" className="text-xs font-semibold text-red-700">{error}</span>}
      </form>
    )
  }
  return name ? (
    <button
      ref={focusOnReturn}
      type="button"
      onClick={() => setDraft(name)}
      aria-label={`Change the name on this order: ${name}`}
      className={`${NAME_TAP_AREA} inline-flex max-w-52 items-center gap-1.5 rounded-md bg-[#d4ede1] px-2.5 py-1 text-[11px] font-semibold leading-none text-[#1f5c3c] hover:bg-[#c3e4d3]`}
    >
      <span className="truncate">{name}</span>
      <PencilIcon width={11} height={11} className="shrink-0 opacity-60" />
    </button>
  ) : (
    <button
      ref={focusOnReturn}
      type="button"
      onClick={() => setDraft('')}
      aria-label="No name: add a name to this order"
      className={`${NAME_TAP_AREA} inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-1 text-xs italic text-foreground/40 hover:bg-foreground/5 hover:text-foreground/70`}
    >
      No name
      <PencilIcon width={11} height={11} className="opacity-60" />
    </button>
  )
}

/** The order's Print sheet: it opens on the staff ticket, with the receipt and both a tap away. Its PDF is the receipt. */
function PrintSheet({ order, onClose }: { order: Sale; onClose: () => void }) {
  const choices = printChoices(order)
  return (
    <ReceiptPreviewModal
      blocks={choices[0].blocks}
      choices={choices}
      pdfTime={order._createdAt}
      receiptPdf={buildReceiptBlocksFromSale(order, 'customer')}
      onClose={onClose}
    />
  )
}

interface ServedBadgeProps {
  mode: OrdersMode
  /** Top-level lines that went out, and all of them: one tick covers a whole line. */
  served: number
  lines: number
}

/** The order's state at the card's top right: Pending, "3 of 4 served", or Done once everything is out. */
function ServedBadge({ mode, served, lines }: ServedBadgeProps) {
  if (mode === 'completed' && served === lines) return <Badge tone="success">✓ Done</Badge>
  if (served === 0) return <Badge tone="pending">Pending</Badge>
  return <Badge tone="pending" className="whitespace-nowrap">{`${served} of ${lines} served`}</Badge>
}

/** A thin bar under the header of a partly served order: how much of it is out. */
function ServedBar({ served, lines }: { served: number; lines: number }) {
  return (
    <div aria-hidden="true" className="h-1 bg-foreground/8">
      <div className="h-full bg-emerald-600 transition-[width] duration-200" style={{ width: `${Math.round((served / lines) * 100)}%` }} />
    </div>
  )
}

const STRIP = 'flex min-h-11 w-full items-center justify-between gap-2 px-4 py-2 text-left text-[13px] font-semibold transition-colors'

/** Above a Recent card's lines: how many of its items already went out. A tap opens Completed. */
function OutStrip({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className={`${STRIP} border-b border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100`}>
      <span className="inline-flex items-center gap-2">
        <CheckIcon strokeWidth={2.4} className="shrink-0" />
        {`${count} ${count === 1 ? 'item' : 'items'} already out, in Completed`}
      </span>
      <ChevronRightIcon className="shrink-0" />
    </button>
  )
}

/** Under a Completed card's lines: what is still to serve. A tap opens Recent orders. */
function LeftStrip({ lines, onOpen }: { lines: readonly SaleItem[]; onOpen: () => void }) {
  const names = lines.map(line => (line.qty > 1 ? `${line.name} ×${line.qty}` : line.name)).join(', ')
  return (
    <button type="button" onClick={onOpen} className={`${STRIP} border-t border-dashed border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100`}>
      <span className="min-w-0">{`${lines.length} still to serve: ${names}`}</span>
      <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold uppercase tracking-[0.12em]">
        In Recent
        <ChevronRightIcon />
      </span>
    </button>
  )
}
