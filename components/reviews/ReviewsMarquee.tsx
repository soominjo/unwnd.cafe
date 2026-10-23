'use client'

import { useState, type CSSProperties } from 'react'
import type { ShownReview } from '@/lib/googleReviews'
import Stars from './Stars'
import { SECONDS_PER_CARD, fillLoop, splitIntoRows } from './marquee'

interface ReviewsMarqueeProps {
  reviews: ShownReview[]
}

interface MarqueeViewProps extends ReviewsMarqueeProps {
  paused: boolean
  onTogglePause: () => void
}

/** Quotes longer than this are set smaller, so one long review doesn't stretch every card in its row. */
const LONG_QUOTE = 110

// "kind words." moving: every published review slides by, in one row or, from TWO_ROWS_FROM reviews,
// two rows running opposite ways. Hovering or focusing a row stops it, and so does Pause (moving
// content needs a way to stop it, WCAG 2.2.2). With reduced motion nothing moves: each row is a
// rail to swipe instead.
export default function ReviewsMarquee({ reviews }: ReviewsMarqueeProps) {
  const [paused, setPaused] = useState(false)
  return <MarqueeView reviews={reviews} paused={paused} onTogglePause={() => setPaused((p) => !p)} />
}

export function MarqueeView({ reviews, paused, onTogglePause }: MarqueeViewProps) {
  const rows = splitIntoRows(reviews)
  if (rows.length === 0) return null

  return (
    <div className="mt-7">
      <div className="flex justify-end px-8 pb-3 md:px-16 motion-reduce:hidden">
        <button
          type="button"
          onClick={onTogglePause}
          aria-label={paused ? 'Play the reviews' : 'Pause the reviews'}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-hair-2 px-4 text-[11px] uppercase tracking-[0.2em] text-ink-2 transition-colors hover:border-foreground hover:text-foreground motion-reduce:hidden"
        >
          {paused ? <PlayIcon /> : <PauseIcon />}
          {paused ? 'Play' : 'Pause'}
        </button>
      </div>
      <div className="group/marquee space-y-3 sm:space-y-4">
        {rows.map((row, i) => (
          <MarqueeRow key={i} row={row} reverse={i === 1} paused={paused} />
        ))}
      </div>
    </div>
  )
}

interface MarqueeRowProps {
  row: ShownReview[]
  reverse: boolean
  paused: boolean
}

// A row's track. The animation is set property by property: the `animation` shorthand would reset
// the play state that hover, focus and Pause set.
const TRACK =
  'flex w-max motion-safe:[animation-name:marquee] [animation-duration:var(--marquee-duration)] [animation-timing-function:linear] [animation-iteration-count:infinite] group-hover/marquee:[animation-play-state:paused] group-focus-within/marquee:[animation-play-state:paused] motion-reduce:pl-8 md:motion-reduce:pl-16'

// A card's place in the track: its right padding, not the track's gap, spaces the cards.
const CARD_SLOT = 'shrink-0 pr-3 sm:pr-4 lg:pr-5 motion-reduce:snap-start'

// Class lists with optional parts. Every class stays in a quoted string of its own: Tailwind does
// not find a class written straight against a template's ${…}.
const classes = (...names: (string | false)[]) => names.filter(Boolean).join(' ')

// One row: its loop twice over, slid left by half its width (one loop) and round again. With the
// cards spaced by their own padding, half the width is exactly one loop. Only the first showing of
// each review is read out.
function MarqueeRow({ row, reverse, paused }: MarqueeRowProps) {
  const loop = fillLoop(row)
  const duration = { '--marquee-duration': `${loop.length * SECONDS_PER_CARD}s` } as CSSProperties

  return (
    <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_5%,#000_95%,transparent)] motion-reduce:snap-x motion-reduce:snap-mandatory motion-reduce:overflow-x-auto motion-reduce:scroll-pl-8 motion-reduce:[scrollbar-width:none] md:motion-reduce:scroll-pl-16 motion-reduce:[&::-webkit-scrollbar]:hidden">
      <ul
        role="list"
        style={duration}
        className={classes(TRACK, reverse && '[animation-direction:reverse]', paused && '[animation-play-state:paused]')}
      >
        {[0, 1].map((half) =>
          loop.map(({ item, copy }) => {
            const repeat = half > 0 || copy > 0
            return (
              <li
                key={`${half}-${copy}-${item.key}`}
                aria-hidden={repeat || undefined}
                className={classes(CARD_SLOT, repeat && 'motion-reduce:hidden')}
              >
                <ReviewCard review={item} />
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

function ReviewCard({ review }: { review: ShownReview }) {
  const size = review.quote.length > LONG_QUOTE ? 'text-[1.08rem]' : 'text-[1.32rem]'
  return (
    <figure className="m-0 flex h-full w-70 flex-col gap-3 rounded-[14px] border border-hair bg-paper px-5 pt-5.5 pb-4.5 sm:w-80 lg:w-90">
      <Stars filled={review.stars} label={`${review.stars} out of 5 stars`} className="text-sm tracking-[0.08em] text-gold" />
      <blockquote className={`m-0 line-clamp-6 font-serif italic leading-tight ${size}`}>“{review.quote}”</blockquote>
      <figcaption className="mt-auto text-[12.5px] text-ink-2">
        {review.name}
        {review.month && ` · ${review.month}`}
      </figcaption>
    </figure>
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
