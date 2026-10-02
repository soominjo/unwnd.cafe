'use client'

import {
  LOYALTY_CARD_SIZE,
  addOrderToTotals,
  cardState,
  isNearMiss,
  loyaltyKey,
  matchCardHolders,
  nextMilestone,
  type CardHolderWithCard,
} from '@/lib/loyalty'
import LoyaltyBar from './LoyaltyBar'
import type { OrderItem, Variant } from './types'

/** The loyalty 10%: one unit of one classic drink in the order, which the cashier picks. */
export interface LoyaltyTenControls {
  /** The order's Espresso and Non-Coffee drinks the 10% can go on. */
  lines: readonly OrderItem[]
  /** The drink the 10% is on, or null. */
  lineId: string | null
  /** The cashier tapped "Use 10% off" and is picking the drink. */
  choosing: boolean
  onStart: () => void
  onPick: (lineId: string) => void
  onCancel: () => void
  onClear: () => void
}

export interface CustomerNameFieldProps {
  value: string
  disabled: boolean
  onChange: (value: string) => void
  /** Loyalty card holders to suggest; null when they could not be loaded, and the field is a plain name. */
  holders: CardHolderWithCard[] | null
  /** The card holder this order is linked to, if any. */
  linked: CardHolderWithCard | null
  onLink: (holder: CardHolderWithCard) => void
  onUnlink: () => void
  /** Stamps the order on screen adds to a linked card. */
  orderStamps: number
  ten: LoyaltyTenControls
  /** The order has an Espresso or Non-Coffee drink that could be the free one. */
  hasFreeDrinkLine: boolean
  freeActive: boolean
}

const MAX_NAME_LENGTH = 100
const CARD_NUMBER_TYPED = /^(?:no\.?\s*|#)?\d+$/i
/** One letter would list nearly every card holder, so names are suggested from two. Card numbers are looked up at any length. */
const MIN_NAME_QUERY_LENGTH = 2
const MAX_SUGGESTIONS = 4
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const VARIANT_NAMES: Record<Variant, string> = { hot: 'Hot', ice: 'Iced' }
const drinkLabel = (line: OrderItem) => (line.variant ? `${line.name} · ${VARIANT_NAMES[line.variant]}` : line.name)
const TEN_BUTTON = 'rounded-sm px-3 py-1.5 text-xs font-bold tracking-widest transition-colors'

// Customer name, stored as the sale's notes and printed as "Name" on the receipt. As it is
// typed, loyalty card holders whose name or card number matches are suggested; tapping one
// links the order to their card, and only then does their stamp bar show. Any other name is
// still kept for the order, with no stamps.
export default function CustomerNameField(props: CustomerNameFieldProps) {
  const { value, disabled, onChange, holders, linked } = props
  return (
    <div className="px-6 py-2 border-t border-foreground/10 shrink-0 space-y-2">
      <div className="relative">
        <input
          type="text"
          aria-label="Customer name or loyalty card number"
          placeholder="Customer name or card no.…"
          value={value}
          disabled={disabled}
          maxLength={MAX_NAME_LENGTH}
          onChange={e => onChange(e.target.value)}
          className={`w-full border border-foreground/13 rounded-sm px-2.5 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-foreground/40 disabled:opacity-30 bg-transparent ${value.length > 70 ? 'pr-7' : ''}`}
        />
        {value.length > 70 && (
          <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] tabular-nums pointer-events-none ${value.length >= 95 ? 'text-red-400' : 'text-foreground/30'}`}>
            {MAX_NAME_LENGTH - value.length}
          </span>
        )}
      </div>
      {holders === null ? (
        value.trim() !== '' && (
          // The cart is not kept across a reload, so staff are told to reload between orders.
          <p className="text-[11px] text-amber-800">
            Loyalty cards could not load, so this order collects no stamps. Reload the POS before the next order.
          </p>
        )
      ) : linked ? (
        <LinkedCard {...props} linked={linked} />
      ) : (
        <Suggestions value={value} holders={holders} onLink={props.onLink} />
      )}
    </div>
  )
}

function Suggestions({ value, holders, onLink }: { value: string; holders: CardHolderWithCard[]; onLink: (h: CardHolderWithCard) => void }) {
  const typed = value.trim()
  const byNumber = CARD_NUMBER_TYPED.test(typed)
  if (!byNumber && typed.length < MIN_NAME_QUERY_LENGTH) return null
  const key = loyaltyKey(typed)
  const allMatches = matchCardHolders(holders, typed)
  const matches = allMatches.slice(0, MAX_SUGGESTIONS)
  if (matches.length > 0) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.2em] font-semibold text-foreground/45">Loyalty card</span>
        {matches.map(h => {
          const exact = byNumber || loyaltyKey(h.name) === key
          return (
            <button
              key={h._id}
              type="button"
              onClick={() => onLink(h)}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                exact ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700' : 'border-foreground/15 text-foreground hover:border-emerald-500'
              }`}
            >
              {h.name} · No. {h.cardNumber} · {plural(cardState(h.card).onCard, 'stamp')}{exact ? ' · tap to add stamps' : ''}
            </button>
          )
        })}
        {allMatches.length > matches.length && (
          <span className="text-[11px] text-foreground/45">
            +{allMatches.length - matches.length} more: type more of the name, or the card number
          </span>
        )}
      </div>
    )
  }
  const near = holders.filter(h => isNearMiss(key, loyaltyKey(h.name))).slice(0, 2)
  if (near.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-foreground/55">
      <span>No card under this name. Did you mean</span>
      {near.map(h => (
        <button key={h._id} type="button" onClick={() => onLink(h)} className="rounded-full border border-foreground/15 px-2.5 py-1 text-xs font-semibold text-foreground hover:border-emerald-500">
          {h.name} · No. {h.cardNumber}
        </button>
      ))}
      <span>?</span>
    </div>
  )
}

