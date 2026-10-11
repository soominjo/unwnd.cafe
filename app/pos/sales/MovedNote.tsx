import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '@/lib/sales/payments'
import { formatPHWhen } from './dateRange'

interface MovedNoteProps {
  payment: { movedFrom?: PaymentMethod; movedAt?: string }
  /** When the payment was taken: the move shows its date only when it came on a later day. */
  paidAt: string
  className: string
}

/**
 * What Sales says beside a payment moved to another method, e.g. "moved from Cash · 2:02 PM", the
 * time kept on one line. Nothing for a payment never moved.
 */
export default function MovedNote({ payment, paidAt, className }: MovedNoteProps) {
  if (!payment.movedFrom) return null
  return (
    <span className={className}>
      moved from {PAYMENT_METHOD_LABELS[payment.movedFrom]}
      {payment.movedAt && (
        <>
          {' · '}
          <span className="whitespace-nowrap">{formatPHWhen(payment.movedAt, paidAt)}</span>
        </>
      )}
    </span>
  )
}
