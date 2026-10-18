// "Edit the menu" on the Manager page hands menu editing over to the POS for the next page load
// in this tab, so the manager doesn't type the PIN twice. Like manager mode itself, this is a
// screen-side gate: the menu routes take any signed-in POS.

const KEY = 'unwnd.pos.editMenu'
/** The hand-over is good for this long: the /pos page load follows straight away. */
export const HANDOFF_MS = 30 * 1000

/** Marks this tab's next /pos load to start with menu editing on. */
export function handOffMenuEditing(storage: Pick<Storage, 'setItem'> = sessionStorage, now: number = Date.now()): void {
  try {
    storage.setItem(KEY, String(now))
  } catch {
    // Storage refused (a private window): the POS then starts locked, as it always did.
  }
}

/** Read once by the POS on load: whether menu editing was just handed over. The mark is used up either way. */
export function takeMenuEditing(storage: Pick<Storage, 'getItem' | 'removeItem'> = sessionStorage, now: number = Date.now()): boolean {
  try {
    const at = Number(storage.getItem(KEY))
    storage.removeItem(KEY)
    return at > 0 && now >= at && now - at < HANDOFF_MS
  } catch {
    return false
  }
}
