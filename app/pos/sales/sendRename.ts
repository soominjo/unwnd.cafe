/** What the Sales card says when an order's name was not saved. */
export const RENAME_MESSAGES = {
  gone: 'That order was deleted on another device.',
  // The reply was not the POS's own, such as a gateway error page.
  failed: 'Could not save the name.',
  offline: 'Network error. Could not save the name.',
} as const

export interface RenameResult {
  /** null once the name is saved, else why not. */
  error: string | null
  /** The order is gone: it was deleted on another device. */
  gone?: true
}

/** Saves an order's name (empty clears it) as its notes. Never throws. */
export async function sendRename(id: string, name: string, fetchImpl: typeof fetch = fetch): Promise<RenameResult> {
  let res: Response
  try {
    res = await fetchImpl(`/api/sales/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: name }),
    })
  } catch {
    return { error: RENAME_MESSAGES.offline }
  }
  if (res.status === 404) return { error: RENAME_MESSAGES.gone, gone: true }
  const json = (await res.json().catch(() => null)) as { success?: unknown; error?: unknown } | null
  if (res.ok && json?.success === true) return { error: null }
  // The route's own reason when there is one, such as a name it refused.
  return { error: typeof json?.error === 'string' && json.error ? json.error : RENAME_MESSAGES.failed }
}
