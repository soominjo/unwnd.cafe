// The arithmetic behind the moving "kind words." rows (see ReviewsMarquee.tsx).

/** From this many reviews the marquee runs two rows, in opposite directions. */
export const TWO_ROWS_FROM = 8

/** The fewest cards in one loop of a row: on wide screens a card and its spacing take 380 px, so 8 span 3,040 px, wider than a wide screen, and the loop's seam never shows. */
export const MIN_CARDS_PER_LOOP = 8

/** How long each card takes to slide by: about 50 px a second, slow enough to read a short review. */
export const SECONDS_PER_CARD = 7

/** One row for a few reviews; from TWO_ROWS_FROM, two rows dealt alternately (1st, 3rd, 5th… and 2nd, 4th, 6th…). */
export function splitIntoRows<T>(items: readonly T[]): T[][] {
  if (items.length === 0) return []
  if (items.length < TWO_ROWS_FROM) return [[...items]]
  return [items.filter((_, i) => i % 2 === 0), items.filter((_, i) => i % 2 === 1)]
}

/** One loop of a row: the row repeated (copy 0, 1, 2…) until it holds at least MIN_CARDS_PER_LOOP cards. */
export function fillLoop<T>(row: readonly T[]): { item: T; copy: number }[] {
  if (row.length === 0) return []
  const copies = Math.ceil(MIN_CARDS_PER_LOOP / row.length)
  return Array.from({ length: copies }, (_, copy) => row.map((item) => ({ item, copy }))).flat()
}
