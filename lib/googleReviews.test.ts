import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { fetch } = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/sanity/lib/client', () => ({ client: { fetch } }))

import { formatReviewMonth, toShownReviews, loadGoogleReviews } from './googleReviews'

const review = { _key: 'a', quote: 'Great coffee!', name: 'Ana', date: '2026-10-05', stars: 5 }

describe('formatReviewMonth', () => {
  it('turns a Studio date into month and year', () => {
    expect(formatReviewMonth('2026-10-05')).toBe('October 2026')
    expect(formatReviewMonth('2026-01-31')).toBe('January 2026')
  })

  it('gives no month for a missing or broken date', () => {
    for (const d of [null, undefined, '', '2026-13-01', '2026-00-10', 'soon']) expect(formatReviewMonth(d)).toBeNull()
  })
})

describe('toShownReviews', () => {
  it('keeps the rating to one decimal, with the count', () => {
    expect(toShownReviews({ rating: 4.86, reviewCount: 34, reviews: [] })).toEqual({ rating: 4.9, count: 34, reviews: [] })
  })

  it('drops a rating outside 1–5 and a count below 1', () => {
    expect(toShownReviews({ rating: 7, reviewCount: 0, reviews: [review] })).toMatchObject({ rating: null, count: null })
    expect(toShownReviews({ rating: 0.5, reviewCount: 2.5, reviews: [review] })).toMatchObject({ rating: null, count: null })
  })

  it('skips reviews without words or a name, trims, and strips quotation marks typed around the words', () => {
    const shown = toShownReviews({ reviews: [
      { _key: 'a', quote: '  “Great coffee!”  ', name: ' Ana ', date: '2026-10-05', stars: 5 },
      { _key: 'b', quote: '', name: 'Ben' },
      { _key: 'c', quote: 'Nice', name: '  ' },
      { _key: 'd', quote: '"Cosy garden"', name: 'Cy', date: null, stars: null },
    ] })
    expect(shown?.reviews).toEqual([
      { key: 'a', quote: 'Great coffee!', name: 'Ana', month: 'October 2026', stars: 5 },
      { key: 'd', quote: 'Cosy garden', name: 'Cy', month: null, stars: 5 },
    ])
  })

  it('shows 5 stars unless the review has a whole number from 1 to 5', () => {
    const starsOf = (stars: number | null) => toShownReviews({ reviews: [{ ...review, stars }] })?.reviews[0].stars
    expect(starsOf(null)).toBe(5)
    expect(starsOf(9)).toBe(5)
    expect(starsOf(0)).toBe(5)
    expect(starsOf(4.5)).toBe(5)
    expect(starsOf(3)).toBe(3)
    expect(starsOf(1)).toBe(1)
  })

  it('gives nothing to show without a rating or a review', () => {
    expect(toShownReviews(null)).toBeNull()
    expect(toShownReviews({})).toBeNull()
    expect(toShownReviews({ reviewCount: 34 })).toBeNull()
    expect(toShownReviews({ reviews: [{ _key: 'x', quote: ' ', name: 'Ana' }] })).toBeNull()
  })

  it('shows the section for a rating alone', () => {
    expect(toShownReviews({ rating: 5 })).toEqual({ rating: 5, count: null, reviews: [] })
  })
})

describe('loadGoogleReviews', () => {
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetch.mockReset()
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleError.mockRestore()
  })

  it('reads the published Google reviews document by its id', async () => {
    fetch.mockResolvedValue({ rating: 5, reviewCount: 34, reviews: [review] })
    expect(await loadGoogleReviews()).toEqual({
      rating: 5, count: 34, reviews: [{ key: 'a', quote: 'Great coffee!', name: 'Ana', month: 'October 2026', stars: 5 }],
    })
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('_id == $id'), { id: 'google-reviews' })
  })

  it('gives nothing when the document has not been published yet', async () => {
    fetch.mockResolvedValue(null)
    expect(await loadGoogleReviews()).toBeNull()
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('gives nothing and logs when Sanity cannot be read, so the home page still renders', async () => {
    fetch.mockRejectedValue(new Error('offline'))
    expect(await loadGoogleReviews()).toBeNull()
    expect(consoleError).toHaveBeenCalledWith('Google reviews could not be loaded', expect.any(Error))
  })
})
