'use client'

import { useCallback, useEffect, useState } from 'react'
import { PIN_CHECK_MESSAGES } from './verifyPosPin'

export const PIN_LENGTH = 4
const BACKSPACE = '⌫'
const PAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', BACKSPACE]

/** The PIN after one key: a digit adds on until the PIN is full, ⌫ takes the last one off. */
export function pinAfterKey(pin: string, key: string): string {
  if (key === BACKSPACE) return pin.slice(0, -1)
  if (/^[0-9]$/.test(key) && pin.length < PIN_LENGTH) return pin + key
  return pin
}

interface PinPadProps {
  /** Checks a full PIN: resolves null when it is accepted, or the message to show when not. */
  onComplete: (pin: string) => Promise<string | null>
}

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
}

// The POS's PIN entry, shared by the login screen and the manager unlock: one dot
// per digit, checked as soon as the last one is in. A keyboard's digits and
// Backspace work too. Styled for a dark (bg-foreground) background.
export default function PinPad({ onComplete }: PinPadProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const press = useCallback(async (key: string) => {
    if (checking) return
    const next = pinAfterKey(pin, key)
    setError(null)
    if (next === pin) return
    setPin(next)
    if (next.length < PIN_LENGTH) return

    setChecking(true)
    let message: string | null
    try {
      message = await onComplete(next)
    } catch {
      message = PIN_CHECK_MESSAGES.unreachable
    }
    // Accepted: the keys stay locked while the caller moves on (a page load after
    // login), so a stray tap cannot send the PIN a second time.
    if (message === null) return
    setChecking(false)
    setError(message)
    setPin('')
  }, [pin, checking, onComplete])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ctrl/⌘/Alt + digit are browser shortcuts, and a held key repeats.
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press(BACKSPACE)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [press])

  return (
    <div className="flex flex-col items-center">
      <div className="flex gap-5 mb-4">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            data-pin-dot
            className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-150 ${
              i < pin.length ? 'bg-cream border-cream' : 'border-cream/25'
            }`}
          />
        ))}
      </div>

      <div className="h-6 mb-8 flex items-center">
        {error && (
          <p role="alert" className="text-red-400 text-[10px] uppercase tracking-[0.3em]">
            {error}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {PAD.map((key, i) => (
          key === '' ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              onClick={() => press(key)}
              disabled={checking}
              aria-label={key === BACKSPACE ? 'Delete last digit' : undefined}
              className={`w-20 h-20 rounded-sm text-2xl font-light transition-all duration-150 disabled:opacity-40 ${
                key === BACKSPACE
                  ? 'text-cream/40 hover:text-cream hover:bg-cream/10 active:scale-95'
                  : 'text-cream border border-cream/15 hover:border-cream/40 hover:bg-cream/10 active:scale-95'
              }`}
            >
              {key}
            </button>
          )
        ))}
      </div>
    </div>
  )
}
