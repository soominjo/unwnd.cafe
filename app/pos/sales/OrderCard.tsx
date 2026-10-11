'use client'

import { useRef, useState, type FormEvent } from 'react'
import { variantClass, groupSaleItems } from '../utils'
import type { Sale, SaleItem } from '../types'
import { saleRounds, type SaleRound } from '@/lib/sales/rounds'
import { buildReceiptBlocksFromSale } from '@/lib/printer/receiptFromSale'
import { MAX_NOTES_LENGTH } from '@/lib/sales/validateSaleInput'
import ReceiptPreviewModal from '../ReceiptPreviewModal'
import QtyBadge from '../QtyBadge'
import { formatPHClock, formatPHTime } from './dateRange'
import { CheckIcon, PencilIcon, PlusIcon, PrinterIcon, StampCardIcon, TrashIcon } from './icons'
import { printChoices } from './printChoices'
import { ActionButton, Badge, InlineConfirm, RemoveButton } from './ui'
import OrderPayments from './OrderPayments'
import OrderTypeBadge from './OrderTypeBadge'
import type { PaymentMethod } from '@/lib/sales/payments'

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
  /** Opens the order on the POS to add the customer's follow-up to it. */
  onAddItems: () => void
  /** Saves the order's name (empty clears it): resolves to null when done, else to why it wasn't saved. */
  onRename: (name: string) => Promise<string | null>
  /** Moves one payment to the method it was really taken by: null when done, else why not. */
  onChangeMethod: (paymentKey: string, method: PaymentMethod) => Promise<string | null>
}

export default function OrderCard(props: OrderCardProps) {
  const { order, mode, isConfirming, isDeleting, isCompleting } = props
  const itemCount = order.items.reduce((sum, item) => sum + (item.isAddon ? 0 : item.qty), 0)
  // One Print button: its sheet previews the staff ticket, the receipt or both, and prints
  // them or downloads a PDF, reusing the ReceiptPreviewModal the checkout receipt uses.
  const [printing, setPrinting] = useState(false)
  // The first checkout's lines, then each group added later with Add items.
  const rounds = saleRounds(order.items)
  const lastAddedAt = rounds[rounds.length - 1]?.addedAt ?? null

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
          {mode === 'completed' ? <Badge tone="success">✓ Done</Badge> : <Badge tone="pending">Pending</Badge>}
          <span className="font-display text-base font-bold tabular-nums tracking-tight text-foreground">
            ₱{order.total.toLocaleString()}
          </span>
        </div>
      </header>

      <OrderPayments order={order} onChangeMethod={props.onChangeMethod} />

      {rounds.map((round) => (
        <OrderRound key={round.addedAt ?? 'first'} round={round} {...props} />
      ))}

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
            {mode === 'recent' && (
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
          className="h-9 w-44 rounded-md border border-foreground/25 bg-white px-2.5 text-sm text-foreground read-only:bg-foreground/5 focus:border-foreground/50 focus:outline-none"
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

interface OrderRoundProps extends OrderCardProps {
  round: SaleRound<SaleItem>
}

/** One group of the order's lines: the first checkout's, or one added later under the time it was added. */
function OrderRound({ round, order, confirmItemKey, deletingItemKey, ...props }: OrderRoundProps) {
  const { topLevel, addonsByParent } = groupSaleItems(round.items)
  const roundItems = round.items.reduce((sum, item) => sum + (item.isAddon ? 0 : item.qty), 0)
  return (
    <div>
      {round.addedAt && (
        <p className="border-y border-sky-200 bg-sky-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700">
          Added {formatPHClock(round.addedAt)} · {roundItems} {roundItems === 1 ? 'item' : 'items'}
        </p>
      )}
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
    </div>
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
      {/* Every line gets the quantity mark, ×1 included, so the count reads at a glance while preparing. */}
      <QtyBadge qty={item.qty} className="min-w-11" />
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
      <span className="inline-flex w-fit items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold text-foreground">
        <span>+</span>
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
