'use client'

import type { Addon } from './types'

interface AddonsSectionProps {
  /** Add-ons that may attach to the open item — already filtered by its menu category. */
  options: Addon[]
  /** Attaches one unit; the modal closes right after, so one tap is enough. */
  onAdd: (addon: Addon) => void
}

// The Add-ons section of the per-item modal. The left rule tells drink add-ons
// (dark) from food add-ons (brown) at a glance.
export default function AddonsSection({ options, onAdd }: AddonsSectionProps) {
  if (options.length === 0) {
    return <p className="text-sm text-foreground/45">No add-ons available for this item.</p>
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {options.map(addon => (
          <button
            key={addon.id}
            onClick={() => onAdd(addon)}
            title={addon.type ? `${addon.type} add-on` : undefined}
            className={`px-3 py-3 text-sm font-semibold border-y border-r rounded-sm transition-all text-left text-foreground/70 hover:text-foreground hover:bg-foreground/4 ${
              addon.type === 'food'
                ? 'border-l-2 border-l-[#8b5e3c] border-y-foreground/20 border-r-foreground/20 hover:border-y-[#8b5e3c]/45 hover:border-r-[#8b5e3c]/45'
                : addon.type === 'drink'
                ? 'border-l-2 border-l-foreground border-y-foreground/20 border-r-foreground/20 hover:border-y-foreground/45 hover:border-r-foreground/45'
                : 'border-l border-l-foreground/20 border-y-foreground/20 border-r-foreground/20 hover:border-foreground/45'
            }`}
          >
            {addon.label}
          </button>
        ))}
      </div>
    </div>
  )
}
