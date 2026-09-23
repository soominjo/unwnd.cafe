'use client'

import type { Addon } from './types'

interface AddonsSectionProps {
  /** Add-ons that may attach to the open item — already filtered by its menu category. */
  options: Addon[]
  /** How many of each add-on are already on the line, keyed by add-on id. */
  attachedQty: Record<string, number>
  /** Attaches one unit. The modal stays open, so several add-ons can be stacked in a row. */
  onAdd: (addon: Addon) => void
}

// The Add-ons part of the per-item modal. An add-on already on the line is
// filled and carries its count, the same read-at-a-glance state the Customize
// presets use; the rest keep a left rule that tells drink add-ons (dark) from
// food add-ons (brown).
export default function AddonsSection({ options, attachedQty, onAdd }: AddonsSectionProps) {
  if (options.length === 0) {
    return <p className="text-sm text-foreground/45">No add-ons available for this item.</p>
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map(addon => {
        const qty = attachedQty[addon.id] ?? 0
        return (
          <button
            key={addon.id}
            onClick={() => onAdd(addon)}
            aria-pressed={qty > 0}
            title={addon.type ? `${addon.type} add-on` : undefined}
            className={`px-3 py-3 text-sm font-semibold border rounded-sm transition-all text-left flex items-center justify-between gap-2 ${
              qty > 0
                ? 'bg-sky-500 text-white border-sky-500 shadow-sm'
                : addon.type === 'food'
                ? 'border-y-foreground/20 border-r-foreground/20 border-l-2 border-l-[#8b5e3c] text-foreground/70 hover:text-foreground hover:bg-foreground/4'
                : addon.type === 'drink'
                ? 'border-y-foreground/20 border-r-foreground/20 border-l-2 border-l-foreground text-foreground/70 hover:text-foreground hover:bg-foreground/4'
                : 'border-foreground/20 text-foreground/70 hover:text-foreground hover:bg-foreground/4'
            }`}
          >
            <span>{addon.label}</span>
            {qty > 0 && <span className="tabular-nums shrink-0">×{qty}</span>}
          </button>
        )
      })}
    </div>
  )
}
