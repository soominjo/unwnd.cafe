/** What the loyalty screen says when giving or removing a card did not go through. */
export const CARD_CHANGE_MESSAGES = {
  signedOut: 'signed out · reload the page',
  // The change may have been saved before the reply was lost; the list is read again to show it.
  noReply: 'no reply · check the list before trying again',
  // The reply was not the POS's own, such as a gateway error page.
  failed: 'the server could not be reached · try again',
} as const

export interface CardChangeResult {
  /** null when the change was saved, else what to show. */
  message: string | null
  data?: unknown
  /** No reply came, so the change may or may not have been saved. */
  unsure?: true
  /** The server has no such card: it was removed already, on another device say. */
  gone?: true
}

/**
 * Gives a card (POST, with the name) or removes one (DELETE, with no body). Neither takes a
 * PIN: the POS session is enough, and a 401 means it has ended.
 */
export async function sendCardChange(
  url: string,
  method: 'POST' | 'DELETE',
  body?: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<CardChangeResult> {
  let res: Response
  try {
    res = await fetchImpl(url, body
      ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { method })
  } catch {
    return { message: CARD_CHANGE_MESSAGES.noReply, unsure: true }
  }
  const json = (await res.json().catch(() => null)) as { success?: unknown; error?: unknown; data?: unknown } | null
  if (res.ok && json?.success === true) return { message: null, data: json.data }
  if (res.status === 401) return { message: CARD_CHANGE_MESSAGES.signedOut }
  // Anything else: the route's own reason when there is one, such as a name it refused.
  const reason = typeof json?.error === 'string' && json.error ? json.error : null
  if (res.status === 404 && reason) return { message: reason, gone: true }
  return { message: reason ?? CARD_CHANGE_MESSAGES.failed }
}
