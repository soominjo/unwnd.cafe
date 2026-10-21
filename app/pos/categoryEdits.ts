import { loyaltyPerksOf } from '@/lib/loyalty'
import { categoryIdFromLabel } from '@/lib/menuCategoryLabel'
import type { PosMenuItem } from '@/lib/posMenu'
import type { DynamicCategory } from './ManageMenuModal'

/** The menu as the POS holds it while editing: tabs, items, the dragged tab order and the open tab. */
export interface MenuState {
  categories: DynamicCategory[]
  items: PosMenuItem[]
  categoryOrder: string[]
  activeCategoryId: string | null
}

function joinAnd(parts: readonly string[]): string {
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/**
 * What the category manager asks before deleting a tab: the tab and how many items go with it,
 * and, when the tab carries a loyalty rule, that a tab added later won't have it (loyalty rules
 * follow the tab's id, and a new tab gets a new id from its name).
 */
export function deletePrompt(tab: { id: string; label: string }, itemCount: number): { question: string; loyaltyLine: string | null } {
  const question = itemCount > 0
    ? `Delete ${tab.label} and its ${itemCount} item${itemCount === 1 ? '' : 's'}? This can’t be undone.`
    : `Delete ${tab.label}?`
  const perks = loyaltyPerksOf(tab.id)
  const gives = [perks.stamps && 'loyalty stamps', perks.freeDrink && 'the free drink', perks.tenOff && '10% off']
    .filter((part): part is string => Boolean(part))
  // A tab added under this name gets this tab's id back, and its rules, unless the tab was renamed.
  const sameNameBringsThemBack = categoryIdFromLabel(tab.label) === tab.id
  const loyaltyLine = gives.length === 0
    ? null
    : sameNameBringsThemBack
      ? `${tab.label} gives ${joinAnd(gives)}. Adding a tab named ${tab.label} again brings them back; a tab under any other name won’t have them.`
      : `${tab.label} gives ${joinAnd(gives)}. A tab you add later won’t, even with the same name.`
  return { question, loyaltyLine }
}

/**
 * The delete request for a tab, saying how many items the screen showed: the server refuses
 * when the tab now holds more, so nothing goes that the manager wasn't told about.
 */
export function deleteTabUrl(tab: { _sanityId: string }, itemCount: number): string {
  return `/api/menu/categories/${encodeURIComponent(tab._sanityId)}?items=${itemCount}`
}

/** The POS after a tab is deleted: the tab, its items and its place in the order are gone; an open tab moves to the first. */
export function withoutTab(state: MenuState, tabId: string): MenuState {
  return {
    categories: state.categories.filter((c) => c.id !== tabId),
    items: state.items.filter((i) => i.category !== tabId),
    categoryOrder: state.categoryOrder.filter((id) => id !== tabId),
    activeCategoryId: state.activeCategoryId === tabId ? null : state.activeCategoryId,
  }
}
