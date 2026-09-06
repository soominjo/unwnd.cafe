'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface ItemNotePopoverProps {
  note?: string
  onSave: (note: string) => void
}

const PRESETS = ['Less Sweet', 'No Sugar', '1 Shot Only', 'Less Ice', 'No Ice']
const POPOVER_WIDTH = 240

function splitNote(note: string | undefined): { presets: string[]; custom: string } {
  const parts = (note ?? '').split(',').map(p => p.trim()).filter(Boolean)
  const presets = parts.filter(p => PRESETS.includes(p))
  const custom = parts.filter(p => !PRESETS.includes(p)).join(', ')
  return { presets, custom }
}

function joinNote(presets: string[], custom: string): string {
  return [...presets, custom.trim()].filter(Boolean).join(', ')
}

// Small popover for tagging a single order line with a customization (e.g.
// "Less Sweet, 1 Shot Only") — sits next to the per-line PWD/Senior "%" toggle
// in OrderPanel. Rendered through a portal at a `position: fixed` coordinate
// computed from the trigger button, so it can't get sliced off by the order
// list's own `overflow-y-auto` (which — per CSS's overflow-x/y coupling rule —
// clips horizontally too, cutting off anything absolutely positioned past its
// edge). Presets apply immediately on tap so the common case (bulk order, one
// drink out of ten needs a tweak) is a single extra tap.
export default function ItemNotePopover({ note, onSave }: ItemNotePopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [presets, setPresets] = useState<string[]>([])
  const [custom, setCustom] = useState('')
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  function openPopover() {
    const parsed = splitNote(note)
    setPresets(parsed.presets)
    setCustom(parsed.custom)
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, left: rect.right - POPOVER_WIDTH })
    }
    setIsOpen(true)
  }

  // Refine the guessed position once the popover's real size is known, fully
  // clamped to the viewport (not any ancestor's clipped bounds).
  useLayoutEffect(() => {
    if (!isOpen || !popoverRef.current || !buttonRef.current) return
    const margin = 12
    const buttonRect = buttonRef.current.getBoundingClientRect()
    const popRect = popoverRef.current.getBoundingClientRect()
    const left = Math.min(
      Math.max(buttonRect.right - popRect.width, margin),
      window.innerWidth - popRect.width - margin,
    )
    let top = buttonRect.bottom + 4
    if (top + popRect.height > window.innerHeight - margin) {
      top = buttonRect.top - popRect.height - 4
    }
    setPosition({ top, left })
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function isInside(target: EventTarget | null) {
      const node = target as Node
      return (buttonRef.current?.contains(node) ?? false) || (popoverRef.current?.contains(node) ?? false)
    }
    function onPointerDown(e: PointerEvent) {
      if (!isInside(e.target)) setIsOpen(false)
    }
    function onViewportChange() {
      setIsOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('resize', onViewportChange)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', onViewportChange, true)
      window.removeEventListener('resize', onViewportChange)
    }
  }, [isOpen])

  function togglePreset(preset: string) {
    const next = presets.includes(preset) ? presets.filter(p => p !== preset) : [...presets, preset]
    setPresets(next)
    onSave(joinNote(next, custom))
  }

  function commitCustom() {
    onSave(joinNote(presets, custom))
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={e => { e.stopPropagation(); if (isOpen) setIsOpen(false); else openPopover() }}
        title="Customize (less sweet, 1 shot, etc.)"
        className={`w-8 h-8 flex items-center justify-center text-[11px] font-bold rounded-full border transition-colors ${
          note
            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
            : 'bg-amber-50 border-amber-300 text-amber-600 hover:bg-amber-100 hover:border-amber-500'
        }`}
      >
        📝
      </button>

      {isOpen && position && createPortal(
        <div
          ref={popoverRef}
          onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', top: position.top, left: position.left }}
          className="z-50 w-60 max-w-[calc(100vw-1.5rem)] bg-white border border-foreground/12 rounded-lg shadow-xl p-3 space-y-2.5"
        >
          <p className="text-[9px] uppercase tracking-widest text-foreground/45 font-semibold">Customize this drink</p>
          <div className="grid grid-cols-3 gap-1.5">
            {PRESETS.map(preset => (
              <button
                key={preset}
                onClick={() => togglePreset(preset)}
                className={`px-2 py-1.5 text-[11px] font-semibold rounded-full border transition-colors text-center truncate ${
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
            onKeyDown={e => { if (e.key === 'Enter') { commitCustom(); setIsOpen(false) } }}
            className="w-full border border-foreground/13 rounded-sm px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-amber-400"
          />
        </div>,
        document.body,
      )}
    </>
  )
}
