/** The lines saved together: the first checkout (addedAt null), or one Add items save. */
export interface SaleRound<T> {
  addedAt: string | null
  items: T[]
}

/** A sale's lines by when they were ordered, in order: the first checkout, then each Add items save. */
export function saleRounds<T extends { addedAt?: string }>(items: readonly T[]): SaleRound<T>[] {
  return items.reduce<SaleRound<T>[]>((rounds, item) => {
    const addedAt = item.addedAt ?? null
    const last = rounds[rounds.length - 1]
    if (last && last.addedAt === addedAt) return [...rounds.slice(0, -1), { addedAt, items: [...last.items, item] }]
    return [...rounds, { addedAt, items: [item] }]
  }, [])
}
