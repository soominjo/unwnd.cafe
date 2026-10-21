import { describe, it, expect, vi } from 'vitest'

import { FORMER_CODE_TABS, MOVE_RECORD_ID, moveCodeTabs, tabDocId, type TabMoveClient } from './move-code-tabs-to-sanity'

function fakeClient(existingIds: string[], moved = false) {
  const created: unknown[] = []
  const client: TabMoveClient = {
    fetch: vi.fn(async () => ({ moved, ids: existingIds })) as TabMoveClient['fetch'],
    createIfNotExists: vi.fn(async (doc) => {
      created.push(doc)
      return doc
    }),
  }
  return { client, created }
}

describe('moving the code tabs into Sanity', () => {
  it('copies the six code tabs exactly as the code has them, Espresso as Classic', () => {
    expect(FORMER_CODE_TABS).toEqual([
      { id: 'signature', label: 'Signature', type: 'drink', order: 1 },
      { id: 'espresso', label: 'Classic', type: 'drink', order: 2 },
      { id: 'non-coffee', label: 'Non-Coffee', type: 'drink', order: 3 },
      { id: 'meal', label: 'Meal', type: 'food', order: 4 },
      { id: 'waffle', label: 'Waffle', type: 'food', order: 5 },
      { id: 'snack', label: 'Snack', type: 'food', order: 6 },
    ])
  })

  it('creates each tab Sanity does not have yet, under a fixed dot-free _id, and no items', async () => {
    const { client, created } = fakeClient(['add-ons', 'matcha-series', 'add-ons-food'])
    const report = await moveCodeTabs(client)
    expect(report).toEqual({ created: ['signature', 'espresso', 'non-coffee', 'meal', 'waffle', 'snack'], alreadyThere: [], alreadyMoved: false })
    expect(created).toContainEqual({ _id: 'menu-category-espresso', _type: 'menuCategory', id: 'espresso', label: 'Classic', type: 'drink', order: 2 })
    const tabs = (created as { _id: string; _type: string }[]).filter((d) => d._type === 'menuCategory')
    expect(tabs).toHaveLength(6)
    for (const doc of tabs) {
      expect(doc._id).toMatch(/^[a-z0-9-]+$/)
      expect(doc._type).toBe('menuCategory')
    }
    expect(vi.mocked(client.fetch).mock.calls[0][0]).toContain('"menuCategory"')
  })

  it('changes nothing on a second run, and skips a tab id Sanity already has', async () => {
    const again = fakeClient(['signature', 'espresso', 'non-coffee', 'meal', 'waffle', 'snack'])
    expect(await moveCodeTabs(again.client)).toEqual({ created: [], alreadyThere: ['signature', 'espresso', 'non-coffee', 'meal', 'waffle', 'snack'], alreadyMoved: false })
    expect(again.created.filter((d) => (d as { _type: string })._type === 'menuCategory')).toEqual([])

    const partly = fakeClient(['espresso'])
    expect((await moveCodeTabs(partly.client)).alreadyThere).toEqual(['espresso'])
    expect(partly.created.filter((d) => (d as { _type: string })._type === 'menuCategory')).toHaveLength(5)
  })

  it('records the move, and never runs again: a tab the owner deletes afterwards stays deleted', async () => {
    const first = fakeClient(['add-ons'])
    await moveCodeTabs(first.client)
    expect(first.created).toContainEqual(expect.objectContaining({ _id: MOVE_RECORD_ID }))

    // Later the owner deleted Waffle; a second run must not bring it back.
    const later = fakeClient(['signature', 'espresso', 'non-coffee', 'meal', 'snack', 'add-ons'], true)
    expect(await moveCodeTabs(later.client)).toEqual({ created: [], alreadyThere: [], alreadyMoved: true })
    expect(later.created).toEqual([])
  })

  it('names each tab document after its id', () => {
    expect(tabDocId('non-coffee')).toBe('menu-category-non-coffee')
  })
})
