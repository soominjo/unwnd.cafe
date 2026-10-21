import { client } from '@/sanity/lib/client'
import { GOOGLE_REVIEWS_ID } from '@/sanity/singletons'

/** The "Google reviews" document as Studio stores it. Anything may be missing until it's filled in. */
export interface GoogleReviewsDoc {
  rating?: number | null
  reviewCount?: number | null
  reviews?: GoogleReviewDoc[] | null
}

interface GoogleReviewDoc {
  _key: string
  quote?: string | null
  name?: string | null
  date?: string | null
  stars?: number | null
}

/** One review as the home page shows it. */
export interface ShownReview {
  key: string
  quote: string
  name: string
  /** "October 2026", or null when no month was given. */
  month: string | null
  stars: number
}

/** What the home page shows: the rating pill and score need `rating`, the cards need `reviews`. */
export interface ShownReviews {
  rating: number | null
  count: number | null
  reviews: ShownReview[]
}

const MONTH_YEAR = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** A Studio date ("2026-10-05") as the month it names: "October 2026". */
export function formatReviewMonth(date: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(date ?? '')
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (month < 1 || month > 12) return null
  return MONTH_YEAR.format(new Date(Date.UTC(year, month - 1, 1)))
}

function isWholeNumberIn(value: number | null | undefined, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

// Quotation marks typed around the words: the cards add their own.
const SURROUNDING_QUOTES = /^["“”]+|["“”]+$/g

function toShownReview(review: GoogleReviewDoc): ShownReview | null {
  const quote = (review.quote ?? '').trim().replace(SURROUNDING_QUOTES, '').trim()
  const name = (review.name ?? '').trim()
  if (!quote || !name) return null
  return {
    key: review._key,
    quote,
    name,
    month: formatReviewMonth(review.date),
    stars: isWholeNumberIn(review.stars, 1, 5) ? review.stars : 5,
  }
}

/**
 * What the home page should show from the published document, or null when there is nothing
 * to show: no usable rating and no usable review.
 */
export function toShownReviews(doc: GoogleReviewsDoc | null): ShownReviews | null {
  if (!doc) return null
  const { rating, reviewCount } = doc
  const shownRating = typeof rating === 'number' && rating >= 1 && rating <= 5 ? Math.round(rating * 10) / 10 : null
  const count = isWholeNumberIn(reviewCount, 1, Infinity) ? reviewCount : null
  const reviews = (doc.reviews ?? []).map(toShownReview).filter((r): r is ShownReview => r !== null)
  if (shownRating === null && reviews.length === 0) return null
  return { rating: shownRating, count, reviews }
}

/**
 * The published Google reviews, read through the API CDN (published documents only). Never
 * throws: when Sanity can't be read the home page simply goes without them.
 */
export async function loadGoogleReviews(): Promise<ShownReviews | null> {
  try {
    const doc = await client.fetch<GoogleReviewsDoc | null>(
      `*[_id == $id][0]{ rating, reviewCount, reviews[]{ _key, quote, name, date, stars } }`,
      { id: GOOGLE_REVIEWS_ID }
    )
    return toShownReviews(doc)
  } catch (error) {
    console.error('Google reviews could not be loaded', error)
    return null
  }
}
