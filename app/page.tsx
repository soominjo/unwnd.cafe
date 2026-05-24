import Link from 'next/link'
import Image from 'next/image'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'

// ─── Map embed ───────────────────────────────────────────────────────────────
// No API key required for basic Google Maps embed.
// Replace ADDRESS_QUERY with your real address when confirmed.
const ADDRESS_QUERY = 'Tuesday+St+Saint+Joseph+Village+Niog+Bacoor+Cavite+Philippines'
const MAP_EMBED_SRC = `https://maps.google.com/maps?q=${ADDRESS_QUERY}&output=embed&z=17`

const HOURS = [
  { days: 'Monday – Friday', time: '7:00 am – 6:00 pm' },
  { days: 'Saturday',        time: '8:00 am – 5:00 pm' },
  { days: 'Sunday',          time: '9:00 am – 4:00 pm' },
]

interface MenuItem {
  _id: string
  name: string
  price: number
  category: string
  image?: { asset: { _ref: string } }
}

async function getFeaturedItems(): Promise<MenuItem[]> {
  return client.fetch(
    `*[_type == "menuItem" && featured == true && available == true] | order(_createdAt asc) [0...6] {
      _id, name, price, category, image
    }`
  )
}

export default async function HomePage() {
  const featured = await getFeaturedItems()

  return (
    <main className="bg-background text-foreground">

      {/* ════════════════════════════════════════════════
          HERO — army green bg, cream text
      ════════════════════════════════════════════════ */}
      <section id="hero" className="relative min-h-screen flex flex-col justify-end bg-foreground overflow-hidden">
        {/* Subtle vignette — darkens corners to focus the eye on the type */}
        <div className="absolute inset-0 bg-gradient-to-b from-foreground/10 via-transparent to-foreground/50 pointer-events-none" />

        <div className="relative z-10 px-8 pb-16 md:px-16 md:pb-24">
          <h1
            className="font-serif text-cream lowercase leading-none tracking-tighter"
            style={{ fontSize: 'clamp(4rem, 15vw, 14rem)' }}
          >
            unwnd.cafe
          </h1>
          <p className="text-cream/60 text-xs uppercase tracking-[0.3em] mt-4 mb-10">
            A place to slow down &amp; savour
          </p>
          <Link
            href="/menu"
            className="inline-block border border-cream text-cream text-[11px] uppercase tracking-[0.25em] px-8 py-3 hover:bg-cream hover:text-foreground transition-all duration-300"
          >
            View Menu
          </Link>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          FEATURED — Sanity masonry grid
      ════════════════════════════════════════════════ */}
      {featured.length > 0 && (
        <section className="px-8 py-24 md:px-16 bg-background">
          <div className="flex items-baseline justify-between mb-16">
            <h2 className="font-serif text-4xl md:text-5xl lowercase tracking-tighter">
              featured.
            </h2>
            <Link
              href="/menu"
              className="text-[10px] uppercase tracking-[0.25em] text-muted hover:text-foreground transition-colors"
            >
              Full Menu →
            </Link>
          </div>

          <div className="columns-1 sm:columns-2 lg:columns-3 gap-8 space-y-8">
            {featured.map((item, i) => (
              <div
                key={item._id}
                className="break-inside-avoid border border-border overflow-hidden group"
              >
                {item.image ? (
                  <div className="relative overflow-hidden aspect-[4/3]">
                    <Image
                      src={urlFor(item.image).width(600).url()}
                      alt={item.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                    />
                  </div>
                ) : (
                  <div
                    className="bg-border"
                    style={{ aspectRatio: i % 3 === 1 ? '4/5' : '4/3' }}
                  />
                )}
                <div className="p-6">
                  <span className="text-[10px] uppercase tracking-widest text-muted">
                    {item.category}
                  </span>
                  <h3 className="font-serif text-xl mt-1 tracking-tight">{item.name}</h3>
                  <p className="text-sm font-light mt-1">₱{item.price.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════════════
          ABOUT  id="about"
      ════════════════════════════════════════════════ */}
      <section id="about" className="bg-background py-24 md:py-32 scroll-mt-20">
        {/* Opening statement — two-column: image left, text right */}
        <div className="px-8 md:px-16 mb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left: landscape editorial photo */}
            <div className="relative aspect-4/3 overflow-hidden rounded-md">
              <Image
                src="/unwnd-about.jpg"
                alt="unwnd. café interior"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>

            {/* Right: heading + body + CTA */}
            <div className="flex flex-col justify-center">
              <h2
                className="font-serif lowercase tracking-tighter leading-tight text-foreground mb-6"
                style={{ fontSize: 'clamp(2.5rem, 5vw, 5rem)' }}
              >
                neighborhood<br />specialty coffee.
              </h2>
              <p className="text-base font-light leading-relaxed text-foreground/70 mb-8">
                unwnd. is your neighborhood specialty café — rooted in Bacoor, brewed with intention.
                We believe great coffee doesn&apos;t have to be intimidating. It just has to be honest,
                carefully made, and shared with the people around you.
              </p>
              <Link
                href="/menu"
                className="self-start text-sm font-medium uppercase tracking-widest text-foreground relative after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 hover:after:w-full after:bg-current after:transition-all after:duration-300"
              >
                View Menu →
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-border mx-8 md:mx-16 mb-24" />

        {/* Two-column editorial */}
        <div className="px-8 md:px-16 grid md:grid-cols-2 gap-16 md:gap-32 mb-24">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted block mb-6">
              Our Philosophy
            </span>
            <p className="font-light leading-relaxed">
              We don&apos;t rush anything here. Our cold brew steeps for 24 hours. Our baristas
              have time to talk. The music is always at the right volume. We exist to offer
              you a pause in an otherwise relentless day.
            </p>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted block mb-6">
              The Craft
            </span>
            <p className="font-light leading-relaxed">
              Sourced from small farms, brewed with intention. We work directly with producers
              who share our obsession with quality and transparency. Every cup carries the
              story of where it came from and who grew it.
            </p>
          </div>
        </div>

        {/* Pull quote */}
        <div className="px-8 md:px-16">
          <blockquote
            className="font-serif italic lowercase tracking-tight leading-tight text-center"
            style={{ fontSize: 'clamp(2rem, 5vw, 4.5rem)' }}
          >
            &ldquo;the best coffee<br />is the one you remember.&rdquo;
          </blockquote>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          CONTACT  id="contact"
      ════════════════════════════════════════════════ */}
      <section id="contact" className="bg-background scroll-mt-20">
        <div className="border-t border-border mx-8 md:mx-16 mb-0" />

        {/* Section header */}
        <div className="px-8 md:px-16 pt-20 pb-12">
          <h2
            className="font-serif lowercase tracking-tighter leading-none"
            style={{ fontSize: 'clamp(3rem, 8vw, 7rem)' }}
          >
            find us.
          </h2>
          <p className="text-muted text-[11px] uppercase tracking-[0.3em] mt-4">
            Come for the coffee. Stay for the quiet.
          </p>
        </div>

        {/* Two-column grid: info + map */}
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[70vh]">
          {/* Left: info */}
          <div className="px-8 md:px-16 py-12 flex flex-col justify-between gap-16 border-r border-border">
            {/* Address */}
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted block mb-5">
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

            {/* Hours */}
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted block mb-5">
                Hours
              </span>
              <dl className="space-y-3">
                {HOURS.map(({ days, time }) => (
                  <div
                    key={days}
                    className="flex justify-between items-baseline gap-8 border-b border-border pb-3 last:border-0"
                  >
                    <dt className="text-sm font-light text-muted">{days}</dt>
                    <dd className="text-sm font-light tabular-nums">{time}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Contact emails */}
            <div>
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted block mb-5">
                Get in Touch
              </span>
              <div className="space-y-3">
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

            <p className="text-[11px] text-muted font-light leading-relaxed max-w-xs">
              Located in Saint Joseph Village, Niog, Bacoor, Cavite.
            </p>
          </div>

          {/* Right: map with grayscale filter */}
          <div className="relative min-h-[400px] lg:min-h-0 overflow-hidden">
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
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

            {/* Overlay pin label */}
            <div className="absolute bottom-8 left-8 z-10 bg-foreground text-cream px-5 py-3 pointer-events-none">
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
