import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import POSClient from './POSClient'
import { MENU_EDITING_COOKIE, isUnlockCookieOn } from './manager/managerUnlock'
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
// cart's lines are saved onto it. Menu editing, once the Manager page turns it on, stays on
// through reloads until the POS Lock (see manager/managerUnlock.ts).
export const dynamic = 'force-dynamic'

export default async function POSPage({ searchParams }: { searchParams: Promise<{ edit?: string | string[] }> }) {
  const [{ edit }, jar] = await Promise.all([searchParams, cookies()])
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
      initialMenuEditing={isUnlockCookieOn(jar.get(MENU_EDITING_COOKIE)?.value)}
    />
  )
}
