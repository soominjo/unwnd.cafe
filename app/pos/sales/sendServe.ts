/** What a tap on Sales asks the server to do with an order's lines (see PATCH /api/sales/[id]). */
export type ServeRequest =
  /** These top-level lines went out to the customer. */
  | { kind: 'serve'; lineIds: readonly string[] }
  /** These lines are still to serve after all (a tick undone). */
  | { kind: 'unserve'; lineIds: readonly string[] }
  /** Complete: every line still to serve went out. */
  | { kind: 'complete' }

export interface ServeResult {
  /** null once the server has it, else why not. */
  error: string | null
  /** The order is gone: it was deleted on another device. */
  gone?: true
}

const GONE = 'That order was deleted on another device.'

/**
 * How long a change waits for the server. One that hangs (the wifi dropped mid-request) would
 * otherwise hold up the order's next taps and the list's reloads until the browser gives up.
 */
export const SERVE_TIMEOUT_MS = 15_000

function body(request: ServeRequest): Record<string, unknown> {
  if (request.kind === 'complete') return { markCompleted: true }
  return request.kind === 'serve' ? { serveLineIds: request.lineIds } : { unserveLineIds: request.lineIds }
}

/** What the banner says when the change didn't reach the server: `failed`, or `offline` with no reply. */
function messages(request: ServeRequest): { failed: string; offline: string } {
  if (request.kind === 'complete') return { failed: 'Failed to complete order.', offline: 'Network error. Could not complete order.' }
  const items = request.lineIds.length === 1 ? 'the item' : 'the items'
  const failed = request.kind === 'serve' ? `Could not mark ${items} served.` : `Could not move ${items} back to Recent.`
  return { failed, offline: `Network error. ${failed}` }
}

/**
 * Ticks an order's lines as served, unticks them, or completes the order. Never throws. With no
 * reply within `timeoutMs` it gives up as if offline; the quiet reload after it shows what the
 * server really has.
 */
export async function sendServe(
  id: string,
  request: ServeRequest,
  fetchImpl: typeof fetch = fetch,
  timeoutMs: number = SERVE_TIMEOUT_MS,
): Promise<ServeResult> {
  const { failed, offline } = messages(request)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let res: Response
    try {
      res = await fetchImpl(`/api/sales/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body(request)),
        signal: controller.signal,
      })
    } catch {
      return { error: offline }
    }
    if (res.status === 404) return { error: GONE, gone: true }
    const json = (await res.json().catch(() => null)) as { success?: unknown; error?: unknown } | null
    if (res.ok && json?.success === true) return { error: null }
    // The route's own reason when there is one, such as a change made on another device.
    return { error: typeof json?.error === 'string' && json.error ? json.error : failed }
  } finally {
    clearTimeout(timer)
  }
}
