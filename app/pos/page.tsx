import type { Metadata } from 'next'
import POSClient from './POSClient'
import { loadPosMenu } from '@/lib/posMenu'
import { loadCardHolders } from '@/lib/loyaltyStore'

export const metadata: Metadata = {
  title: 'POS — unwnd.',
  robots: { index: false, follow: false },
}

// Rendered per request with the live menu, so a reload paints the real tabs and
// items straight away instead of the built-in menu being swapped out after load.
// Loyalty card holders load alongside, so the name field can suggest them at once.
export const dynamic = 'force-dynamic'

export default async function POSPage() {
  const [menu, cardHolders] = await Promise.all([loadPosMenu(), loadCardHolders()])
  return <POSClient initialMenu={menu} initialCardHolders={cardHolders} />
}
