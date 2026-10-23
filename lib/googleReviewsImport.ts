import { createHash } from 'node:crypto'

// Turns a Google Takeout export of the café's Business Profile (Takeout → "Google Business
// Profile"), which holds every review, into the Studio "Google reviews" document. Signed-out
// Google Maps shows only a handful of reviews, so the export is the way to all of them.
// scripts/import-google-reviews.ts reads the files and publishes; everything here is pure.
// Node runs that script as it is (type stripping), so this file imports nothing but node: modules.

/** One review as the export holds it. */
export interface TakeoutReview {
  /** Google's id for the review: its reviewId, or the last part of its resource name. */
  id: string
  displayName: string
  /** Google shows the reviewer as "A Google user". */
  anonymous: boolean
  /** 1–5, or null when the export gives no usable rating. */
  stars: number | null
  /** The reviewer's own words, without Google's translation; '' for a rating without words. */
  text: string
  /** When it was written (ISO 8601), or '' when the export doesn't say. */
  createTime: string
}

/** A review as the "Google reviews" document stores it (sanity/schemaTypes/googleReviews.ts). */
export interface StudioReview {
  _key: string
  _type: 'googleReview'
  quote: string
  name: string
  /** The Manila day it was written, YYYY-MM-DD; the site shows only its month. */
  date?: string
  stars: number
}

/** A review already in Studio, as much of it as matching needs. */
export interface ExistingReview {
  _key: string
  quote?: string | null
  name?: string | null
}

/** Reviewers never shown: the owner's own review. */
export const EXCLUDED_REVIEWERS: readonly string[] = ['Gens Contreras']

/** The fewest stars a shown review has. */
export const MIN_STARS_SHOWN = 4

/** The longest quote Studio accepts (the schema's max). */
export const QUOTE_MAX = 400

const ANONYMOUS_NAME = 'A Google user'
const STAR_WORDS = new Map([['ONE', 1], ['TWO', 2], ['THREE', 3], ['FOUR', 4], ['FIVE', 5]])
const TRANSLATED = '(Translated by Google)'
const ORIGINAL = '(Original)'
const MANILA_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })

type JsonObject = Record<string, unknown>

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

// A review has a rating, or a reviewer and words. The owner's reply inside it has neither.
const isReview = (value: JsonObject) => 'starRating' in value || (isObject(value.reviewer) && 'comment' in value)

// "FIVE" as Google writes it, or 5 or "5".
function starsOf(rating: unknown): number | null {
  if (typeof rating === 'number') return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null
  if (typeof rating !== 'string') return null
  const word = rating.trim().toUpperCase()
  if (/^[1-5]$/.test(word)) return Number(word)
  return STAR_WORDS.get(word) ?? null
}

function idOf(review: JsonObject): string {
  if (typeof review.reviewId === 'string' && review.reviewId) return review.reviewId
  if (typeof review.name === 'string' && review.name) return review.name.split('/').pop() ?? review.name
  return ''
}

// Google puts its translation before "(Original)" and the reviewer's words after it, or the
// reviewer's words first and "(Translated by Google)" after them. Keep the reviewer's words.
function originalWords(comment: unknown): string {
  if (typeof comment !== 'string') return ''
  const original = comment.indexOf(ORIGINAL)
  if (original >= 0) return comment.slice(original + ORIGINAL.length).trim()
  const translated = comment.indexOf(TRANSLATED)
  if (translated > 0) return comment.slice(0, translated).trim()
  if (translated === 0) return comment.slice(TRANSLATED.length).trim()
  return comment.trim()
}

function toTakeoutReview(review: JsonObject): TakeoutReview {
  const reviewer = isObject(review.reviewer) ? review.reviewer : {}
  const displayName = typeof reviewer.displayName === 'string' ? reviewer.displayName.trim() : ''
  const text = originalWords(review.comment)
  const createTime = typeof review.createTime === 'string' ? review.createTime : ''
  return {
    id: idOf(review) || `${displayName}|${createTime}|${text}`,
    displayName,
    anonymous: reviewer.isAnonymous === true,
    stars: starsOf(review.starRating),
    text,
    createTime,
  }
}

/** Every review in a parsed export (one file's JSON, or an array of several files' JSON), each once. */
export function parseTakeoutReviews(json: unknown): TakeoutReview[] {
  const found = new Map<string, TakeoutReview>()
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (!isObject(value)) return
    if (isReview(value)) {
      const review = toTakeoutReview(value)
      if (!found.has(review.id)) found.set(review.id, review)
      return
    }
    Object.values(value).forEach(visit)
  }
  visit(json)
  return [...found.values()]
}

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

// The same words however they were typed: quotation marks round them, spaces, capitals.
const matchable = (quote: string) => oneLine(quote).replace(/^["“”]+|["“”]+$/g, '').trim().toLowerCase()

