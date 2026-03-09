import Link from 'next/link'

const SOCIAL = [
  {
    label: 'Instagram',
    href: 'https://instagram.com/unwnd.cafe',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: 'TikTok',
    href: 'https://tiktok.com/@unwnd.cafe',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.53V6.77a4.85 4.85 0 01-1.02-.08z" />
      </svg>
    ),
  },
  {
    label: 'Facebook',
    href: 'https://facebook.com/unwndcafe',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
      </svg>
    ),
  },
]

const FOOTER_NAV = [
  { href: '/', label: 'Home' },
  { href: '/menu', label: 'Menu' },
  { href: '/about', label: 'About' },
]

export default function Footer() {
  return (
    <footer className="border-t border-border bg-white px-8 md:px-16 py-12">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
        {/* Brand */}
        <Link href="/" className="font-serif text-2xl lowercase tracking-tighter shrink-0">
          unwnd.
        </Link>

        {/* Nav links */}
        <nav className="flex gap-8" aria-label="Footer navigation">
          {FOOTER_NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-[10px] uppercase tracking-[0.25em] text-muted hover:text-foreground transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Social */}
        <div className="flex items-center gap-5">
          {SOCIAL.map(({ label, href, icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className="text-muted hover:text-foreground transition-colors"
            >
              {icon}
            </a>
          ))}
        </div>
      </div>

      <p className="mt-10 text-[10px] text-muted tracking-[0.15em]">
        © {new Date().getFullYear()} unwnd. café — prices for estimation only, order at counter.
      </p>
    </footer>
  )
}
