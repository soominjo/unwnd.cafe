import type { PaymentMethod } from '@/lib/sales/payments'

/**
 * Each method's colour in the Tally bar and on the order cards' payment marks: a set checked for
 * colour-blind separation (adjacent ΔE ≥ 24) and ≥ 3:1 on white. Text never takes these colours;
 * a mark beside it does. Not recorded is a neutral grey, not a series.
 */
export const METHOD_COLORS: Record<PaymentMethod | 'notRecorded', string> = {
  cash: '#008300',
  ewallet: '#2a78d6',
  card: '#eb6834',
  notRecorded: '#b9beb3',
}
