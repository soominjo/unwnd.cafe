'use client'

import { usePathname } from 'next/navigation'
import Nav from './Nav'
import Footer from './Footer'
import Tray from './Tray'

export default function ChromeWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPos = pathname.startsWith('/pos')

  return (
    <>
      {!isPos && <Nav />}
      {children}
      {!isPos && <Footer />}
      {!isPos && <Tray />}
    </>
  )
}
