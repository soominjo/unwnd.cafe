import type { Metadata } from 'next'
import TimeClockClient from './TimeClockClient'

export const metadata: Metadata = {
  title: 'Time clock — unwnd.',
  robots: { index: false, follow: false },
}

// Rendered per request, not at build time: the header shows today's date.
export const dynamic = 'force-dynamic'

export default function TimeClockPage() {
  return <TimeClockClient />
}
