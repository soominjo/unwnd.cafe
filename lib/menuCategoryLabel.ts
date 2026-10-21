/** The longest a tab's name can be, when adding a tab or renaming one. */
export const MAX_CATEGORY_LABEL = 40

/** The id a new tab gets from its name ("Matcha Series" → matcha-series). Ids never change after. */
export function categoryIdFromLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

/** A tab's name as it is saved: trimmed, 1–40 characters. Null for anything else. */
export function cleanCategoryLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const label = value.trim()
  return label.length > 0 && label.length <= MAX_CATEGORY_LABEL ? label : null
}
