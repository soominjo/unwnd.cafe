'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react'
import Image from 'next/image'
import { ADVANCE_EVERY_MS, SLIDE_MS, loopStrip, settle } from './carousel'
import { HIGHLIGHT_HEIGHT, HIGHLIGHT_WIDTH, type HighlightPhoto } from './photos'

interface HighlightsCarouselProps {
  photos: readonly HighlightPhoto[]
}

/** A sideways drag at least this long, in px, moves the strip on or back. */
const SWIPE_PX = 40

/** Slow out of the start and into the stop, so each move reads as a glide. */
const GLIDE_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'

const SIZES = '(min-width: 1024px) 34vw, (min-width: 640px) 50vw, 100vw'

// One photo across on a phone, two on a tablet, three on a wide screen; the track slides by one
// photo's width, a share of --per-view.
const TRACK = 'flex [--per-view:1] sm:[--per-view:2] lg:[--per-view:3]'
const SLOT = 'w-[calc(100%/var(--per-view))] shrink-0'
const PHOTO = 'block h-auto w-full select-none'
const ARROW =
  'absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-cream/80 text-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-cream'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

// The visitor's motion setting and whether the tab is in front: both can change while the page is open.
function watchMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function watchTab(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

// The café's photos sliding along on their own, like the owner's reference: every ADVANCE_EVERY_MS
// the strip glides on by one photo over SLIDE_MS. After the last photo come copies of the first
// ones; a move that lands on them jumps back unseen to the same view, so the loop never shows a
// seam. It holds still while hovered or focused, off screen, in a hidden tab, after Pause (moving
// content needs a way to stop it, WCAG 2.2.2), and for anyone who asks for reduced motion.
export default function HighlightsCarousel({ photos }: HighlightsCarouselProps) {
  const count = photos.length
  const strip = loopStrip(photos)
  const [position, setPosition] = useState(0)
  const [glide, setGlide] = useState(true)
  const [playing, setPlaying] = useState(true)
  const [held, setHeld] = useState(false)
  const [inView, setInView] = useState(false)
  const tabShown = useSyncExternalStore(watchTab, () => document.visibilityState === 'visible', () => true)
  const reduced = useSyncExternalStore(watchMotion, () => window.matchMedia(REDUCED_MOTION).matches, () => false)
  // Bumped by a tap or a swipe, so the next automatic move waits a full interval after it.
  const [restart, setRestart] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const positionNow = useRef(0)
  const moving = useRef(false)
  const swipeFrom = useRef<number | null>(null)

  useEffect(() => {
    positionNow.current = position
  }, [position])

  const move = useCallback(
    (step: 1 | -1) => {
      if (moving.current || count < 2) return
      if (reduced) {
        setGlide(false)
        setPosition((p) => (settle(p, count) + step + count) % count)
        return
      }
      moving.current = true
      const fromStart = step === -1 && positionNow.current === 0
      if (fromStart) {
        // Back from the first photo: jump unseen to the copies at the end, then glide back one.
        setGlide(false)
        setPosition(count)
        requestAnimationFrame(() => requestAnimationFrame(() => {
          setGlide(true)
          setPosition(count - 1)
        }))
      } else {
        setGlide(true)
        setPosition((p) => p + step)
      }
      // A timer, not transitionend, ends the move: a glide the browser skips still lets go.
      window.setTimeout(() => {
        moving.current = false
        setGlide(false)
        setPosition((p) => settle(p, count))
      }, SLIDE_MS + (fromStart ? 50 : 0))
    },
    [count, reduced]
  )

  const moveByHand = (step: 1 | -1) => {
    move(step)
    setRestart((n) => n + 1)
  }

  // On screen at all? A browser without IntersectionObserver keeps it still; the arrows still work.
  useEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const running = playing && !held && inView && tabShown && !reduced && count > 1
  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => move(1), ADVANCE_EVERY_MS)
    return () => window.clearInterval(timer)
  }, [running, move, restart])

  const startSwipe = (e: PointerEvent) => {
    swipeFrom.current = e.clientX
  }
  const endSwipe = (e: PointerEvent) => {
    const from = swipeFrom.current
    swipeFrom.current = null
    if (from === null || Math.abs(e.clientX - from) < SWIPE_PX) return
    moveByHand(e.clientX < from ? 1 : -1)
  }

  return (
    <div
      ref={root}
      role="region"
      aria-roledescription="carousel"
      aria-label="Photos of unwnd. café"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHeld(false)
      }}
    >
      <div className="flex justify-end px-8 pb-3 md:px-16 motion-reduce:hidden">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pause the photos' : 'Play the photos'}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-hair-2 px-4 text-[11px] uppercase tracking-[0.2em] text-ink-2 transition-colors hover:border-foreground hover:text-foreground"
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
          {playing ? 'Pause' : 'Play'}
        </button>
      </div>
      <div
        className="relative touch-pan-y overflow-hidden"
        onPointerDown={startSwipe}
        onPointerUp={endSwipe}
        onPointerCancel={() => {
          swipeFrom.current = null
        }}
      >
        <div
          className={TRACK}
          style={{
            transform: `translateX(calc(${position} * -100% / var(--per-view)))`,
            transition: glide && !reduced ? `transform ${SLIDE_MS}ms ${GLIDE_EASE}` : 'none',
          }}
        >
          {strip.map(({ item, copy }, i) =>
            copy ? (
              <div key={`copy-${i}`} aria-hidden="true" className={SLOT}>
                <Image src={item.src} alt="" width={HIGHLIGHT_WIDTH} height={HIGHLIGHT_HEIGHT} sizes={SIZES} draggable={false} className={PHOTO} />
              </div>
            ) : (
              <div key={item.src} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`} className={SLOT}>
                <Image src={item.src} alt={item.alt} width={HIGHLIGHT_WIDTH} height={HIGHLIGHT_HEIGHT} sizes={SIZES} draggable={false} className={PHOTO} />
              </div>
            )
          )}
        </div>
        <button type="button" onClick={() => moveByHand(-1)} aria-label="Previous photo" className={`${ARROW} left-3 sm:left-5`}>
          <Chevron direction="left" />
        </button>
        <button type="button" onClick={() => moveByHand(1)} aria-label="Next photo" className={`${ARROW} right-3 sm:right-5`}>
          <Chevron direction="right" />
        </button>
      </div>
    </div>
  )
}

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
      <rect x="1" width="3" height="10" />
      <rect x="6" width="3" height="10" />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
      <path d="M1 0l9 5-9 5z" />
    </svg>
  )
}
