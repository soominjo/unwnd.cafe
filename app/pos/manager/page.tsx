import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import ManagerClient from './ManagerClient'
import { MANAGER_UNLOCK_COOKIE, isUnlockCookieOn } from './managerUnlock'

export const metadata: Metadata = {
  title: 'Manager — unwnd.',
  robots: { index: false, follow: false },
}

// Read per request: it opens unlocked when the manager left it that way, so a reload or Back
// shows no PIN pad first.
export default async function ManagerPage() {
  const jar = await cookies()
  return <ManagerClient initiallyUnlocked={isUnlockCookieOn(jar.get(MANAGER_UNLOCK_COOKIE)?.value)} />
}
