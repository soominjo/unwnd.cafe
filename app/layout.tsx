import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Cormorant_Garamond } from 'next/font/google'
import { Poppins } from 'next/font/google'
import './globals.css'
import ChromeWrapper from '@/components/ChromeWrapper'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  variable: '--font-cormorant',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
})

// Used for large numeric readouts (order totals, change) where Cormorant's
// serif display face is less legible at a glance than a geometric sans.
const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'unwnd', 
  description: 'A specialty café crafted for the aesthetic soul.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${cormorant.variable} ${poppins.variable} antialiased`}>
        <ChromeWrapper>{children}</ChromeWrapper>
      </body>
    </html>
  )
}
