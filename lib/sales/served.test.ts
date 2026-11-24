import { describe, it, expect } from 'vitest'
import {
  afterServing,
  afterUnserving,
  allLinesServed,
  missingLineIds,
  serveLines,
  splitServed,
  topLevelLines,
  unserveLines,
  type ServableLine,
} from './served'

// Bea's order from the owner's example: a Spanish Latte with oat milk, an Americano, nachos and fries.
const latte: ServableLine = { lineId: 'spanish-latte__ice' }
const oat: ServableLine = { lineId: 'addon__oat-milk__spanish-latte__ice', parentLineId: 'spanish-latte__ice' }
const americano: ServableLine = { lineId: 'americano__hot' }
const nachos: ServableLine = { lineId: 'cheesy-beef-nachos' }
const fries: ServableLine = { lineId: 'classic-fries' }
const items = [latte, oat, americano, nachos, fries]

const AT = '2026-11-24T11:46:00.000Z'
const LATER = '2026-11-24T11:53:00.000Z'
const ids = (lines: readonly ServableLine[]) => lines.map(line => line.lineId)

describe('topLevelLines', () => {
  it('leaves out add-ons, which go out with their item', () => {
    expect(ids(topLevelLines(items))).toEqual(['spanish-latte__ice', 'americano__hot', 'cheesy-beef-nachos', 'classic-fries'])
  })
})

describe('splitServed', () => {
  it('puts every line on the to-serve side while nothing has gone out', () => {
    const split = splitServed({ items })
    expect(split.served).toEqual([])
    expect(ids(split.toServe)).toEqual(['spanish-latte__ice', 'americano__hot', 'cheesy-beef-nachos', 'classic-fries'])
    expect(split.servedLines).toEqual([])
    expect(ids(split.toServeLines)).toEqual(ids(items))
  })

  it('splits a partly served order, and an add-on goes with its item', () => {
    const order = { items: [{ ...latte, servedAt: AT }, oat, { ...americano, servedAt: AT }, { ...nachos, servedAt: AT }, fries] }
    const split = splitServed(order)
    expect(ids(split.served)).toEqual(['spanish-latte__ice', 'americano__hot', 'cheesy-beef-nachos'])
    expect(ids(split.toServe)).toEqual(['classic-fries'])
    expect(ids(split.servedLines)).toEqual(['spanish-latte__ice', 'addon__oat-milk__spanish-latte__ice', 'americano__hot', 'cheesy-beef-nachos'])
    expect(ids(split.toServeLines)).toEqual(['classic-fries'])
  })

  it('attaches an add-on saved without its parent to the item before it, as the Sales card does', () => {
    const legacyShot: ServableLine = { lineId: 'addon__shot' }
    const order = { items: [{ ...americano, servedAt: AT }, legacyShot, fries] }
    expect(ids(splitServed(order).servedLines)).toEqual(['americano__hot', 'addon__shot'])
  })

  it('counts every line of a completed order as served, times or not (orders completed before ticking)', () => {
    const split = splitServed({ isCompleted: true, items })
    expect(split.toServe).toEqual([])
    expect(ids(split.served)).toEqual(['spanish-latte__ice', 'americano__hot', 'cheesy-beef-nachos', 'classic-fries'])
    expect(ids(split.servedLines)).toEqual(ids(items))
  })
})

describe('allLinesServed', () => {
  it('is true only once every top-level line has a time; add-ons never need one', () => {
    expect(allLinesServed(items)).toBe(false)
    expect(allLinesServed(serveLines(items, ['spanish-latte__ice', 'americano__hot', 'cheesy-beef-nachos'], AT))).toBe(false)
    expect(allLinesServed(serveLines(items, ids(topLevelLines(items)), AT))).toBe(true)
  })

  it('is false for an order with no lines', () => {
    expect(allLinesServed([])).toBe(false)
  })
})

