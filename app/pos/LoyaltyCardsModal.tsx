'use client'

import type { Dispatch, SetStateAction } from 'react'
import type { CardHolderWithCard } from '@/lib/loyalty'
import LoyaltyView from './sales/LoyaltyView'

interface LoyaltyCardsModalProps {
  /** The POS's card holders; the panel reads them again when it opens. */
  holders: CardHolderWithCard[] | null
  onHoldersChange: Dispatch<SetStateAction<CardHolderWithCard[] | null>>
  onClose: () => void
}

// The loyalty cards, opened from the POS header. It sits over the order on screen (the cart
// is not kept across a page change), so a card given here can go on that order at once.
// Like Manage Categories it closes with ✕ or the backdrop.
export default function LoyaltyCardsModal({ holders, onHoldersChange, onClose }: LoyaltyCardsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="loyalty-cards-title"
        className="relative z-50 bg-background border border-foreground/12 w-full max-w-5xl rounded-sm shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-foreground/10 shrink-0">
          <p id="loyalty-cards-title" className="text-[10px] uppercase tracking-[0.3em] text-foreground/60 font-semibold">
            Loyalty Cards
          </p>
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="text-foreground/40 hover:text-foreground text-2xl leading-none w-11 h-11 -mr-2 flex items-center justify-center rounded-full hover:bg-foreground/5 transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <LoyaltyView holders={holders} onHoldersChange={onHoldersChange} />
        </div>
      </div>
    </div>
  )
}
