'use client'

import { useEffect } from 'react'
import PinPad from '../PinPad'

interface PinDialogProps {
  /** The small capitals line at the top, such as "Clock in". */
  title: string
  /** Whose PIN it asks for. */
  name: string
  /** One line under the name, such as "Enter your PIN to clock in." */
  note: string
  /** Checks the PIN and acts on it: resolves null when done, else the message for the pad. */
  onPin: (pin: string) => Promise<string | null>
  onClose: () => void
}

// One person's PIN, over the Time clock page, before their clock in or out: dark like the POS
// login pad. ✕, the backdrop or Escape closes it.
export default function PinDialog({ title, name, note, onPin, onClose }: PinDialogProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-dialog-name"
        className="relative z-50 flex max-h-[90vh] w-full max-w-sm select-none flex-col items-center overflow-y-auto rounded-sm bg-foreground px-6 pb-8 pt-4 text-cream shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between self-stretch">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cream/60">{title}</p>
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-xl leading-none text-cream/50 transition-colors hover:bg-cream/10 hover:text-cream"
          >
            ✕
          </button>
        </div>
        <p id="pin-dialog-name" className="text-lg font-semibold">{name}</p>
        <p className="mb-6 mt-1 text-xs text-cream/55">{note}</p>
        <PinPad onComplete={onPin} />
      </div>
    </div>
  )
}