function LinkedCard(props: CustomerNameFieldProps & { linked: CardHolderWithCard }) {
  const { linked, orderStamps, ten, hasFreeDrinkLine, freeActive, onUnlink } = props
  const saved = cardState(linked.card)
  // Rewards can be used on the order that earns them, so the cart's stamps count already.
  const withOrder = cardState(addOrderToTotals(linked.card, orderStamps, []))
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2.5 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {linked.name}{' '}
          <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-700">✓ Card No. {linked.cardNumber}</span>
        </p>
        <span className="font-display text-sm font-semibold tabular-nums text-foreground">
          {Math.min(saved.onCard + orderStamps, LOYALTY_CARD_SIZE)}/{LOYALTY_CARD_SIZE}
        </span>
      </div>
      <LoyaltyBar saved={saved.onCard} pending={orderStamps} />
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-foreground/55">
        {/* Only the stamp count is announced as the order changes, not the whole card. */}
        <span aria-live="polite" className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          {orderStamps > 0 ? (
            <>
              <span className="rounded-full bg-amber-400 px-2 py-0.5 font-bold text-foreground">+{plural(orderStamps, 'stamp')} this order</span>
              <span>{nextMilestone(withOrder.onCard)}</span>
            </>
          ) : (
            <span>No stamps from this order yet: Signature and Matcha Series drinks earn them.</span>
          )}
        </span>
        <button type="button" onClick={onUnlink} className="ml-auto inline-flex min-h-6 items-center px-1 underline underline-offset-2 hover:text-foreground">
          Not {linked.name}? Unlink
        </button>
      </div>
      {(withOrder.tenReady > 0 || withOrder.freeReady > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {withOrder.tenReady > 0 && <TenOff ten={ten} />}
          {withOrder.freeReady > 0 && (
            <span className="text-[11px] font-semibold text-emerald-700">
              {freeActive
                ? 'Free drink applied.'
                : hasFreeDrinkLine
                  ? 'Free drink ready: tap “Make free” on an Espresso or Non-Coffee drink.'
                  : 'Free drink ready: add an Espresso or Non-Coffee drink to use it.'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// The 10% goes on one unit of one classic drink. "Use 10% off" puts it straight on the only
// one in the order, or lists them to pick from; with none, staff ask the customer to add one.
function TenOff({ ten }: { ten: LoyaltyTenControls }) {
  const applied = ten.lineId === null ? undefined : ten.lines.find(l => l.lineId === ten.lineId)
  if (applied) {
    return (
      <button type="button" onClick={ten.onClear} aria-pressed="true" title="Tap to take the 10% off again" className={`${TEN_BUTTON} bg-emerald-100 text-emerald-800`}>
        {`✓ 10% off · ${drinkLabel(applied)}`}
      </button>
    )
  }
  if (!ten.choosing) {
    return (
      <button type="button" onClick={ten.onStart} className={`${TEN_BUTTON} uppercase bg-emerald-600 text-white hover:bg-emerald-700`}>
        Use 10% off
      </button>
    )
  }
  if (ten.lines.length === 0) {
    return (
      <p role="status" className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold text-amber-800">
        <span>The 10% off is for one Espresso or Non-Coffee drink. Ask the customer to add one to use it.</span>
        <button type="button" onClick={ten.onCancel} className="inline-flex min-h-6 items-center px-1 underline underline-offset-2">OK</button>
      </p>
    )
  }
  return (
    <div role="group" aria-label="Pick the drink for 10% off" className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-semibold text-emerald-800">10% off which drink?</span>
      {ten.lines.map(line => (
        <button
          key={line.lineId}
          type="button"
          onClick={() => ten.onPick(line.lineId)}
          className="inline-flex min-h-8 items-center rounded-full border border-emerald-500 bg-white px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
        >
          {drinkLabel(line)}
        </button>
      ))}
      <button type="button" onClick={ten.onCancel} className="inline-flex min-h-6 items-center px-1 text-[11px] text-foreground/55 underline underline-offset-2 hover:text-foreground">
        Cancel
      </button>
    </div>
  )
}
