import { isAddonLine } from '@/app/pos/utils'

// Serving an order one item at a time (Sales › Recent orders). A line that went out to the customer
// carries `servedAt`. Only top-level lines carry it: an add-on goes out with the item it hangs off.
// An order is completed (`isCompleted`) once every top-level line has gone out. Orders completed
// before items were ticked one by one carry no times at all, so a completed order counts every line
// as served. The API routes and the Sales screen share these rules, so the two never disagree.

/** The part of a sale line that serving reads and writes. Stored lines also carry `_key === lineId`. */
export interface ServableLine {
  lineId: string
  parentLineId?: string
  servedAt?: string
}

export interface ServableOrder<T extends ServableLine> {
  isCompleted?: boolean
  items: readonly T[]
}

/** An order's lines split by whether they went out, each list in the order's own line order. */
export interface ServeSplit<T> {
  /** Top-level lines that went out. */
  served: T[]
  /** Top-level lines still to serve. */
  toServe: T[]
  /** The served lines with their add-ons: what the order shows under Completed. */
  servedLines: T[]
  /** The lines still to serve with their add-ons: what the order shows under Recent orders. */
  toServeLines: T[]
}

/** The order after a change: its lines, and whether it is now completed. */
export interface ServeChange<T> {
  items: T[]
  isCompleted: boolean
}

/** The lines a tick is for: every line that is not an add-on. */
export function topLevelLines<T extends ServableLine>(items: readonly T[]): T[] {
  return items.filter(item => !isAddonLine(item))
}

/**
 * Each line's item: itself for a top-level line; for an add-on, its parentLineId when that line is
 * on the order, else the top-level line before it (older sales), else null. As groupSaleItems does.
 */
function owners(items: readonly ServableLine[]): Array<string | null> {
  const lineIds = new Set(items.map(item => item.lineId))
  return items.reduce<{ owners: Array<string | null>; last: string | null }>(
    (acc, item) => {
      if (!isAddonLine(item)) return { owners: [...acc.owners, item.lineId], last: item.lineId }
      const parent = item.parentLineId && lineIds.has(item.parentLineId) ? item.parentLineId : acc.last
      return { owners: [...acc.owners, parent], last: acc.last }
    },
    { owners: [], last: null },
  ).owners
}

/** An order's lines split into those that went out and those still to serve (see ServeSplit). */
export function splitServed<T extends ServableLine>(order: ServableOrder<T>): ServeSplit<T> {
  const completed = order.isCompleted === true
  const servedIds = new Set(topLevelLines(order.items).filter(line => completed || Boolean(line.servedAt)).map(line => line.lineId))
  const lineOwners = owners(order.items)
  // An add-on with no item to follow goes with the order: served once it is completed.
  const onServedSide = order.items.map((_, index) => {
    const owner = lineOwners[index]
    return owner === null ? completed : servedIds.has(owner)
  })
  const servedLines = order.items.filter((_, index) => onServedSide[index])
  const toServeLines = order.items.filter((_, index) => !onServedSide[index])
  return {
    served: topLevelLines(servedLines),
    toServe: topLevelLines(toServeLines),
    servedLines,
    toServeLines,
  }
}

/** True once every top-level line has a servedAt. An order with no lines is not served. */
export function allLinesServed(items: readonly ServableLine[]): boolean {
  const lines = topLevelLines(items)
  return lines.length > 0 && lines.every(line => Boolean(line.servedAt))
}

/** The ids asked for that are not top-level lines of the order: add-ons, or lines no longer on it. */
export function missingLineIds(items: readonly ServableLine[], lineIds: readonly string[]): string[] {
  const onOrder = new Set(topLevelLines(items).map(line => line.lineId))
  return lineIds.filter(id => !onOrder.has(id))
}

/** The items with these top-level lines served at `at`. A line already served keeps its time. */
export function serveLines<T extends ServableLine>(items: readonly T[], lineIds: readonly string[], at: string): T[] {
  const wanted = new Set(lineIds)
  return items.map(item => (!isAddonLine(item) && wanted.has(item.lineId) && !item.servedAt ? { ...item, servedAt: at } : item))
}

/** The items with these top-level lines no longer served. */
export function unserveLines<T extends ServableLine>(items: readonly T[], lineIds: readonly string[]): T[] {
  const wanted = new Set(lineIds)
  return items.map(item => {
    if (isAddonLine(item) || !wanted.has(item.lineId) || item.servedAt === undefined) return item
    const copy = { ...item }
    delete copy.servedAt
    return copy
  })
}

/** The order after these lines went out at `at`: completed once every top-level line has. */
export function afterServing<T extends ServableLine>(order: ServableOrder<T>, lineIds: readonly string[], at: string): ServeChange<T> {
  const items = serveLines(order.items, lineIds, at)
  return { items, isCompleted: order.isCompleted === true || allLinesServed(items) }
}

/**
 * The order after these lines were marked not served. On a completed order every other top-level
 * line first gets a time (`at` where it has none, i.e. orders completed before ticking), so only the
 * lines asked for go back to be served.
 */
export function afterUnserving<T extends ServableLine>(order: ServableOrder<T>, lineIds: readonly string[], at: string): ServeChange<T> {
  const timed = order.isCompleted === true ? serveLines(order.items, topLevelLines(order.items).map(line => line.lineId), at) : [...order.items]
  const items = unserveLines(timed, lineIds)
  const changed = items.some((item, index) => item !== timed[index])
  return changed ? { items, isCompleted: allLinesServed(items) } : { items: [...order.items], isCompleted: order.isCompleted === true }
}
