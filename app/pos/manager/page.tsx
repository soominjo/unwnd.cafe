import type { Metadata } from 'next'
import ManagerClient from './ManagerClient'

export const metadata: Metadata = {
  title: 'Manager — unwnd.',
  robots: { index: false, follow: false },
}

export default function ManagerPage() {
  return <ManagerClient />
}
