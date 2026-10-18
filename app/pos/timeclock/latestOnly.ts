export type LatestAnswer<T> = { latest: true; value: T } | { latest: false }

/**
 * Wraps a read so that only the latest call's answer is used. Two people clocking in a second
 * apart each make the panel read the time clock again; if the first read answered last, it
 * would show the second person off the clock again.
 */
export function latestOnly<Args extends unknown[], T>(read: (...args: Args) => Promise<T>): (...args: Args) => Promise<LatestAnswer<T>> {
  let calls = 0
  return async (...args: Args) => {
    const call = ++calls
    const value = await read(...args)
    return call === calls ? { latest: true, value } : { latest: false }
  }
}
