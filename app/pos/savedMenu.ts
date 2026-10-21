import type { PosMenu } from '@/lib/posMenu'

// The last menu this tablet loaded, kept in localStorage. When the live menu can't be read, the
// POS shows it instead (with a warning), so a deleted item never comes back from a menu in code.
// Storage that is refused (a private window, blocked site data) or missing (the server render)
// never breaks the POS: saving does nothing and reading finds nothing.

export const SAVED_MENU_KEY = 'unwnd.pos.lastMenu'

export function saveMenu(menu: PosMenu, storage?: Pick<Storage, 'setItem'>): void {
  try {
    ;(storage ?? globalThis.localStorage).setItem(SAVED_MENU_KEY, JSON.stringify(menu))
  } catch {
    // Not saved: the next failed load shows no menu, as it would on a new tablet.
  }
}

export function readSavedMenu(storage?: Pick<Storage, 'getItem'>): PosMenu | null {
  try {
    const text = (storage ?? globalThis.localStorage).getItem(SAVED_MENU_KEY)
    if (!text) return null
    const menu: unknown = JSON.parse(text)
    if (!menu || typeof menu !== 'object') return null
    const { categories, items, categoryOrder } = menu as Record<string, unknown>
    return Array.isArray(categories) && Array.isArray(items) && Array.isArray(categoryOrder)
      ? (menu as PosMenu)
      : null
  } catch {
    return null
  }
}
