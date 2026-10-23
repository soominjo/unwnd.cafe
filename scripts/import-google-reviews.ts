// Fills the Studio "Google reviews" document from a Google Takeout export of the café's Business
// Profile, so the home page's marquee can show every review with words, not just the handful that
// signed-out Google Maps shows. The owner gets the export at takeout.google.com: Deselect all, tick
// "Google Business Profile", Export once, then unzip it.
//
//   node --env-file=.env.local scripts/import-google-reviews.ts <unzipped Takeout folder, or a .json file>
//   node --env-file=.env.local scripts/import-google-reviews.ts <same> --write
//
// Without --write it only prints what it would publish. With --write it publishes straight to the
// live document (localhost and the live site share the dataset), so that is run only with the
// owner's go-ahead. It never publishes an empty list, and it warns when Google's count dropped or
// unpublished Studio changes would overwrite the import (lib/googleReviewsImport.ts has the rules).

import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@sanity/client'

type ImportRules = typeof import('../lib/googleReviewsImport')
type Singletons = typeof import('../sanity/singletons')
type ExistingReview = import('../lib/googleReviewsImport').ExistingReview
type StudioReview = import('../lib/googleReviewsImport').StudioReview
type TakeoutReview = import('../lib/googleReviewsImport').TakeoutReview

interface CurrentDoc {
  _rev: string
  reviewCount: number | null
  reviews: ExistingReview[] | null
}

interface Plan {
  takeout: TakeoutReview[]
  existing: ExistingReview[]
  reviews: StudioReview[]
  rating: number | null
  reviewCount: number
  warnings: string[]
}

// Node needs the .ts on a relative import, which this project's TypeScript settings don't allow,
// so the shared code is loaded by URL.
const loadTs = <T>(path: string): Promise<T> => import(new URL(path, import.meta.url).href)

const out = (line = '') => process.stdout.write(`${line}\n`)
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

function readArgs(args: readonly string[]): { path: string; write: boolean } {
  const path = args.find((arg) => !arg.startsWith('--'))
  if (!path) throw new Error('Give the unzipped Takeout folder, or a .json file from it. Add --write to publish.')
  if (path.toLowerCase().endsWith('.zip')) throw new Error('Unzip the Takeout file first, then give its folder.')
  return { path, write: args.includes('--write') }
}

function sanityEnv(write: boolean) {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
  const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-03-09'
  const token = process.env.SANITY_API_WRITE_TOKEN
  if (!projectId || !dataset) {
    throw new Error('Run with --env-file=.env.local: NEXT_PUBLIC_SANITY_PROJECT_ID and NEXT_PUBLIC_SANITY_DATASET are needed.')
  }
  if (write && !token) throw new Error('Run with --env-file=.env.local: SANITY_API_WRITE_TOKEN is needed to publish.')
  return { projectId, dataset, apiVersion, token }
}

/** The JSON files to read: the file given, or every .json under the folder given (only review-shaped entries count). */
async function jsonFiles(path: string): Promise<string[]> {
  if ((await stat(path)).isFile()) return [path]
  const entries = await readdir(path, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort()
}

// What would be published, a line per review, then what was left out and why, then any warnings.
function printPlan(rules: ImportRules, { takeout, existing, reviews, rating, reviewCount, warnings }: Plan): void {
  out(`${reviewCount} reviews in the export (Google's count), rating ${rating ?? 'none'}.`)
  out(`${reviews.length} to show, newest first:`)
  const kept = new Set(existing.map((r) => r._key))
  for (const r of reviews) {
    out(`  ${r.date ?? '----------'}  ${'★'.repeat(r.stars).padEnd(5)}  ${clip(r.name, 16).padEnd(16)}  ${kept.has(r._key) ? 'kept' : 'new '}  ${clip(r.quote, 70)}`)
  }
  const isOwn = (name: string) => rules.EXCLUDED_REVIEWERS.some((own) => own.toLowerCase() === name.toLowerCase())
  const withoutWords = takeout.filter((r) => r.text === '').length
  const lowStars = takeout.filter((r) => r.text !== '' && (r.stars ?? 0) < rules.MIN_STARS_SHOWN).length
  const own = takeout.filter((r) => r.text !== '' && isOwn(r.displayName)).length
  out(`Not shown: ${withoutWords} rating(s) without words, ${lowStars} under ${rules.MIN_STARS_SHOWN} stars, ${own} by the owner.`)
  const dropped = existing.filter((r) => !reviews.some((shown) => shown._key === r._key))
  if (dropped.length > 0) out(`In Studio but not matched in the export, so replaced: ${dropped.map((r) => r.name ?? r._key).join(', ')}.`)
  for (const warning of warnings) out(warning)
}

async function main(): Promise<void> {
  const { path, write } = readArgs(process.argv.slice(2))
  const env = sanityEnv(write)
  const rules = await loadTs<ImportRules>('../lib/googleReviewsImport.ts')
  const { GOOGLE_REVIEWS_ID } = await loadTs<Singletons>('../sanity/singletons.ts')

  const files = await jsonFiles(path)
  const parsed = await Promise.all(files.map(async (file) => rules.parseExportFile(file, await readFile(file, 'utf8'))))
  const takeout = rules.parseTakeoutReviews(parsed)
  if (takeout.length === 0) {
    throw new Error(`No reviews in the ${files.length} .json file(s) under ${path}. Was "Google Business Profile" ticked in Takeout?`)
  }

  const client = createClient({ ...env, useCdn: false })
  const current = await client.fetch<CurrentDoc | null>(`*[_id == $id][0]{ _rev, reviewCount, reviews[]{ _key, quote, name } }`, { id: GOOGLE_REVIEWS_ID })
  // Unpublished changes can be read only with a token; without one there is nothing to check.
  const hasDraft = env.token
    ? await client.fetch<boolean>('defined(*[_id == $id][0]._id)', { id: `drafts.${GOOGLE_REVIEWS_ID}` }, { perspective: 'raw' })
    : false
  const existing = current?.reviews ?? []
  const reviews = rules.toStudioReviews(takeout, existing)
  const { rating, reviewCount } = rules.summarize(takeout)
  const warnings = rules.importWarnings({ exportCount: reviewCount, studioCount: current?.reviewCount ?? null, hasDraft })
  printPlan(rules, { takeout, existing, reviews, rating, reviewCount, warnings })

  if (!write) {
    out()
    out('Dry run: nothing was published. Run again with --write to publish this.')
    return
  }
  rules.assertPublishable(reviews)
  if (!current) throw new Error(`The ${GOOGLE_REVIEWS_ID} document is not published yet: publish it once in Studio first.`)
  await client
    .patch(GOOGLE_REVIEWS_ID)
    .ifRevisionId(current._rev)
    .set({ ...(rating !== null && { rating }), reviewCount, reviews })
    .commit()
  out(`Published ${reviews.length} reviews (rating ${rating ?? 'unchanged'}, ${reviewCount} on Google).`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
