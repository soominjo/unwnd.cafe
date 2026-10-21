// One-time move of the six tabs that were written in code into Sanity, so manager mode on the
// POS can rename and delete them like any other tab. It runs once: a tab whose id Sanity already
// has is left alone, each new tab gets a fixed _id, and a record of the move is saved with them,
// so running it again does nothing, and a tab the owner deletes afterwards stays deleted.
//
//   node --env-file=.env.local scripts/move-code-tabs-to-sanity.ts
//
// It writes to the live menu (localhost and the live site share the dataset), so it is run only
// with the owner's go-ahead, before the code that stops reading the code tabs ships.

import { pathToFileURL } from 'node:url'
import { createClient } from '@sanity/client'

export interface FormerCodeTab {
  id: string
  label: string
  type: 'drink' | 'food'
  order: number
}

/** The tabs as lib/menuCategories.ts had them (BUILT_IN_CATEGORIES at ecc312f), Espresso shown as Classic. */
export const FORMER_CODE_TABS: readonly FormerCodeTab[] = [
  { id: 'signature', label: 'Signature', type: 'drink', order: 1 },
  { id: 'espresso', label: 'Classic', type: 'drink', order: 2 },
  { id: 'non-coffee', label: 'Non-Coffee', type: 'drink', order: 3 },
  { id: 'meal', label: 'Meal', type: 'food', order: 4 },
  { id: 'waffle', label: 'Waffle', type: 'food', order: 5 },
  { id: 'snack', label: 'Snack', type: 'food', order: 6 },
]

/** The document that records the move was made. While it exists, the script changes nothing. */
export const MOVE_RECORD_ID = 'menu-code-tabs-moved'

/** A tab's document _id. No dots: an _id with a dot is not publicly readable. */
export function tabDocId(id: string): string {
  return `menu-category-${id}`
}

export interface TabMoveClient {
  fetch<T>(query: string): Promise<T>
  createIfNotExists(doc: { _id: string; _type: string } & Record<string, unknown>): Promise<unknown>
}

export interface TabMoveReport {
  created: string[]
  alreadyThere: string[]
  /** The move was made before: nothing was created. */
  alreadyMoved: boolean
}

/** Creates each former code tab Sanity does not have yet, once, and reports which ids it created and which were there. */
export async function moveCodeTabs(client: TabMoveClient): Promise<TabMoveReport> {
  const state = await client.fetch<{ moved: boolean; ids: string[] }>(
    `{ "moved": defined(*[_id == "${MOVE_RECORD_ID}"][0]._id), "ids": *[_type == "menuCategory"].id }`
  )
  if (state.moved) return { created: [], alreadyThere: [], alreadyMoved: true }
  const existing = new Set(state.ids)
  const created: string[] = []
  const alreadyThere: string[] = []
  for (const tab of FORMER_CODE_TABS) {
    if (existing.has(tab.id)) {
      alreadyThere.push(tab.id)
      continue
    }
    await client.createIfNotExists({ _id: tabDocId(tab.id), _type: 'menuCategory', ...tab })
    created.push(tab.id)
  }
  await client.createIfNotExists({ _id: MOVE_RECORD_ID, _type: 'menuCodeTabsMove', created })
  return { created, alreadyThere, alreadyMoved: false }
}

async function main(): Promise<void> {
  const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID
  const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET
  const token = process.env.SANITY_API_WRITE_TOKEN
  const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION ?? '2026-03-09'
  if (!projectId || !dataset || !token) {
    throw new Error('Run with --env-file=.env.local: NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET and SANITY_API_WRITE_TOKEN are needed.')
  }
  const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false })
  const report = await moveCodeTabs(client)
  const label = (id: string) => FORMER_CODE_TABS.find((t) => t.id === id)?.label ?? id
  for (const id of report.created) process.stdout.write(`created ${id} (${label(id)})\n`)
  for (const id of report.alreadyThere) process.stdout.write(`already there: ${id}\n`)
  if (report.alreadyMoved) process.stdout.write('The code tabs were moved before: nothing to do.\n')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
