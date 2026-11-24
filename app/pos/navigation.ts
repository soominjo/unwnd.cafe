/**
 * Leaves the POS with a full page load that takes this page's place in the history: after Cancel
 * on items being added to an order, Back doesn't return to adding them.
 */
export function leaveFor(path: string): void {
  window.location.replace(path)
}

/** What the POS asks before another page takes its place while an order it couldn't keep is on screen. */
export const LEAVE_ORDER_MESSAGE = 'Leave the POS? The order in progress will be cleared.'

/**
 * Opens another POS page (Time clock, Manager) with a full page load. `itemsAtRisk` is how many
 * items that load would lose: 0 when the order on screen is kept on the tablet (it comes back),
 * else its item count, and then it asks first, the same way Reload does. Returns whether it went.
 */
export function openPosPage(
  path: string,
  itemsAtRisk: number,
  confirmLeave: (message: string) => boolean = message => window.confirm(message),
  go: (target: string) => void = target => window.location.assign(target),
): boolean {
  if (itemsAtRisk > 0 && !confirmLeave(LEAVE_ORDER_MESSAGE)) return false
  go(path)
  return true
}
