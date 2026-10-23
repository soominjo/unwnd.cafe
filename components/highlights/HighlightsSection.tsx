import FadeUp from '@/components/FadeUp'
import HighlightsCarousel from './HighlightsCarousel'
import { HIGHLIGHT_PHOTOS } from './photos'

// "life at unwnd.": a look around the café in seven photos, from the driveway to the garden,
// sliding along on their own (HighlightsCarousel). It sits between About and the reviews.
export default function HighlightsSection() {
  return (
    <section id="highlights" aria-labelledby="highlights-title" className="bg-background scroll-mt-20">
      <div className="border-t border-border mx-8 md:mx-16" />

      <div className="px-8 md:px-16 pt-10 md:pt-14">
        <FadeUp>
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted block mb-3">
            Highlights
          </span>
          <h2
            id="highlights-title"
            className="font-serif lowercase tracking-tighter leading-none"
            style={{ fontSize: 'clamp(2.5rem, 7vw, 5.5rem)' }}
          >
            life at{' '}<span className="font-logo">unwnd.</span>
          </h2>
          <p className="mt-4 max-w-[36ch] text-[14.5px] font-light text-ink-2">
            A look around, from the driveway to the garden.
          </p>
        </FadeUp>
      </div>

      <div className="mt-7 pb-12 md:pb-16">
        <HighlightsCarousel photos={HIGHLIGHT_PHOTOS} />
      </div>
    </section>
  )
}
