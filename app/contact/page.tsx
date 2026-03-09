// ─── Map embed note ────────────────────────────────────────────────────────
// The iframe uses Google Maps embed (no API key required for basic embeds).
// Replace the `src` URL below with your real address once confirmed.
// Grayscale + high-contrast styling is applied via CSS filter on the wrapper.
// For full custom JSON map styles, swap to Google Maps JS API or Mapbox GL JS
// and drop your token into .env.local as NEXT_PUBLIC_MAPBOX_TOKEN.
// ───────────────────────────────────────────────────────────────────────────

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Contact — unwnd.',
  description: 'Find us, reach us, or just say hello.',
}

const HOURS = [
  { days: 'Monday – Friday', time: '7:00 am – 6:00 pm' },
  { days: 'Saturday', time: '8:00 am – 5:00 pm' },
  { days: 'Sunday', time: '9:00 am – 4:00 pm' },
]

// ↓ Replace with your real address; this encodes into the Google Maps embed URL
const ADDRESS_QUERY = 'unwnd+cafe'
const MAP_EMBED_SRC = `https://maps.google.com/maps?q=${ADDRESS_QUERY}&output=embed&z=16`

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-white text-foreground pt-32 pb-0">
      {/* ─── Page header ─── */}
      <header className="px-8 md:px-16 mb-16">
        <h1
          className="font-serif lowercase tracking-tighter leading-none"
          style={{ fontSize: 'clamp(3rem, 8vw, 7rem)' }}
        >
          find us.
        </h1>
        <p className="text-muted text-[11px] uppercase tracking-[0.3em] mt-4">
          Come for the coffee. Stay for the quiet.
        </p>
      </header>

      {/* ─── Two-column grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[70vh]">
        {/* ── Left: Info column ── */}
        <div className="px-8 md:px-16 py-12 flex flex-col justify-between gap-16 border-r border-border">
          {/* Address */}
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted block mb-5">
              Location
            </span>
            <address className="not-italic">
              <p className="font-serif text-3xl lowercase tracking-tight leading-snug">
                unwnd. café<br />
                {/* ↓ Replace with your real address */}
                123 stillwater lane<br />
                your city, state 00000
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
                <div key={days} className="flex justify-between items-baseline gap-8 border-b border-border pb-3 last:border-0">
                  <dt className="text-sm font-light text-muted">{days}</dt>
                  <dd className="text-sm font-light tabular-nums">{time}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Contact */}
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

          {/* Parking note */}
          <p className="text-[11px] text-muted font-light leading-relaxed max-w-xs">
            Street parking available on Stillwater Lane. Nearest transit stop: 2 min walk.
          </p>
        </div>

        {/* ── Right: Map ── */}
        <div className="relative min-h-[400px] lg:min-h-0 overflow-hidden">
          {/*
            CSS filter stack applied to the wrapper:
              grayscale(1)      → strips all colour
              contrast(1.3)     → punches up blacks/whites
              brightness(0.85)  → darkens slightly for a moodier feel
            This works on any iframe/image without touching the Maps API.
          */}
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
          <div className="absolute bottom-8 left-8 z-10 bg-black text-white px-5 py-3 pointer-events-none">
            <p className="font-serif text-lg lowercase tracking-tight">unwnd.</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 mt-0.5">
              specialty café
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