// The first name, or the first two words when the first is an abbreviation such as "Ma." (Maria).
function firstName(review: TakeoutReview): string {
  if (review.anonymous || !review.displayName || review.displayName.toLowerCase() === ANONYMOUS_NAME.toLowerCase()) {
    return ANONYMOUS_NAME
  }
  const [first, second] = review.displayName.split(/\s+/)
  return first.endsWith('.') && second ? `${first} ${second}` : first
}

// Cut at the last space that leaves at least half the room; with no such space, cut whole
// characters, so an emoji is never split in two. The length Studio checks counts UTF-16 units.
function cutAtWord(text: string): string {
  if (text.length <= QUOTE_MAX) return text
  const room = QUOTE_MAX - 1 // one left for the ellipsis
  const lastSpace = text.slice(0, room).lastIndexOf(' ')
  if (lastSpace > QUOTE_MAX / 2) return `${text.slice(0, lastSpace).trimEnd()}…`
  let cut = ''
  for (const character of Array.from(text)) {
    if (cut.length + character.length > room) break
    cut += character
  }
  return `${cut.trimEnd()}…`
}

function manilaDate(createTime: string): string | undefined {
  const time = Date.parse(createTime)
  return Number.isNaN(time) ? undefined : MANILA_DAY.format(time)
}

const keyFor = (id: string) => createHash('sha256').update(id).digest('hex').slice(0, 12)

const isExcluded = (review: TakeoutReview) =>
  EXCLUDED_REVIEWERS.some((name) => name.toLowerCase() === review.displayName.toLowerCase())

const isShown = (review: TakeoutReview): review is TakeoutReview & { stars: number } =>
  review.text !== '' && review.stars !== null && review.stars >= MIN_STARS_SHOWN && !isExcluded(review)

const newestFirst = (a: TakeoutReview, b: TakeoutReview) => (Date.parse(b.createTime) || 0) - (Date.parse(a.createTime) || 0)

/**
 * The reviews the home page should show, newest first: those with words and 4 or 5 stars, but not
 * the owner's own. A review already in Studio keeps its key and the name typed for it ("Sarah
 * Jane"); a new one gets the reviewer's first name and a key made from Google's id.
 */
export function toStudioReviews(reviews: readonly TakeoutReview[], existing: readonly ExistingReview[]): StudioReview[] {
  const typed = new Map(existing.filter((r) => r.quote).map((r) => [matchable(r.quote ?? ''), r]))
  const usedKeys = new Set<string>()

  return reviews
    .filter(isShown)
    .sort(newestFirst)
    .map((review) => {
      const quote = cutAtWord(oneLine(review.text))
      const match = typed.get(matchable(quote))
      const keep = match && !usedKeys.has(match._key) ? match : undefined
      const _key = keep?._key ?? keyFor(review.id)
      usedKeys.add(_key)
      return {
        _key,
        _type: 'googleReview' as const,
        quote,
        name: keep?.name?.trim() || firstName(review),
        date: manilaDate(review.createTime),
        stars: review.stars,
      }
    })
}

/** One export file's JSON, read even when it was saved with a byte order mark; a file that isn't JSON is named in the error. */
export function parseExportFile(file: string, text: string): unknown {
  try {
    return JSON.parse(text.replace(/^﻿/, ''))
  } catch (error) {
    throw new Error(`${file} is not valid JSON (${error instanceof Error ? error.message : String(error)}).`)
  }
}

/**
 * What to tell the owner before publishing: Google's count dropping below the one in Studio
 * (Google can remove reviews, so this warns rather than refuses), and unpublished Studio changes,
 * which would overwrite the import when someone publishes them.
 */
export function importWarnings({ exportCount, studioCount, hasDraft }: { exportCount: number; studioCount: number | null; hasDraft: boolean }): string[] {
  const warnings: string[] = []
  if (studioCount !== null && exportCount < studioCount) {
    warnings.push(`Warning: the export has ${exportCount} reviews but Studio says ${studioCount}. Google may have removed some; the count will become ${exportCount}.`)
  }
  if (hasDraft) {
    warnings.push('Warning: Studio has unpublished changes to "Google reviews". Publishing them later would overwrite this import: discard them in Studio first.')
  }
  return warnings
}

/** Stops a publish that would empty the reviews, as when nothing in the export was recognised. */
export function assertPublishable(reviews: readonly StudioReview[]): void {
  if (reviews.length === 0) {
    throw new Error('Nothing to publish: no review with words was recognised in the export, so the reviews in Studio stay as they are.')
  }
}

/** Google's figures from the export: the mean of every rating to one decimal, and every review, words or not. */
export function summarize(reviews: readonly TakeoutReview[]): { rating: number | null; reviewCount: number } {
  const stars = reviews.map((r) => r.stars).filter((s): s is number => s !== null)
  const rating = stars.length === 0 ? null : Math.round((stars.reduce((sum, s) => sum + s, 0) / stars.length) * 10) / 10
  return { rating, reviewCount: reviews.length }
}
