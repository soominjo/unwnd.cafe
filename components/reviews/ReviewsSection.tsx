import FadeUp from '@/components/FadeUp'
import type { ShownReviews } from '@/lib/googleReviews'
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

// "kind words.": the Google rating and the reviews the owner picked in Studio. Phones swipe
// through the cards; wide screens see three across.
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
              {list.length > 1 && <span className="lg:hidden whitespace-nowrap text-xs"> Swipe for more →</span>}
            </p>
          </div>
        </FadeUp>
      </div>

      {list.length > 0 && (
        <ul
          role="list"
          className={`mt-7 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-8 pt-0.5 pb-2.5 scroll-px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4 md:px-16 md:scroll-px-16 lg:grid lg:gap-5 lg:overflow-visible ${
            // Four in one row rather than three and one left on its own.
            list.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'
          }`}
        >
          {list.map((review) => (
            <li key={review.key} className="shrink-0 basis-[84%] snap-start sm:basis-[44%] lg:basis-auto">
              <figure className="m-0 flex h-full flex-col gap-3 rounded-[14px] border border-hair bg-paper px-5 pt-5.5 pb-4.5">
                <Stars
                  filled={review.stars}
                  label={`${review.stars} out of 5 stars`}
                  className="text-sm tracking-[0.08em] text-gold"
                />
                <blockquote className="m-0 font-serif text-[1.32rem] italic leading-tight">
                  “{review.quote}”
                </blockquote>
                <figcaption className="mt-auto text-[12.5px] text-ink-2">
                  {review.name}
                  {review.month && ` · ${review.month}`}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}

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
