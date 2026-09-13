'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface ItemNotePopoverProps {
  note?: string
  onSave: (note: string) => void
}

const PRESETS = ['Less Sweet', 'No Sugar', '1 Shot Only', 'Less Ice', 'No Ice']
/** Guessed width before the row's actual layout is measured — replaced immediately by the layout effect below. */
const INITIAL_WIDTH = 160
/** The order row's own horizontal padding (`px-6` on the scrollable item list) — the price sits flush against it. */
const ROW_PADDING = 24
const MIN_WIDTH = 140

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
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  function openPopover() {
    const parsed = splitNote(note)
    setPresets(parsed.presets)
    setCustom(parsed.custom)
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({ top: rect.bottom + 4, left: rect.left, width: INITIAL_WIDTH })
    }
    setIsOpen(true)
  }

  // Spans from the customize button (left edge) to the row's qty "+" button (right
  // edge) instead of a fixed width, so it reads as "attached to this row" rather than
  // a floating box — narrower on a narrow order panel, wider on a roomy one, but always
  // this row's own width. Falls back to the panel's own right edge (minus its padding)
  // when the row/plus-button markers aren't found, and is always clamped to the nearest
  // `[data-order-panel]` ancestor so it never spills past the panel's white background
  // onto the tan menu area beside it (or the viewport, if no such ancestor exists).
  useLayoutEffect(() => {
    if (!isOpen || !popoverRef.current || !buttonRef.current) return
    const margin = 8
    const buttonRect = buttonRef.current.getBoundingClientRect()
    const popRect = popoverRef.current.getBoundingClientRect()
    const panel = buttonRef.current.closest<HTMLElement>('[data-order-panel]')
    const bounds = panel ? panel.getBoundingClientRect() : { left: 0, right: window.innerWidth }
    const left = Math.max(buttonRect.left, bounds.left + margin)

    const row = buttonRef.current.closest<HTMLElement>('[data-item-row]')
    const plusButton = row?.querySelector<HTMLElement>('[data-qty-plus]')
    const rightEdge = plusButton ? plusButton.getBoundingClientRect().right : bounds.right - ROW_PADDING
    const right = Math.max(Math.min(rightEdge, bounds.right - margin), left + MIN_WIDTH)
    const width = right - left

    let top = buttonRect.bottom + 4
    if (top + popRect.height > window.innerHeight - margin) {
      top = buttonRect.top - popRect.height - 4
    }
    setPosition({ top, left, width })
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
          style={{ position: 'fixed', top: position.top, left: position.left, width: position.width }}
          className="z-50 max-w-[calc(100vw-1.5rem)] bg-white border border-foreground/12 rounded-lg shadow-xl p-2.5 space-y-2"
        >
          <p className="text-[9px] uppercase tracking-widest text-foreground/45 font-semibold">Customize this drink</p>
          <div className="grid grid-cols-1 gap-1.5">
            {PRESETS.map(preset => (
              <button
                key={preset}
                onClick={() => togglePreset(preset)}
                className={`px-2 py-2.5 text-[11px] font-semibold rounded-full border transition-colors text-center truncate ${
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
            className="w-full border border-foreground/13 rounded-sm px-2 py-2 text-[11px] text-foreground placeholder:text-foreground/30 focus:outline-none focus:border-amber-400"
          />
        </div>,
        document.body,
      )}
    </>
  )
}
