import type { AddItemsBody } from '@/lib/sales/addItems'
import type { Sale } from './types'

/**
 * A refusal's `code` says why when the POS can act on it (ORDER_CHANGED, ORDER_COMPLETED,
 * LOYALTY_CARD_CHANGED); with ORDER_CHANGED the order comes back as it now is. `unsure` means
 * no reply came, so the items may have been saved.
 */
export type AddItemsResult =
  | { ok: true; sale: Sale }
  | { ok: false; error: string; code?: string; sale?: Sale; unsure?: true }

const NO_REPLY = 'No reply. Check the order on Sales before trying again.'

function isSale(value: unknown): value is Sale {
  const v = value as Partial<Sale> | null
  return typeof v === 'object' && v !== null && typeof v._id === 'string' && Array.isArray(v.items)
}

/** Saves new lines onto a pending order with POST /api/sales/[id]/items. Never throws. */
export async function postAddItems(orderId: string, body: AddItemsBody, fetchImpl: typeof fetch = fetch): Promise<AddItemsResult> {
  let res: Response
  try {
    res = await fetchImpl(`/api/sales/${encodeURIComponent(orderId)}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, error: NO_REPLY, unsure: true }
  }
  // A reply that is not the API's own (a gateway page) says nothing about whether it saved.
  const data = (await res.json().catch(() => null)) as { success?: unknown; error?: unknown; code?: unknown; data?: unknown } | null
  if (!data) return { ok: false, error: NO_REPLY, unsure: true }
  if (res.ok && data.success === true) return isSale(data.data) ? { ok: true, sale: data.data } : { ok: false, error: NO_REPLY, unsure: true }
  return {
    ok: false,
    error: typeof data.error === 'string' ? data.error : 'Could not add the items. Try again.',
    ...(typeof data.code === 'string' ? { code: data.code } : {}),
    ...(isSale(data.data) ? { sale: data.data } : {}),
  }
}
