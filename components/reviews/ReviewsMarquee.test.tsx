import { describe, it, expect } from 'vitest'
import { isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReviewsMarquee, { MarqueeView } from './ReviewsMarquee'
import type { ShownReview } from '@/lib/googleReviews'

const review = (n: number, quote = `Review number ${n}.`): ShownReview => ({
  key: `k${n}`,
  quote,
  name: `Guest ${n}`,
  month: 'October 2026',
  stars: 5,
})
const reviews = (count: number): ShownReview[] => Array.from({ length: count }, (_, i) => review(i + 1))
const render = (list: ShownReview[]) => renderToStaticMarkup(<ReviewsMarquee reviews={list} />)

const classesOf = (attrs = '') => /class="([^"]*)"/.exec(attrs)?.[1].split(/\s+/) ?? []
const text = (html: string) => html.replace(/<[^>]+>/g, '')

// Every card (an <li>) in the markup, in order: whether screen readers skip it, its classes and
// the number of the review it shows.
function cards(html: string) {
  return [...html.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/g)].map(([, attrs, inner]) => ({
    hidden: attrs.includes('aria-hidden="true"'),
    classes: classesOf(attrs),
    review: Number(/Review number (\d+)/.exec(text(inner))?.[1]),
  }))
}

// The moving rows: each <ul>'s opening tag.
const rows = (html: string) => html.match(/<ul\b[^>]*>/g) ?? []

// MarqueeView uses no hooks, so calling it returns its element tree; this finds a button in it by its accessible name.
function buttonNamed(node: ReactNode, name: string): { onClick: () => void } | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = buttonNamed(child, name)
      if (hit) return hit
    }
    return undefined
  }
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void; 'aria-label'?: string }>(node)) return undefined
  const { children, onClick } = node.props
  if (node.type === 'button' && node.props['aria-label'] === name && onClick) return { onClick }
  return buttonNamed(children, name)
}

describe('the reviews marquee', () => {
  it('fills a loop with repeats of a few reviews and runs it twice over, so it restarts without a jump', () => {
    // 3 reviews repeat 3 times to make a loop of 9 cards; the row holds that loop twice.
    expect(cards(render(reviews(3))).map((card) => card.review)).toEqual([
      1, 2, 3, 1, 2, 3, 1, 2, 3,
      1, 2, 3, 1, 2, 3, 1, 2, 3,
    ])
  })

  it('lets screen readers hear each review once, not every repeat', () => {
    const heard = cards(render(reviews(3))).filter((card) => !card.hidden)
    expect(heard.map((card) => card.review)).toEqual([1, 2, 3])
  })

  it('spaces the cards with their own padding, not the row gap, so half the row is exactly one loop', () => {
    const html = render(reviews(3))
    expect(classesOf(rows(html)[0]).filter((c) => c.startsWith('gap-'))).toEqual([])
    for (const card of cards(html)) expect(card.classes.some((c) => c.startsWith('pr-'))).toBe(true)
  })

  it('gives each card seven seconds, so a longer loop moves at the same pace', () => {
    expect(rows(render(reviews(3)))[0]).toContain('--marquee-duration:63s')
    // 9 reviews: rows of 5 and 4, each repeated to 10 and 8 cards.
    const [first, second] = rows(render(reviews(9)))
    expect(first).toContain('--marquee-duration:70s')
    expect(second).toContain('--marquee-duration:56s')
  })

  it('keeps fewer than eight reviews in one row, and runs the second of two rows the other way', () => {
    expect(rows(render(reviews(7)))).toHaveLength(1)
    const [first, second, third] = rows(render(reviews(8)))
    expect(third).toBeUndefined()
    expect(classesOf(first)).not.toContain('[animation-direction:reverse]')
    expect(classesOf(second)).toContain('[animation-direction:reverse]')
  })

  it('starts moving, with a Pause button, and stops while hovered or focused', () => {
    const html = render(reviews(3))
    expect(html).toContain('aria-label="Pause the reviews"')
    const row = classesOf(rows(html)[0])
    expect(row).not.toContain('[animation-play-state:paused]')
    expect(row).toContain('group-hover/marquee:[animation-play-state:paused]')
    expect(row).toContain('group-focus-within/marquee:[animation-play-state:paused]')
  })

  it('stops every row once paused, and offers Play', () => {
    const html = renderToStaticMarkup(<MarqueeView reviews={reviews(8)} paused onTogglePause={() => {}} />)
    expect(html).toContain('aria-label="Play the reviews"')
    expect(html).not.toContain('aria-label="Pause the reviews"')
    expect(rows(html).map((row) => classesOf(row).includes('[animation-play-state:paused]'))).toEqual([true, true])
  })

  it('pauses and plays from the button', () => {
    let toggles = 0
    const onTogglePause = () => {
      toggles += 1
    }
    buttonNamed(MarqueeView({ reviews: reviews(3), paused: false, onTogglePause }), 'Pause the reviews')?.onClick()
    buttonNamed(MarqueeView({ reviews: reviews(3), paused: true, onTogglePause }), 'Play the reviews')?.onClick()
    expect(toggles).toBe(2)
  })

  it('stands still for reduced motion: the repeats hide, the row swipes and Pause goes', () => {
    const html = render(reviews(3))
    for (const card of cards(html)) {
      expect(card.classes.includes('motion-reduce:hidden')).toBe(card.hidden)
      expect(card.classes).toContain('motion-reduce:snap-start')
    }
    const row = classesOf(rows(html)[0])
    expect(row).toContain('motion-safe:[animation-name:marquee]')
    expect(row).not.toContain('[animation-name:marquee]')
    expect(html).toContain('motion-reduce:overflow-x-auto')
    expect(classesOf(/<button\b([^>]*)>/.exec(html)?.[1] ?? '')).toContain('motion-reduce:hidden')
  })

  it('sets a long quote smaller, and clamps every quote, so one long review does not stretch its row', () => {
    const quoteClasses = (quote: string) => classesOf(/<blockquote\b([^>]*)>/.exec(render([review(1, quote)]))?.[1] ?? '')
    expect(quoteClasses('a'.repeat(110))).toContain('text-[1.32rem]')
    expect(quoteClasses('a'.repeat(111))).toContain('text-[1.08rem]')
    expect(quoteClasses('a'.repeat(111))).not.toContain('text-[1.32rem]')
    expect(quoteClasses('Short.')).toContain('line-clamp-6')
    expect(quoteClasses('a'.repeat(400))).toContain('line-clamp-6')
  })

  it('shows the stars, the words in quotation marks, the name and the month on each card', () => {
    const html = render([{ key: 'a', quote: 'Great coffee!', name: 'Ana', month: 'October 2026', stars: 4 }])
    expect(text(html)).toContain('“Great coffee!”')
    expect(text(html)).toContain('Ana · October 2026')
    expect(html).toContain('aria-label="4 out of 5 stars"')
    expect(text(render([{ key: 'b', quote: 'Lovely.', name: 'Ben', month: null, stars: 5 }]))).not.toContain('Ben ·')
  })

  it('renders nothing without reviews', () => {
    expect(render([])).toBe('')
  })
})
