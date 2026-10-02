import { PIN_CHECK_MESSAGES } from '../verifyPosPin'

/** What the loyalty screen says when giving or removing a card did not go through. */
export const CARD_CHANGE_MESSAGES = {
  wrong: PIN_CHECK_MESSAGES.wrong,
  signedOut: 'signed out · reload the page',
  // The change may have been saved before the reply was lost; the list is read again to show it.
  noReply: 'no reply · check the list before trying again',
  failed: PIN_CHECK_MESSAGES.unreachable,
} as const

export interface CardChangeResult {
  /** null when the change was saved, else what to show. */
  message: string | null
  data?: unknown
  /** No reply came, so the change may or may not have been saved. */
  unsure?: true
}

/**
 * Gives a card (POST) or removes one (DELETE, with the manager PIN). The routes answer a
 * wrong PIN with 403; a 401 means the POS session itself has ended.
 */
export async function sendCardChange(
  url: string,
  method: 'POST' | 'DELETE',
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<CardChangeResult> {
  let res: Response
  try {
    res = await fetchImpl(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    return { message: CARD_CHANGE_MESSAGES.noReply, unsure: true }
  }
  const json = (await res.json().catch(() => null)) as { success?: unknown; error?: unknown; data?: unknown } | null
  if (res.ok && json?.success === true) return { message: null, data: json.data }
  if (res.status === 403) return { message: CARD_CHANGE_MESSAGES.wrong }
  if (res.status === 401) return { message: CARD_CHANGE_MESSAGES.signedOut }
  // Anything else: the route's own reason when there is one, such as a name it refused.
  return { message: typeof json?.error === 'string' && json.error ? json.error : CARD_CHANGE_MESSAGES.failed }
}
