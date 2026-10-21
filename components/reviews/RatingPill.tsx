import Stars from './Stars'

interface RatingPillProps {
  rating: number
  count: number | null
}

// The hero's "★★★★★ 5.0 on Google · 34 reviews", linking down to the reviews.
export default function RatingPill({ rating, count }: RatingPillProps) {
  return (
    <a
      href="#reviews"
      className="inline-flex items-center gap-2 rounded-full border border-cream/30 bg-cream/15 px-3 py-1.5 text-[12.5px] text-cream backdrop-blur-sm transition-colors hover:bg-cream/25"
    >
      <Stars filled={rating} className="text-xs tracking-[0.06em] text-[#E9C46A]" />
      <span>
        <b className="font-semibold">{rating.toFixed(1)}</b> on Google
        {count != null && ` · ${count} ${count === 1 ? 'review' : 'reviews'}`}
      </span>
    </a>
  )
}
