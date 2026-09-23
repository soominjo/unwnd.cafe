'use client'

import { useState } from 'react'

export const CUSTOMIZE_PRESETS = ['Less Sweet', 'No Sugar', '1 Shot Only', 'Less Ice', 'No Ice']

/** Splits a line note into the presets it contains and the free-text remainder. */
export function splitNote(note: string | undefined): { presets: string[]; custom: string } {
  const parts = (note ?? '').split(',').map(p => p.trim()).filter(Boolean)
  const presets = parts.filter(p => CUSTOMIZE_PRESETS.includes(p))
  const custom = parts.filter(p => !CUSTOMIZE_PRESETS.includes(p)).join(', ')
  return { presets, custom }
}

/** The inverse of splitNote: presets first, then the trimmed free text, comma separated. */
export function joinNote(presets: string[], custom: string): string {
  return [...presets, custom.trim()].filter(Boolean).join(', ')
}

interface CustomizeSectionProps {
  note?: string
  onSave: (note: string) => void
  /** Called after a preset tap (picked or un-picked) or Enter in "Other" — the modal closes on it, so one tap is enough. */
  onDone: () => void
}

// The Customize section of the per-item modal: preset chips plus a free-text
// "Other" field, both folded into the line's single note string. Mount with a
// key per line so switching items resets the local state.
export default function CustomizeSection({ note, onSave, onDone }: CustomizeSectionProps) {
  const initial = splitNote(note)
  const [presets, setPresets] = useState<string[]>(initial.presets)
  const [custom, setCustom] = useState(initial.custom)

  function togglePreset(preset: string) {
    const next = presets.includes(preset) ? presets.filter(p => p !== preset) : [...presets, preset]
    setPresets(next)
    onSave(joinNote(next, custom))
    onDone()
  }

  function commitCustom() {
    onSave(joinNote(presets, custom))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {CUSTOMIZE_PRESETS.map(preset => {
          const active = presets.includes(preset)
          return (
            <button
              key={preset}
              onClick={() => togglePreset(preset)}
              aria-pressed={active}
              className={`px-4 py-3 text-sm font-semibold rounded-full border transition-colors ${
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
        onKeyDown={e => { if (e.key === 'Enter') { commitCustom(); onDone() } }}
        className="w-full border border-foreground/15 rounded-sm px-3 py-3 text-sm text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-amber-400"
      />
    </div>
  )
}
