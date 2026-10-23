import FadeUp from '@/components/FadeUp'
import type { ShownReviews } from '@/lib/googleReviews'
import ReviewsMarquee from './ReviewsMarquee'
import Stars from './Stars'

interface ReviewsSectionProps {
  reviews: ShownReviews
  /** The café on Google Maps, where the reviews are read and written. */
  reviewUrl: string
}

const reviewsOnGoogle = (count: number | null) =>
  count == null ? 'on Google' : `${count} ${count === 1 ? 'review' : 'reviews'} on Google`

const BUTTON =
  'inline-flex min-h-11.5 items-center justify-center gap-2 px-5.5 text-[11.5px] uppercase tracking-[0.2em] transition-colors duration-300'

// "kind words.": the Google rating and every review published in Studio, sliding by as a marquee
// (ReviewsMarquee) that the guest can pause.
export default function ReviewsSection({ reviews, reviewUrl }: ReviewsSectionProps) {
  const { rating, count, reviews: list } = reviews

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="bg-background scroll-mt-20">
      <div className="border-t border-border mx-8 md:mx-16" />

      <div className="px-8 md:px-16 pt-10 md:pt-14">
        <FadeUp>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted block mb-3">
                Google reviews
              </span>
              <h2
                id="reviews-title"
                className="font-serif lowercase tracking-tighter leading-none"
                style={{ fontSize: 'clamp(2.5rem, 7vw, 5.5rem)' }}
              >
                kind words.
              </h2>
              {rating != null && (
                <div className="mt-5 flex items-center gap-3.5">
                  <span className="font-serif text-[64px] font-medium leading-[0.9]">{rating.toFixed(1)}</span>
                  <span>
                    <Stars
                      filled={rating}
                      label={`Rated ${rating.toFixed(1)} out of 5`}
                      className="block text-[17px] tracking-[0.08em] text-gold"
                    />
                    <span className="text-[13px] text-ink-2">{reviewsOnGoogle(count)}</span>
                  </span>
                </div>
              )}
            </div>
            <p className="max-w-[36ch] text-[14.5px] font-light text-ink-2">
              What guests say after a night at <span className="font-logo">unwnd.</span>
            </p>
          </div>
        </FadeUp>
      </div>

      {list.length > 0 && <ReviewsMarquee reviews={list} />}

      <div className="flex flex-wrap gap-2.5 px-8 pt-6.5 pb-12 md:px-16 md:pb-16">
        <a
          href={reviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BUTTON} border border-foreground bg-foreground text-cream hover:bg-foreground/85`}
        >
          Read them on Google <span aria-hidden="true">↗</span>
          <span className="sr-only"> (opens Google Maps)</span>
        </a>
        <a
          href={reviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BUTTON} border border-hair-2 text-foreground hover:border-foreground`}
        >
          Leave a review <span aria-hidden="true">↗</span>
          <span className="sr-only"> (opens Google Maps)</span>
        </a>
      </div>
    </section>
  )
}
