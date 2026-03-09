'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { useCartStore } from '@/store/useCartStore'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/menu', label: 'Menu' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
]

const EASE: [number, number, number, number] = [0.76, 0, 0.24, 1]

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.4, ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.3, ease: EASE } },
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
  const pathname = usePathname()
  const itemCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0))
  const openTray = useCartStore((s) => s.openTray)

  // Hide inside Sanity Studio
  if (pathname.startsWith('/studio')) return null

  return (
    <>
      {/* ─── Sticky Header ─── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6 bg-white/90 backdrop-blur-sm border-b border-black/5">
        {/* Logo */}
        <Link
          href="/"
          onClick={() => setMenuOpen(false)}
          className="font-serif text-xl lowercase tracking-tighter z-50 relative"
        >
          unwnd.
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8" aria-label="Primary">
          {NAV_LINKS.slice(1).map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`text-[11px] uppercase tracking-[0.2em] transition-colors ${
                pathname === href ? 'text-foreground' : 'text-muted hover:text-foreground'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-6">
          {/* Tray */}
          <button
            onClick={openTray}
            aria-label={`Open tray — ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
            className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] hover:opacity-60 transition-opacity"
          >
            Tray
            <AnimatePresence mode="wait">
              {itemCount > 0 && (
                <motion.span
                  key={itemCount}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  className="bg-black text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-medium"
                >
                  {itemCount}
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            className="md:hidden relative z-50 flex flex-col justify-center items-center w-6 h-6 gap-[5px]"
          >
            <motion.span
              animate={menuOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.3, ease: [0.76, 0, 0.24, 1] }}
              className="block w-full h-px bg-current origin-center"
            />
            <motion.span
              animate={menuOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.2 }}
              className="block w-full h-px bg-current"
            />
            <motion.span
              animate={menuOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
              transition={{ duration: 0.3, ease: [0.76, 0, 0.24, 1] }}
              className="block w-full h-px bg-current origin-center"
            />
          </button>
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
            className="fixed inset-0 z-40 bg-black flex flex-col justify-between px-8 pt-28 pb-12 md:hidden"
          >
            {/* Large editorial nav links */}
            <nav aria-label="Mobile navigation">
              <ul className="space-y-2">
                {NAV_LINKS.map(({ href, label }, i) => (
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
                          pathname === href ? 'text-white' : 'text-white/60'
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

            {/* Bottom strip */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.45, duration: 0.4 } }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-between border-t border-white/10 pt-6"
            >
              <span className="text-white/40 text-[10px] uppercase tracking-[0.25em]">
                unwnd. café
              </span>
              <button
                onClick={() => {
                  setMenuOpen(false)
                  openTray()
                }}
                className="text-white text-[10px] uppercase tracking-[0.25em] flex items-center gap-2"
              >
                Tray
                {itemCount > 0 && (
                  <span className="bg-white text-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-medium">
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
