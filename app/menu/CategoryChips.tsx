'use client'

import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from './reducedMotion'

interface CategoryChipsProps {
  sections: readonly { id: string; label: string }[]
  /** The category being read, marked and kept in view. */
  active: string
  onPick: (id: string) => void
}

// The category buttons that stay under the Nav while the menu scrolls.
export default function CategoryChips({ sections, active, onPick }: CategoryChipsProps) {
  const rowRef = useRef<HTMLDivElement>(null)

  // Keep the current chip in view as the reader moves down the menu.
  useEffect(() => {
    const row = rowRef.current
    const chip = row?.querySelector<HTMLElement>(`[data-chip="${CSS.escape(active)}"]`)
    if (!row || !chip) return
    row.scrollTo({ left: Math.max(0, chip.offsetLeft - 20), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [active])

  return (
    <nav aria-label="Menu categories" className="sticky top-(--nav-h) z-30 border-b border-hair bg-background">
      <div
        ref={rowRef}
        className="relative mx-auto flex max-w-310 gap-2 overflow-x-auto px-5 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-10 lg:justify-center-safe lg:px-16"
      >
        {sections.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            data-chip={id}
            aria-current={id === active ? 'true' : 'false'}
            onClick={() => onPick(id)}
            className={`min-h-9.5 shrink-0 whitespace-nowrap rounded-full border px-3.75 text-[13.5px] transition-colors ${
              id === active ? 'border-foreground bg-foreground text-cream' : 'border-hair-2 hover:border-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </nav>
  )
}
