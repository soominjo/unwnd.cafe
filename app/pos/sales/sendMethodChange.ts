import type { PaymentMethod } from '@/lib/sales/payments'

/** What Sales says when a payment's method was not changed. */
export const METHOD_CHANGE_MESSAGES = {
  gone: 'That order was deleted on another device.',
  // The reply was not the POS's own, such as a gateway error page.
  failed: 'Could not change the payment.',
  offline: 'Network error. Could not change the payment.',
} as const

export interface MethodChangeResult {
  /** null once the payment is moved, else why not. */
  error: string | null
  /** The order is gone: it was deleted on another device. */
  gone?: true
}

/** Moves one payment to the method it was really taken by. Never throws. */
export async function sendMethodChange(id: string, paymentKey: string, method: PaymentMethod, fetchImpl: typeof fetch = fetch): Promise<MethodChangeResult> {
  let res: Response
  try {
    res = await fetchImpl(`/api/sales/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey, method }),
    })
  } catch {
    return { error: METHOD_CHANGE_MESSAGES.offline }
  }
  if (res.status === 404) return { error: METHOD_CHANGE_MESSAGES.gone, gone: true }
  const json = (await res.json().catch(() => null)) as { success?: unknown; error?: unknown } | null
  if (res.ok && json?.success === true) return { error: null }
  // The route's own reason when there is one, such as a payment changed on another device.
  return { error: typeof json?.error === 'string' && json.error ? json.error : METHOD_CHANGE_MESSAGES.failed }
}
