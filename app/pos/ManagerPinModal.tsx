'use client'

import { useEffect, useRef } from 'react'
import PinPad from './PinPad'
import { PIN_CHECK_MESSAGES, verifyPosPin } from './verifyPosPin'

interface ManagerPinModalProps {
  /** The PIN was right: show the menu's edit and delete buttons. */
  onUnlock: () => void
  onClose: () => void
}

// Asks for the manager PIN before the menu's edit and delete buttons appear.
// It is the POS login PIN, checked on the server by the same route as the login.
export default function ManagerPinModal({ onUnlock, onClose }: ManagerPinModalProps) {
  // Closed while a PIN was being checked: a right answer arriving afterwards must not unlock.
  const closed = useRef(false)
  useEffect(() => {
    closed.current = false
    return () => { closed.current = true }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function check(pin: string): Promise<string | null> {
    const result = await verifyPosPin(pin)
    if (result !== 'ok') return PIN_CHECK_MESSAGES[result]
    if (!closed.current) onUnlock()
    return null
  }

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manager-pin-title"
        className="relative z-61 w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-sm bg-foreground text-cream shadow-2xl px-6 pt-4 pb-8 flex flex-col items-center select-none"
      >
        <div className="self-stretch flex items-center justify-between mb-6">
          <p id="manager-pin-title" className="text-[10px] uppercase tracking-[0.3em] text-cream/60 font-semibold">
            Manager PIN
          </p>
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="text-cream/50 hover:text-cream text-xl leading-none w-11 h-11 -mr-2 flex items-center justify-center rounded-full hover:bg-cream/10 transition-colors"
          >
            ✕
          </button>
        </div>
        <PinPad onComplete={check} />
        <p className="mt-6 text-center text-xs text-cream/45">Same PIN as the POS login. Unlocks edit and delete on menu items.</p>
      </div>
    </div>
  )
}
