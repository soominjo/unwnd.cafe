'use client'

import { useState } from 'react'

const PRESETS = ['Less Sweet', 'No Sugar', '1 Shot Only', 'Less Ice', 'No Ice']

function splitNote(note: string | undefined): { presets: string[]; custom: string } {
  const parts = (note ?? '').split(',').map(p => p.trim()).filter(Boolean)
  const presets = parts.filter(p => PRESETS.includes(p))
  const custom = parts.filter(p => !PRESETS.includes(p)).join(', ')
  return { presets, custom }
}

function joinNote(presets: string[], custom: string): string {
  return [...presets, custom.trim()].filter(Boolean).join(', ')
}

interface CustomizeDrinkRowProps {
  itemName: string
  note?: string
  onSave: (note: string) => void
  /** Called right after any preset is tapped (picked or un-picked) — the parent closes the row on it, so picking one is a single tap rather than tap-then-dismiss. Typing "Other" doesn't trigger this. */
  onPresetChosen: () => void
}

// Inline "attached to the selected item" editor for drink customizations (less sweet,
// 1 shot, etc.) — same mechanic as the Add-ons row: whichever item is selected is what
// a tap applies to. Rendered in normal document flow rather than a floating popover, so
// there's no position to compute and it can never spill outside the order panel.
// Mount with `key={itemLineId}` from the parent so switching items resets local state.
export default function CustomizeDrinkRow({ itemName, note, onSave, onPresetChosen }: CustomizeDrinkRowProps) {
  const initial = splitNote(note)
  const [presets, setPresets] = useState<string[]>(initial.presets)
  const [custom, setCustom] = useState(initial.custom)

  function togglePreset(preset: string) {
    const next = presets.includes(preset) ? presets.filter(p => p !== preset) : [...presets, preset]
    setPresets(next)
    onSave(joinNote(next, custom))
    onPresetChosen()
  }

  function commitCustom() {
    onSave(joinNote(presets, custom))
  }

  return (
    <div className="px-6 py-2 border-t border-foreground/10 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-[0.25em] text-foreground/45 font-semibold">Customize</p>
        <p className="text-[10px] text-amber-600 font-semibold truncate max-w-[55%] text-right">→ {itemName}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(preset => (
          <button
            key={preset}
            onClick={() => togglePreset(preset)}
            className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-full border transition-colors ${
              presets.includes(preset)
                ? 'bg-amber-500 text-white border-amber-500'
                : 'border-foreground/15 text-foreground/65 hover:border-amber-400 hover:text-amber-600'
            }`}
          >
            {preset}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Other (e.g. no whip)…"
        value={custom}
        onChange={e => setCustom(e.target.value)}
        onBlur={commitCustom}
        onKeyDown={e => { if (e.key === 'Enter') commitCustom() }}
        className="mt-2 w-full border border-foreground/13 rounded-sm px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-amber-400"
      />
    </div>
  )
}
