/** What counts as someone still using the POS. */
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const

/**
 * Calls `onIdle` once `ms` milliseconds pass with no activity on `target` (the
 * window, in the app); every tap or key press starts the wait over. Returns the
 * function that stops watching.
 */
export function watchIdle(target: EventTarget, ms: number, onIdle: () => void): () => void {
  let timer = setTimeout(onIdle, ms)
  function restart() {
    clearTimeout(timer)
    timer = setTimeout(onIdle, ms)
  }
  for (const type of ACTIVITY_EVENTS) target.addEventListener(type, restart, { passive: true })
  return () => {
    clearTimeout(timer)
    for (const type of ACTIVITY_EVENTS) target.removeEventListener(type, restart)
  }
}
