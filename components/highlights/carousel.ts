// The arithmetic behind the moving "life at unwnd." photos (see HighlightsCarousel.tsx).

/** How often the strip moves on by one photo: the owner asked for about every 2.5 seconds. */
export const ADVANCE_EVERY_MS = 2500

/** How long one move glides for: slow, so the photos drift rather than jump. */
export const SLIDE_MS = 1200

/** Copies of the first photos after the last one: enough to fill the widest view (three across), so
    the strip is never short of photos as it moves past the last one and loops. */
export const LOOP_COPIES = 3

/** The strip as drawn: every photo, then copies of the first LOOP_COPIES (round again if there are fewer). */
export function loopStrip<T>(items: readonly T[]): { item: T; copy: boolean }[] {
  if (items.length === 0) return []
  const copies = Array.from({ length: LOOP_COPIES }, (_, i) => ({ item: items[i % items.length], copy: true }))
  return [...items.map((item) => ({ item, copy: false })), ...copies]
}

/** A move that ended on the copies shows the same view as the real photos the same distance from
    the start, so the strip jumps back there unseen. */
export function settle(position: number, count: number): number {
  return position >= count ? position - count : position
}