describe('serveLines', () => {
  it('stamps the lines asked for and keeps a time already there', () => {
    const once = serveLines(items, ['spanish-latte__ice'], AT)
    const twice = serveLines(once, ['spanish-latte__ice', 'classic-fries'], LATER)
    expect(twice.find(line => line.lineId === 'spanish-latte__ice')?.servedAt).toBe(AT)
    expect(twice.find(line => line.lineId === 'classic-fries')?.servedAt).toBe(LATER)
  })

  it('never stamps an add-on or a line that is not on the order', () => {
    const result = serveLines(items, ['addon__oat-milk__spanish-latte__ice', 'gone__hot'], AT)
    expect(result.every(line => line.servedAt === undefined)).toBe(true)
  })

  it('keeps every other field and leaves the input untouched', () => {
    const rich = [{ lineId: 'americano__hot', _key: 'americano__hot', price: 120, qty: 2 }]
    const result = serveLines(rich, ['americano__hot'], AT)
    expect(result[0]).toEqual({ lineId: 'americano__hot', _key: 'americano__hot', price: 120, qty: 2, servedAt: AT })
    expect(rich[0]).not.toHaveProperty('servedAt')
  })
})

describe('unserveLines', () => {
  it('takes the time off the lines asked for, without touching the input', () => {
    const served = serveLines(items, ['spanish-latte__ice', 'classic-fries'], AT)
    const result = unserveLines(served, ['classic-fries'])
    expect(result.find(line => line.lineId === 'classic-fries')).not.toHaveProperty('servedAt')
    expect(result.find(line => line.lineId === 'spanish-latte__ice')?.servedAt).toBe(AT)
    expect(served.find(line => line.lineId === 'classic-fries')?.servedAt).toBe(AT)
  })
})

describe('afterServing', () => {
  it('completes the order when its last line goes out', () => {
    const partly = afterServing({ items }, ['spanish-latte__ice', 'americano__hot', 'cheesy-beef-nachos'], AT)
    expect(partly.isCompleted).toBe(false)
    const done = afterServing({ items: partly.items }, ['classic-fries'], LATER)
    expect(done.isCompleted).toBe(true)
    expect(done.items.find(line => line.lineId === 'classic-fries')?.servedAt).toBe(LATER)
  })

  it('keeps a completed order completed', () => {
    expect(afterServing({ isCompleted: true, items }, [], AT).isCompleted).toBe(true)
  })
})

describe('afterUnserving', () => {
  it('reopens an order: it is no longer completed', () => {
    const done = afterServing({ items }, ids(topLevelLines(items)), AT)
    const reopened = afterUnserving({ isCompleted: true, items: done.items }, ['classic-fries'], LATER)
    expect(reopened.isCompleted).toBe(false)
    expect(reopened.items.find(line => line.lineId === 'classic-fries')).not.toHaveProperty('servedAt')
    expect(reopened.items.find(line => line.lineId === 'americano__hot')?.servedAt).toBe(AT)
  })

  it('keeps the other lines of an order completed before ticking served, at the time given', () => {
    const reopened = afterUnserving({ isCompleted: true, items }, ['classic-fries'], LATER)
    expect(reopened.isCompleted).toBe(false)
    expect(splitServed(reopened).served.map(line => line.lineId)).toEqual(['spanish-latte__ice', 'americano__hot', 'cheesy-beef-nachos'])
    expect(reopened.items.find(line => line.lineId === 'spanish-latte__ice')?.servedAt).toBe(LATER)
    expect(reopened.items.find(line => line.lineId === 'addon__oat-milk__spanish-latte__ice')).not.toHaveProperty('servedAt')
  })

  it('changes nothing when the line asked for was not served', () => {
    const result = afterUnserving({ items }, ['classic-fries'], AT)
    expect(result.isCompleted).toBe(false)
    expect(result.items).toEqual(items)
  })
})

describe('missingLineIds', () => {
  it('names the ids that are not top-level lines of the order', () => {
    expect(missingLineIds(items, ['classic-fries', 'addon__oat-milk__spanish-latte__ice', 'gone__hot'])).toEqual([
      'addon__oat-milk__spanish-latte__ice',
      'gone__hot',
    ])
  })
})
