'use client'

import { countLabel, formatPeso } from './menuView'

interface TrayBarProps {
  count: number
  total: number
  /** Changes on every add, so the bar gives a small nudge. */
  pulseKey: number
  onOpen: () => void
}

// The bar at the bottom of the menu once the tray has something: the count and total, and the
// way into the tray. Adding an item no longer opens the tray itself.
export default function TrayBar({ count, total, pulseKey, onOpen }: TrayBarProps) {
  if (count === 0) return null

  return (
    // The fade lets taps through to what shows behind it; only the button takes them.
    <div className="pointer-events-none sticky bottom-0 z-20 bg-linear-to-b from-background/0 to-background to-34% px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
      <button
        key={pulseKey}
        type="button"
        onClick={onOpen}
        className="pointer-events-auto mx-auto flex min-h-13.5 w-full max-w-140 items-center justify-between gap-3 rounded-full bg-foreground px-5 text-sm text-cream shadow-[0_10px_30px_rgba(0,30,5,.25)] motion-safe:animate-[tray-pulse_.45s_ease-out]"
      >
        <span>Your tray · {countLabel(count, 'item')}</span>
        <b className="font-medium tabular-nums">{formatPeso(total)} · View</b>
      </button>
    </div>
  )
}
