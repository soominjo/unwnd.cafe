import type { PaymentMethod } from '@/lib/sales/payments'
import type { SalesSummary } from '../types'
import OrderTypeCard from './OrderTypeCard'
import PaymentTallyCard from './PaymentTallyCard'
import { EmptyState, Skeleton } from './ui'

interface TallyViewProps {
  summary: SalesSummary | null
  loading: boolean
  /** A day or a short range: each payment is listed under its method. */
  detailed: boolean
  onChangeMethod: (saleId: string, paymentKey: string, method: PaymentMethod) => Promise<string | null>
}

/**
 * The Tally tab: how the period was paid and where it was eaten. A refresh keeps the cards on
 * screen, dimmed, so an open method's list stays open while a fixed payment reloads.
 */
export default function TallyView({ summary, loading, detailed, onChangeMethod }: TallyViewProps) {
  if (!summary || !summary.paymentTally) return loading ? <Skeleton rows={2} height="h-40" /> : null
  if (summary.orderCount === 0) {
    return <EmptyState title="No sales in this period." hint="Payments from the POS add up here as they come in." />
  }
  return (
    <div aria-busy={loading || undefined} className={`grid items-start gap-3 transition-opacity lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] ${loading ? 'opacity-60' : ''}`}>
      <PaymentTallyCard
        tally={summary.paymentTally}
        revenue={summary.totalRevenue}
        lines={detailed ? summary.paymentLines ?? [] : null}
        onChangeMethod={onChangeMethod}
      />
      <OrderTypeCard counts={summary.orderTypes} />
    </div>
  )
}
