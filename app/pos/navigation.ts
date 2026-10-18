/**
 * Leaves the POS with a full page load that takes this page's place in the history: after Cancel
 * on items being added to an order, Back doesn't return to adding them.
 */
export function leaveFor(path: string): void {
  window.location.replace(path)
}

/** What the POS asks before another page takes its place while an order is on screen. */
export const LEAVE_ORDER_MESSAGE = 'Leave the POS? The order in progress will be cleared.'

/**
 * Opens another POS page (Time clock, Manager) with a full page load, which clears the order on
 * screen: with items in it, it asks first, the same way Reload does. Returns whether it went.
 */
export function openPosPage(
  path: string,
  itemCount: number,
  confirmLeave: (message: string) => boolean = message => window.confirm(message),
  go: (target: string) => void = target => window.location.assign(target),
): boolean {
  if (itemCount > 0 && !confirmLeave(LEAVE_ORDER_MESSAGE)) return false
  go(path)
  return true
}
