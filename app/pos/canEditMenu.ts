import type { PosMenu } from '@/lib/posMenu'

/**
 * Whether the POS offers menu edits (adding, editing and deleting items, the
 * category manager, reordering tabs): only in manager mode, and only on the
 * live menu. The built-in fallback has no saved items to change, and a tab
 * added to it would replace all the built-in ones.
 */
export function canEditMenu(managerUnlocked: boolean, liveMenu: PosMenu | null): boolean {
  return managerUnlocked && liveMenu !== null
}
