import type { CardHolderWithCard } from '@/lib/loyalty'

/** How long the POS waits for the cards. A checkout can be waiting on them, so it must never hang. */
export const REFETCH_TIMEOUT_MS = 6000

/**
 * The loyalty card holders as the server has them now, for the POS to catch up with cards
 * given or used on another device. Never throws: null when they could not be read in time.
 */
export async function refetchCardHolders(fetchImpl: typeof fetch = fetch): Promise<CardHolderWithCard[] | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REFETCH_TIMEOUT_MS)
  try {
    const res = await fetchImpl('/api/loyalty/members', { cache: 'no-store', signal: controller.signal })
    const json = (await res.json()) as { success?: unknown; data?: unknown } | null
    return res.ok && json?.success === true && Array.isArray(json.data) ? (json.data as CardHolderWithCard[]) : null
  } catch {
    // The request failed or timed out (the abort also ends a body still arriving), or the reply was not JSON.
    return null
  } finally {
    clearTimeout(timer)
  }
}
