import type { Metadata } from 'next'
import POSClient from './POSClient'
import { loadPosMenu } from '@/lib/posMenu'

export const metadata: Metadata = {
  title: 'POS — unwnd.',
  robots: { index: false, follow: false },
}

// Rendered per request with the live menu, so a reload paints the real tabs and
// items straight away instead of the built-in menu being swapped out after load.
export const dynamic = 'force-dynamic'

export default async function POSPage() {
  return <POSClient initialMenu={await loadPosMenu()} />
}
