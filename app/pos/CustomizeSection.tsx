'use client'

import { useState } from 'react'

export const CUSTOMIZE_PRESETS = ['Less Sweet', 'No Sugar', '1 Shot Only', 'Less Ice', 'No Ice']

function splitNote(note: string | undefined): { presets: string[]; custom: string } {
  const parts = (note ?? '').split(',').map(p => p.trim()).filter(Boolean)
  const presets = parts.filter(p => CUSTOMIZE_PRESETS.includes(p))
  const custom = parts.filter(p => !CUSTOMIZE_PRESETS.includes(p)).join(', ')
  return { presets, custom }
}

function joinNote(presets: string[], custom: string): string {
  return [...presets, custom.trim()].filter(Boolean).join(', ')
}

interface CustomizeSectionProps {
  note?: string
  onSave: (note: string) => void
  /** Called right after a preset is tapped (picked or un-picked) — the modal closes on it, so one tap is enough. Typing "Other" does not trigger it. */
  onPresetChosen: () => void
}

// The Customize section of the per-item modal: preset chips plus a free-text
// "Other" field, both folded into the line's single note string. Mount with a
// key per line so switching items resets the local state.
export default function CustomizeSection({ note, onSave, onPresetChosen }: CustomizeSectionProps) {
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
    <div className="space-y-3">
      <p className="text-[11px] text-foreground/50">Tap a preset to apply it, or type anything else below.</p>
      <div className="flex flex-wrap gap-2">
        {CUSTOMIZE_PRESETS.map(preset => {
          const active = presets.includes(preset)
          return (
            <button
              key={preset}
              onClick={() => togglePreset(preset)}
              aria-pressed={active}
              className={`px-3 py-2 text-xs font-semibold rounded-full border transition-colors ${
                active
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'border-foreground/15 text-foreground/65 hover:border-amber-400 hover:text-amber-600'
              }`}
            >
              {preset}
            </button>
          )
        })}
      </div>
      <input
        type="text"
        placeholder="Other (e.g. no whip)…"
        value={custom}
        onChange={e => setCustom(e.target.value)}
        onBlur={commitCustom}
        onKeyDown={e => { if (e.key === 'Enter') commitCustom() }}
        className="w-full border border-foreground/15 rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-amber-400"
      />
    </div>
  )
}
