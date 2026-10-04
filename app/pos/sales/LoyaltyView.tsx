'use client'

import { useCallback, useEffect, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import {
  LOYALTY_CARD_SIZE,
  MAX_CARD_NAME_LENGTH,
  MIN_CARD_NAME_LENGTH,
  cardHolderNameProblem,
  cardState,
  cleanCardHolderName,
  loyaltyKey,
  nextMilestone,
  type CardHolderWithCard,
} from '@/lib/loyalty'
import LoyaltyBar from '../LoyaltyBar'
import { refetchCardHolders } from '../refetchCardHolders'
import { CARD_CHANGE_MESSAGES, sendCardChange } from './sendCardChange'
import { ActionButton, Badge, EmptyState, ErrorBanner, InlineConfirm, Skeleton } from './ui'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const joinAnd = (parts: string[]) => (parts.length < 2 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`)

function joinedOn(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })
}

interface LoyaltyViewProps {
  /** The card holders as the POS has them, or null when it has none yet. They are read again on open. */
  holders: CardHolderWithCard[] | null
  /** The POS's own card holder list, so a card given here is suggested in Customer name at once. */
  onHoldersChange: Dispatch<SetStateAction<CardHolderWithCard[] | null>>
}

type LoadState = 'loading' | 'ready' | 'failed'

// Every loyalty card given out, opened from the POS header over the order on screen. Any
// signed-in POS can give or remove a card, with no manager PIN; removing one is asked first.
export default function LoyaltyView({ holders, onHoldersChange }: LoyaltyViewProps) {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [draft, setDraft] = useState('')
  const [giving, setGiving] = useState(false)
  const [giveError, setGiveError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  // One card is removed at a time, so a refusal is always about the card still asked about.
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Counts the cards given or removed here. A read sent before one of them can still list a
  // card just removed, or miss one just given, so its answer is dropped.
  const changesMade = useRef(0)

  // The cards are read again on open: another device may have given or used one since the
  // POS read them. A failed read keeps the POS's list.
  const read = useCallback(() => {
    const changesWhenSent = changesMade.current
    void refetchCardHolders().then(fresh => {
      if (changesMade.current !== changesWhenSent) return
      if (fresh) onHoldersChange(fresh)
      setLoadState(fresh ? 'ready' : 'failed')
    })
  }, [onHoldersChange])

  useEffect(() => {
    read()
  }, [read])

  function reload() {
    setLoadState('loading')
    read()
  }

  function changeDraft(value: string) {
    setDraft(value)
    setGiveError(null)
  }

  async function giveCard(name: string) {
    setGiving(true)
    setGiveError(null)
    setNotice(null)
    const { message, data, unsure } = await sendCardChange('/api/loyalty/members', 'POST', { name })
    setGiving(false)
    if (unsure) reload()
    if (message !== null || !data) {
      setGiveError(message ?? CARD_CHANGE_MESSAGES.failed)
      return
    }
    const added = data as CardHolderWithCard
    changesMade.current += 1
    onHoldersChange(prev => [...(prev ?? []), added])
    setDraft('')
    setNotice(`Card No. ${added.cardNumber} is ${added.name}’s: write the number on the card. Type their name in Customer name to collect stamps.`)
  }

  function askToRemove(id: string) {
    setConfirmingId(id)
    setRemoveError(null)
  }

  function cancelRemove() {
    setConfirmingId(null)
    setRemoveError(null)
  }

  async function removeCard(holder: CardHolderWithCard) {
    setRemovingId(holder._id)
    setRemoveError(null)
    setNotice(null)
    const { message, unsure, gone } = await sendCardChange(`/api/loyalty/members/${holder._id}`, 'DELETE')
    setRemovingId(null)
    if (unsure) reload()
    if (message !== null && !gone) {
      // With no reply the card may be gone already: the list, read again, shows which.
      setRemoveError(unsure ? message : `Not removed: ${message}`)
      return
    }
    changesMade.current += 1
    onHoldersChange(prev => prev && prev.filter(h => h._id !== holder._id))
    setConfirmingId(null)
    setNotice(gone
      ? `${holder.name}’s card No. ${holder.cardNumber} was removed already, on another device maybe.`
      : `${holder.name}’s card No. ${holder.cardNumber} is removed. Their past orders keep the name.`)
  }

  return (
    <div className="space-y-4">
      {loadState === 'failed' && (
        <ErrorBanner
          message={holders ? 'Could not refresh the loyalty cards. Showing them as the POS last read them.' : 'Could not load the loyalty cards.'}
          actionLabel="Try again"
          onDismiss={reload}
        />
      )}
      {notice && (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>
      )}
      <section className="overflow-hidden rounded-lg border border-border bg-white/80">
        <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/70 bg-foreground/3 px-4 py-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60">Card holders</h3>
          {holders && (
            <span className="text-[10px] uppercase tracking-[0.16em] text-foreground/40">{plural(holders.length, 'card')} given out</span>
          )}
        </header>
        <GiveCardForm draft={draft} onDraftChange={changeDraft} holders={holders} busy={giving} error={giveError} onSubmit={giveCard} />
        {holders === null ? (
          loadState === 'loading' && <div className="p-4"><Skeleton rows={3} height="h-12" /></div>
        ) : holders.length === 0 ? (
          <div className="p-4"><EmptyState title="No loyalty cards yet." hint="Give the first one above when you hand a customer their card." /></div>
        ) : (
          <CardHolderList
            holders={holders}
            confirmingId={confirmingId}
            removingId={removingId}
            removeError={removeError}
            onRequestRemove={askToRemove}
            onCancelRemove={cancelRemove}
            onConfirmRemove={holder => void removeCard(holder)}
          />
        )}
      </section>
    </div>
  )
}

interface GiveCardFormProps {
  draft: string
  onDraftChange: (value: string) => void
  /** The cards given so far, or null until they have loaded: no card can be given before then. */
  holders: CardHolderWithCard[] | null
  /** The card is being saved. */
  busy?: boolean
  /** Why the last card could not be given. */
  error?: string | null
  onSubmit: (name: string) => void
}

export function GiveCardForm({ draft, onDraftChange, holders, busy = false, error = null, onSubmit }: GiveCardFormProps) {
  const name = cleanCardHolderName(draft)
  const longEnough = name.length >= MIN_CARD_NAME_LENGTH
  // The server checks the name too; checking here keeps a refused name from being sent. A
  // name still too short only keeps the button off, rather than flagging the first letter.
  const problem = longEnough ? cardHolderNameProblem(name) : null
  const ready = holders !== null && longEnough && problem === null && !busy
  const sameName = holders && name ? holders.filter(h => loyaltyKey(h.name) === loyaltyKey(name)) : []

  function submit(e: FormEvent) {
    e.preventDefault()
    if (ready) onSubmit(name)
  }

  return (
    <form onSubmit={submit} className="grid gap-2 border-b border-border/70 px-4 py-4">
      <label htmlFor="give-card-name" className="text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground/50">
        Give a card: name on the card
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="give-card-name"
          value={draft}
          onChange={e => onDraftChange(e.target.value)}
          maxLength={MAX_CARD_NAME_LENGTH}
          placeholder="e.g. Kylene"
          autoComplete="off"
          aria-invalid={problem !== null}
          aria-describedby="give-card-hint"
          className="min-w-0 flex-1 basis-56 rounded-md border border-foreground/20 bg-white px-3 py-2.5 text-sm text-foreground placeholder:text-foreground/30 focus:border-foreground/50 focus:outline-none"
        />
        <ActionButton tone="primary" type="submit" busy={busy} disabled={!ready}>Give card</ActionButton>
      </div>
      <p id="give-card-hint" className="text-xs text-foreground/50">
        {problem || error ? (
          <span className="font-semibold text-red-700">{problem ?? error}</span>
        ) : sameName.length > 0 ? (
          <span className="font-semibold text-amber-800">
            {sameName.map(h => `${h.name} already has card No. ${h.cardNumber}`).join('; ')}. A new card gets its own number, so staff can tell them apart.
          </span>
        ) : (
          'It gets the next card number: write it on the card.'
        )}
      </p>
    </form>
  )
}

interface CardHolderListProps {
  holders: CardHolderWithCard[]
  /** The card whose removal is being asked about. */
  confirmingId: string | null
  /** The card being removed: the others can't be removed until it is done. */
  removingId: string | null
  /** Why the card asked about was not removed, as it is shown. */
  removeError: string | null
  onRequestRemove: (id: string) => void
  onCancelRemove: () => void
  onConfirmRemove: (holder: CardHolderWithCard) => void
}

// Stamps are counted from the card's linked sales, so a removed card's stamps and unused
// rewards are gone for good: a new card for the same customer starts from zero.
function removeMessage(h: CardHolderWithCard): string {
  const card = cardState(h.card)
  const lost = [
    card.onCard > 0 ? plural(card.onCard, 'stamp') : null,
    card.tenReady > 0 ? 'the 10% off ready' : null,
    card.freeReady > 0 ? 'the free drink ready' : null,
  ].filter((part): part is string => part !== null)
  const ask = `Remove ${h.name}’s card No. ${h.cardNumber}?`
  return lost.length > 0 ? `${ask} Its ${joinAnd(lost)} will be lost.` : ask
}

export function CardHolderList({
  holders,
  confirmingId,
  removingId,
  removeError,
  onRequestRemove,
  onCancelRemove,
  onConfirmRemove,
}: CardHolderListProps) {
  return (
    <ol className="divide-y divide-border/60">
      {holders.map(h => {
        const card = cardState(h.card)
        const isRemoving = removingId === h._id
        const isConfirming = confirmingId === h._id && !isRemoving
        return (
          <li
            key={h._id}
            className="grid grid-cols-[3.5rem_minmax(0,1fr)_6rem] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[3.5rem_minmax(0,1fr)_minmax(8rem,12rem)_minmax(0,11rem)_6rem]"
          >
            <span className="font-display text-sm font-bold tabular-nums text-foreground/40">No. {h.cardNumber}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">{h.name}</span>
              <span className="text-xs text-foreground/45">Card since {joinedOn(h.joinedAt)} · {plural(h.orderCount, 'order')}</span>
            </span>
            <span className="col-span-full flex items-center gap-2 sm:col-span-1">
              <span className="flex-1"><LoyaltyBar saved={card.onCard} pending={0} compact /></span>
              <span className="text-xs font-bold tabular-nums text-foreground">{card.onCard}/{LOYALTY_CARD_SIZE}</span>
            </span>
            <span className="col-span-full flex flex-wrap gap-1 sm:col-span-1">
              {card.tenReady > 0 && <Badge tone="success">10% off ready</Badge>}
              {card.freeReady > 0 && <Badge tone="success">Free drink ready</Badge>}
              {card.tenReady === 0 && card.freeReady === 0 && <span className="text-xs text-foreground/45">{nextMilestone(card.onCard)}</span>}
            </span>
            <span className="col-start-3 row-start-1 justify-self-end sm:col-auto sm:row-auto">
              {!isConfirming && !isRemoving && (
                <ActionButton
                  tone="danger"
                  aria-label={`Remove ${h.name}’s card No. ${h.cardNumber}`}
                  disabled={removingId !== null}
                  onClick={() => onRequestRemove(h._id)}
                >
                  Remove
                </ActionButton>
              )}
            </span>
            {isRemoving && (
              <p className="col-span-full text-[11px] uppercase tracking-widest text-foreground/40 animate-pulse">
                Removing card No. {h.cardNumber}…
              </p>
            )}
            {isConfirming && (
              <div className="col-span-full">
                <InlineConfirm
                  message={removeMessage(h)}
                  confirmLabel="Remove card"
                  onCancel={onCancelRemove}
                  onConfirm={() => onConfirmRemove(h)}
                />
                {removeError && (
                  <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{removeError}</p>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
