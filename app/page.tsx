import Link from 'next/link'
import Image from 'next/image'
import FadeUp from '@/components/FadeUp'

// ─── Map embed ───────────────────────────────────────────────────────────────
const MAP_EMBED_SRC = 'https://maps.google.com/maps?q=Unwnd+Cafe+Bacoor+Tuesday+St+Niog+I+Saint+Joseph+Village+Bacoor+Cavite&output=embed&z=17'

const HOURS = [
  { days: 'Monday – Thursday', time: '5:00 pm – 11:00 pm' },
  { days: 'Friday – Sunday',   time: '5:00 pm – 12:00 am' },
]

export default function HomePage() {
  return (
    <main className="bg-background text-foreground">

      {/* ════════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════════ */}
      <section id="hero" className="relative min-h-screen flex flex-col justify-end bg-foreground overflow-hidden">
        <Image
          src="/unwnd.cafe-bacground.jpeg"
          alt="unwnd. café"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-linear-to-b from-foreground/30 via-foreground/20 to-foreground/70 pointer-events-none" />

        <div className="relative z-10 px-8 pb-16 md:px-16 md:pb-24">
          <FadeUp delay={0.1}>
            <h1
              className="font-serif text-cream lowercase leading-none tracking-tighter"
              style={{ fontSize: 'clamp(4rem, 15vw, 14rem)' }}
            >
              unwnd.cafe
            </h1>
          </FadeUp>
          <FadeUp delay={0.35}>
            <p className="text-cream/60 text-xs uppercase tracking-[0.3em] mt-4 mb-10">
              A place to slow down &amp; savour
            </p>
          </FadeUp>
          <FadeUp delay={0.55}>
            <Link
              href="/menu"
              className="inline-block border border-cream text-cream text-[11px] uppercase tracking-[0.25em] px-8 py-3 hover:bg-cream hover:text-foreground transition-all duration-300"
            >
              View Menu
            </Link>
          </FadeUp>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          ABOUT
      ════════════════════════════════════════════════ */}
      <section id="about" className="bg-background pt-10 md:pt-14 pb-4 scroll-mt-20">
        <div className="px-8 md:px-16 mb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center">

            {/* Left: staggered portrait duo */}
            <FadeUp delay={0}>
              <div className="grid grid-cols-2 gap-3 items-end">
                <div className="relative aspect-3/4 overflow-hidden rounded-md">
                  <Image
                    src="/unwnd1.jpg"
                    alt="unwnd. café interior"
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover"
                  />
                </div>
                <div className="relative aspect-3/4 overflow-hidden rounded-md mb-8">
                  <Image
                    src="/unwnd2.jpg"
                    alt="unwnd. café outdoor seating"
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover"
                  />
                </div>
              </div>
            </FadeUp>

            {/* Right: heading + body + CTA */}
            <div className="flex flex-col justify-center">
              <FadeUp delay={0.1}>
                <h2
                  className="font-serif lowercase tracking-tighter leading-tight text-foreground mb-4"
                  style={{ fontSize: 'clamp(2rem, 4vw, 4rem)' }}
                >
                  neighborhood<br />specialty coffee.
                </h2>
              </FadeUp>
              <FadeUp delay={0.2}>
                <p className="text-base font-light leading-relaxed text-foreground/70 mb-5">
                  unwnd. is your neighborhood spot to breathe, belong, and sip something worth
                  slowing down for. Rooted in Bacoor, we exist for the moments between the rush —
                  where great coffee, good music, and the right company make everything feel a
                  little lighter.
                </p>
              </FadeUp>
              <FadeUp delay={0.3}>
                <Link
                  href="/menu"
                  className="self-start text-sm font-medium uppercase tracking-widest text-foreground relative after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 hover:after:w-full after:bg-current after:transition-all after:duration-300"
                >
                  View Menu →
                </Link>
              </FadeUp>
              <FadeUp delay={0.4}>
                <blockquote
                  className="font-serif italic lowercase tracking-tight leading-tight text-foreground/80 font-semibold mt-8"
                  style={{ fontSize: 'clamp(1.1rem, 2vw, 1.5rem)' }}
                >
                  &ldquo;the best coffee<br />is the one you remember.&rdquo;
                </blockquote>
              </FadeUp>
            </div>
          </div>
        </div>

        <div className="border-t border-border mx-8 md:mx-16 mb-10" />

        {/* Two-column editorial */}
        <div className="px-8 md:px-16 grid md:grid-cols-2 gap-8 md:gap-16 mb-10">
          <FadeUp delay={0}>
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted block mb-3">
              Unwind With Us
            </span>
            <p className="font-light leading-relaxed">
              unwnd. is exactly what it sounds like — a place to slow down, exhale, and just
              be. Whether you&apos;re catching up with friends, spending time with family, or
              simply enjoying your own company, this is your space to decompress. Good vibes,
              good music, and no rush.
            </p>
          </FadeUp>
          <FadeUp delay={0.15}>
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted block mb-3">
              The People Behind The Cup
            </span>
            <p className="font-light leading-relaxed">
              Our baristas come from some of the most respected cafés around — they bring that
              experience here, poured into every cup. Expect drinks made with real skill and
              genuine care, from people who actually love what they do.
            </p>
          </FadeUp>
        </div>

      </section>

      {/* ════════════════════════════════════════════════
          CONTACT
      ════════════════════════════════════════════════ */}
      <section id="contact" className="bg-background scroll-mt-20">
        <div className="border-t border-border mx-8 md:mx-16 mb-0" />

        <div className="px-8 md:px-16 pt-6 pb-6">
          <FadeUp delay={0}>
            <h2
              className="font-serif lowercase tracking-tighter leading-none"
              style={{ fontSize: 'clamp(3rem, 8vw, 7rem)' }}
            >
              find us.
            </h2>
            <p className="text-muted text-[11px] uppercase tracking-[0.3em] mt-4">
              Come for the coffee. Stay for the quiet.
            </p>
          </FadeUp>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[55vh]">
          {/* Left: info */}
          <div className="px-8 md:px-16 py-8 flex flex-col justify-between gap-8 border-r border-border">
            <FadeUp delay={0}>
              <div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-muted block mb-3">
                  Location
                </span>
                <address className="not-italic">
                  <p className="font-serif text-3xl lowercase tracking-tight leading-snug">
                    unwnd. café<br />
                    tuesday st.<br />
                    saint joseph village niog<br />
                    bacoor, cavite
                  </p>
                </address>
              </div>
            </FadeUp>

            <FadeUp delay={0.1}>
              <div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-muted block mb-3">
                  Hours
                </span>
                <dl className="space-y-2">
                  {HOURS.map(({ days, time }) => (
                    <div
                      key={days}
                      className="flex justify-between items-baseline gap-8 border-b border-border pb-2 last:border-0"
                    >
                      <dt className="text-sm font-light text-muted">{days}</dt>
                      <dd className="text-sm font-light tabular-nums">{time}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </FadeUp>

            <FadeUp delay={0.2}>
              <div>
                <span className="text-[10px] uppercase tracking-[0.3em] text-muted block mb-3">
                  Get in Touch
                </span>
                <div className="space-y-2">
                  <p className="text-sm font-light">
                    General enquiries:{' '}
                    <a
                      href="mailto:hello@unwnd.cafe"
                      className="underline underline-offset-4 hover:text-muted transition-colors"
                    >
                      hello@unwnd.cafe
                    </a>
                  </p>
                  <p className="text-sm font-light">
                    Events &amp; bookings:{' '}
                    <a
                      href="mailto:events@unwnd.cafe"
                      className="underline underline-offset-4 hover:text-muted transition-colors"
                    >
                      events@unwnd.cafe
                    </a>
                  </p>
                </div>
              </div>
            </FadeUp>

            <FadeUp delay={0.25}>
              <p className="text-[11px] text-muted font-light leading-relaxed max-w-xs">
                Located in Saint Joseph Village, Niog, Bacoor, Cavite.
              </p>
            </FadeUp>
          </div>

          {/* Right: map */}
          <div className="relative min-h-100 lg:min-h-0 overflow-hidden">
            <div
              className="absolute inset-0"
              style={{ filter: 'grayscale(1) contrast(1.3) brightness(0.85)' }}
            >
              <iframe
                title="unwnd. café location"
                src={MAP_EMBED_SRC}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                sandbox="allow-scripts allow-same-origin"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="absolute bottom-2 left-2 z-10 bg-foreground text-cream px-5 py-3 pointer-events-none">
              <p className="font-serif text-lg lowercase tracking-tight">unwnd.</p>
              <p className="text-[10px] uppercase tracking-[0.2em] text-cream/60 mt-0.5">
                specialty café
              </p>
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}
