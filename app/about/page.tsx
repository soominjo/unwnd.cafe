export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white text-foreground pt-32 pb-24">
      {/* ─── Opening statement ─── */}
      <section className="px-8 md:px-16 mb-32">
        <h1
          className="font-serif lowercase tracking-tighter leading-[0.9] mb-16"
          style={{ fontSize: 'clamp(3.5rem, 10vw, 9rem)' }}
        >
          a place<br />to unwind.
        </h1>
        <div className="max-w-lg ml-auto">
          <p className="text-lg font-light leading-relaxed text-muted">
            unwnd. is a specialty café born from the belief that slowing down is a radical act.
            Every detail — from the ceramics on the shelf to the temperature of your pour —
            is considered, deliberate, and quiet.
          </p>
        </div>
      </section>

      {/* ─── Divider ─── */}
      <div className="border-t border-border mx-8 md:mx-16 mb-32" />

      {/* ─── Two-column editorial ─── */}
      <section className="px-8 md:px-16 grid md:grid-cols-2 gap-16 md:gap-32 mb-32">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted block mb-6">
            Our Philosophy
          </span>
          <p className="font-light leading-relaxed">
            We don't rush anything here. Our cold brew steeps for 24 hours. Our baristas
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
      </section>

      {/* ─── Pull quote ─── */}
      <section className="px-8 md:px-16 mb-32">
        <blockquote
          className="font-serif italic lowercase tracking-tight leading-tight text-center"
          style={{ fontSize: 'clamp(2rem, 5vw, 4.5rem)' }}
        >
          &ldquo;the best coffee<br />is the one you remember.&rdquo;
        </blockquote>
      </section>

      {/* ─── Divider ─── */}
      <div className="border-t border-border mx-8 md:mx-16 mb-32" />

      {/* ─── Visit section ─── */}
      <section className="px-8 md:px-16 grid md:grid-cols-3 gap-12">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted block mb-4">
            Hours
          </span>
          <p className="font-light text-sm leading-loose">
            Mon – Fri: 7am – 6pm<br />
            Sat – Sun: 8am – 5pm
          </p>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted block mb-4">
            Location
          </span>
          <p className="font-light text-sm leading-loose">
            unwnd. café<br />
            — address coming soon
          </p>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-muted block mb-4">
            Contact
          </span>
          <p className="font-light text-sm leading-loose">
            hello@unwnd.cafe<br />
            @unwnd.cafe
          </p>
        </div>
      </section>
    </main>
  )
}
