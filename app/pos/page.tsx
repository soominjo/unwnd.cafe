import type { Metadata } from 'next'
import POSClient from './POSClient'
import { loadPosMenu } from '@/lib/posMenu'
import { loadCardHolders } from '@/lib/loyaltyStore'
import { loadOpenSale } from '@/lib/sales/loadOpenSale'

export const metadata: Metadata = {
  title: 'POS — unwnd.',
  robots: { index: false, follow: false },
}

// Rendered per request with the live menu, so a reload paints the real tabs and
// items straight away instead of the built-in menu being swapped out after load.
// Loyalty card holders load alongside, so the name field can suggest them at once.
// "Add items" on Sales opens /pos?edit=<order>: that pending order loads too, and the
// cart's lines are saved onto it.
export const dynamic = 'force-dynamic'

export default async function POSPage({ searchParams }: { searchParams: Promise<{ edit?: string | string[] }> }) {
  const { edit } = await searchParams
  const [menu, cardHolders, open] = await Promise.all([
    loadPosMenu(),
    loadCardHolders(),
    typeof edit === 'string' ? loadOpenSale(edit) : Promise.resolve(null),
  ])
  return (
    <POSClient
      initialMenu={menu}
      initialCardHolders={cardHolders}
      initialOpenOrder={open && 'order' in open ? open.order : null}
      openOrderProblem={open && 'problem' in open ? open.problem : null}
    />
  )
}
