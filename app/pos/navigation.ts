/**
 * Leaves the POS with a full page load that takes this page's place in the history: after Cancel
 * on items being added to an order, Back doesn't return to adding them.
 */
export function leaveFor(path: string): void {
  window.location.replace(path)
}

/** What the POS asks before another page takes its place while an order it couldn't keep is on screen. */
export const LEAVE_ORDER_MESSAGE = 'Leave the POS? The order in progress will be cleared.'

/** What it asks while items are being added to a saved order: they're kept, but /pos doesn't show them. */
export const LEAVE_ADDING_MESSAGE = 'Leave the POS? The new items stay kept for this order: to finish them, open Add items on it in Sales.'

/**
 * What leaving the POS for another of its pages should ask first, or null to just go. A new order
 * kept on the tablet is back on /pos. Items being added to a saved order come back only through
 * Add items on that order, so leaving them asks and says where. An order the tablet couldn't keep
 * would be lost.
 */
export function leaveWarning({ items, kept, adding }: { items: number; kept: boolean; adding: boolean }): string | null {
  if (items === 0) return null
  if (!kept) return LEAVE_ORDER_MESSAGE
  return adding ? LEAVE_ADDING_MESSAGE : null
}

/**
 * Opens another POS page (Time clock, Manager) with a full page load, asking `warning` first when
 * there is one (see leaveWarning). Returns whether it went.
 */
export function openPosPage(
  path: string,
  warning: string | null,
  confirmLeave: (message: string) => boolean = message => window.confirm(message),
  go: (target: string) => void = target => window.location.assign(target),
): boolean {
  if (warning !== null && !confirmLeave(warning)) return false
  go(path)
  return true
}
