/**
 * Leaves the POS with a full page load that takes this page's place in the history: after Cancel
 * on items being added to an order, Back doesn't return to adding them.
 */
export function leaveFor(path: string): void {
  window.location.replace(path)
}
