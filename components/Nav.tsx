'use client'

import { useState, useEffect, startTransition } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { useCartStore } from '@/store/useCartStore'

const LEFT_LINKS = [
  { href: '/#about', label: 'About' },
  { href: '/#contact', label: 'Contact' },
]

const ALL_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/menu', label: 'Menu' },
  { href: '/#about', label: 'About' },
  { href: '/#contact', label: 'Contact' },
]

const EASE: [number, number, number, number] = [0.76, 0, 0.24, 1]

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: EASE } },
  exit:    { opacity: 0, transition: { duration: 0.3, ease: EASE } },
}

const linkVariants = {
  hidden: { y: 40, opacity: 0 },
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    transition: { delay: 0.1 + i * 0.08, duration: 0.5, ease: EASE },
  }),
  exit: (i: number) => ({
    y: -20,
    opacity: 0,
    transition: { delay: i * 0.04, duration: 0.3 },
  }),
}

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const itemCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0))
  const openTray = useCartStore((s) => s.openTray)

  // Close overlay on route change
  useEffect(() => { startTransition(() => setMenuOpen(false)) }, [pathname])

  // Intersection-based detection: stay transparent while hero is in view
  useEffect(() => {
    if (pathname !== '/') {
      startTransition(() => setScrolled(false))
      return
    }

    const hero = document.getElementById('hero')
    if (!hero) {
      // Fallback for missing hero element
      const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.9)
      onScroll()
      window.addEventListener('scroll', onScroll, { passive: true })
      return () => window.removeEventListener('scroll', onScroll)
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Trigger cream bg only when hero has scrolled fully above the viewport
        setScrolled(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0)
      },
      { threshold: 0 }
    )
    observer.observe(hero)
    return () => observer.disconnect()
  }, [pathname])

  if (pathname.startsWith('/studio')) return null

  const isHomePage = pathname === '/'
  // Transparent only on homepage before scrolling
  const isAtTop = isHomePage && !scrolled

  const bgClass     = isAtTop ? 'bg-transparent' : 'bg-background'
  const borderClass = isAtTop ? 'border-transparent' : 'border-foreground/20'
  const textBase    = isAtTop ? 'text-cream' : 'text-foreground'
  const textMuted   = isAtTop ? 'text-cream/60' : 'text-muted'
  const badgeBg     = isAtTop ? 'bg-cream text-foreground' : 'bg-foreground text-cream'
  // Animated underline: expands left-to-right on hover, colour matches current text
  const underline   = 'relative after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 hover:after:w-full after:bg-current after:transition-all after:duration-300'

  return (
    <>
      {/* ─── Scroll-aware sticky header ─── */}
      <header className={`fixed top-0 left-0 right-0 z-50 px-8 py-5 border-b transition-colors duration-400 ${bgClass} ${borderClass}`}>
        <div className="grid grid-cols-3 items-center">

          {/* ── Left: desktop nav links ── */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Primary">
            {LEFT_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`${underline} text-sm font-medium uppercase tracking-[0.2em] transition-colors ${textMuted} hover:${textBase}`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Mobile: hamburger */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className={`relative z-50 flex flex-col justify-center items-center w-6 h-6 gap-[5px] ${textBase}`}
            >
              <motion.span
                animate={menuOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="block w-full h-px bg-current origin-center"
              />
              <motion.span
                animate={menuOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.2 }}
                className="block w-full h-px bg-current"
              />
              <motion.span
                animate={menuOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
                className="block w-full h-px bg-current origin-center"
              />
            </button>
          </div>

          {/* ── Center: Logo ── */}
          <div className="flex justify-center">
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className={`${underline} font-serif text-3xl lowercase tracking-tighter transition-colors ${textBase}`}
            >
              unwnd
            </Link>
          </div>

          {/* ── Right: Menu + Tray ── */}
          <div className="flex items-center justify-end gap-8">
            <Link
              href="/menu"
              className={`${underline} hidden md:block text-sm font-medium uppercase tracking-[0.2em] transition-colors ${
                pathname === '/menu' ? textBase : `${textMuted} hover:${textBase}`
              }`}
            >
              Menu
            </Link>

            <button
              onClick={openTray}
              aria-label={`Open tray — ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
              className={`flex items-center gap-2 text-sm uppercase tracking-[0.2em] transition-all hover:opacity-60 ${textBase}`}
            >
              Tray
              <AnimatePresence mode="wait">
                {itemCount > 0 && (
                  <motion.span
                    key={itemCount}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.5, opacity: 0 }}
                    className={`text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-medium ${badgeBg}`}
                  >
                    {itemCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </header>

      {/* ─── Mobile full-screen overlay ─── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-overlay"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-40 bg-foreground flex flex-col justify-between px-8 pt-32 pb-12 md:hidden"
          >
            <nav aria-label="Mobile navigation">
              <ul className="space-y-2">
                {ALL_LINKS.map(({ href, label }, i) => (
                  <li key={href} className="overflow-hidden">
                    <motion.div
                      custom={i}
                      variants={linkVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <Link
                        href={href}
                        onClick={() => setMenuOpen(false)}
                        className={`font-serif lowercase tracking-tighter leading-none block transition-opacity hover:opacity-60 ${
                          pathname === href ? 'text-cream' : 'text-cream/50'
                        }`}
                        style={{ fontSize: 'clamp(3.5rem, 18vw, 6rem)' }}
                      >
                        {label}
                      </Link>
                    </motion.div>
                  </li>
                ))}
              </ul>
            </nav>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.45, duration: 0.4 } }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-between border-t border-cream/10 pt-6"
            >
              <span className="text-cream/40 text-[10px] uppercase tracking-[0.25em]">
                unwnd. café
              </span>
              <button
                onClick={() => { setMenuOpen(false); openTray() }}
                className="text-cream text-[10px] uppercase tracking-[0.25em] flex items-center gap-2"
              >
                Tray
                {itemCount > 0 && (
                  <span className="bg-cream text-foreground text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-medium">
                    {itemCount}
                  </span>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
