import { Suspense } from 'react'
import SalesClient from './SalesClient'

export const metadata = { robots: 'noindex' }

export default function SalesPage() {
  return (
    <Suspense>
      <SalesClient />
    </Suspense>
  )
}
