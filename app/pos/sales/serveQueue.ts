/** A change to send: resolves true when it went through. */
export type ServeJob = () => Promise<boolean>

export interface ServeQueue {
  /** Sends the change once the order's earlier changes are done. */
  push(orderId: string, job: ServeJob): void
  /** True while any change is on its way or waiting. A list fetched meanwhile may not have it yet. */
  busy(): boolean
}

/**
 * Sends each order's changes one at a time, in the order they were made, so fast taps never race on
 * the server. Different orders go side by side. When a change fails, that order's waiting changes are
 * dropped: they were made on top of it. `onIdle` runs each time the last change of all is done.
 */
export function createServeQueue(onIdle: () => void): ServeQueue {
  const waiting = new Map<string, readonly ServeJob[]>()
  const sending = new Set<string>()

  function next(orderId: string): ServeJob | undefined {
    const [job, ...rest] = waiting.get(orderId) ?? []
    if (rest.length > 0) waiting.set(orderId, rest)
    else waiting.delete(orderId)
    return job
  }

  async function send(orderId: string): Promise<void> {
    sending.add(orderId)
    for (let job = next(orderId); job; job = next(orderId)) {
      const ok = await Promise.resolve().then(job).catch(() => false)
      if (!ok) waiting.delete(orderId)
    }
    sending.delete(orderId)
    if (sending.size === 0) onIdle()
  }

  return {
    push(orderId, job) {
      waiting.set(orderId, [...(waiting.get(orderId) ?? []), job])
      if (!sending.has(orderId)) void send(orderId)
    },
    busy: () => sending.size > 0,
  }
}
