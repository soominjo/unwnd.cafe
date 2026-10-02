import type { SalePayload } from './salePayload'

/** A refused sale's `code` says why when the POS can act on it (see LOYALTY_CARD_CHANGED). */
export type PostSaleResult = { ok: true } | { ok: false; error: string; code?: string }

/**
 * Saves the sale with POST /api/sales. Never throws: a failed save comes back as
 * the message to show the cashier, so nothing checkout does after a successful
 * save can be mistaken for a failed one.
 */
export async function postSale(payload: SalePayload, fetchImpl: typeof fetch = fetch): Promise<PostSaleResult> {
  try {
    const res = await fetchImpl('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = ((await res.json()) ?? {}) as { success?: unknown; error?: unknown; code?: unknown }
    if (res.ok && data.success === true) return { ok: true }
    return {
      ok: false,
      error: typeof data.error === 'string' ? data.error : 'Failed to save sale. Try again.',
      ...(typeof data.code === 'string' ? { code: data.code } : {}),
    }
  } catch {
    // fetch rejects when the request never completes; res.json() when the reply is not JSON (e.g. a gateway page).
    return { ok: false, error: 'Network error. Check connection and try again.' }
  }
}
