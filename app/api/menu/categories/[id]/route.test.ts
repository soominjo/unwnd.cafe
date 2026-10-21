import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requirePosAuth, fetch, mutate, patch, set, commit, revalidatePath } = vi.hoisted(() => {
  const commit = vi.fn()
  const set = vi.fn(() => ({ commit }))
  return { requirePosAuth: vi.fn(), fetch: vi.fn(), mutate: vi.fn(), patch: vi.fn(() => ({ set })), set, commit, revalidatePath: vi.fn() }
})
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/sanity/lib/writeClient', () => ({ getWriteClient: () => ({ mutate, patch }) }))
vi.mock('@/sanity/lib/client', () => ({ client: { withConfig: () => ({ fetch }) } }))

import { DELETE, PATCH } from './route'

const tab = { _id: 'menu-category-espresso', id: 'espresso', label: 'Espresso', type: 'drink', order: 2 }
const req = (body?: unknown) =>
  new NextRequest('http://pos.test/api/menu/categories/x', { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) })
// A delete as the category manager sends it: with how many items the screen said the tab holds.
const del = (shown?: number) =>
  new NextRequest(`http://pos.test/api/menu/categories/x${shown === undefined ? '' : `?items=${shown}`}`, { method: 'DELETE' })
const params = (id: string) => ({ params: Promise.resolve({ id }) })

// What Sanity answers each read: the tab, its items, and the settings document.
function answer({ tab, itemIds, settings, unavailable = [] }: { tab: unknown; itemIds: string[]; settings: unknown; unavailable?: string[] }) {
  fetch.mockImplementation(async (query: string) => {
    if (query.includes('"menuSettings"')) return settings
    if (query.includes('"menuItem"')) return [...itemIds.map((_id) => ({ _id, available: true })), ...unavailable.map((_id) => ({ _id, available: false }))]
    return tab
  })
}

beforeEach(() => {
  vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token')
  requirePosAuth.mockReset().mockResolvedValue(null)
  for (const fn of [fetch, mutate, patch, set, commit, revalidatePath]) fn.mockClear()
  mutate.mockReset().mockResolvedValue({})
  commit.mockReset().mockResolvedValue({})
  answer({ tab, itemIds: [], settings: null })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('PATCH /api/menu/categories/[id]', () => {
  it('renames a tab: only its name changes, and /menu refreshes', async () => {
    const res = await PATCH(req({ label: '  Classic ' }), params('menu-category-espresso'))
    expect(res.status).toBe(200)
    expect(patch).toHaveBeenCalledWith('menu-category-espresso')
    expect(set).toHaveBeenCalledWith({ label: 'Classic' })
    expect((await res.json()).category).toEqual({ _sanityId: 'menu-category-espresso', id: 'espresso', label: 'Classic', type: 'drink', order: 2 })
    expect(revalidatePath).toHaveBeenCalledWith('/menu')
  })

  it('refuses a blank name or one over 40 characters, and changes nothing', async () => {
    for (const body of [{ label: '   ' }, { label: 'x'.repeat(41) }, {}]) {
      const res = await PATCH(req(body), params('menu-category-espresso'))
      expect(res.status).toBe(400)
      expect((await res.json()).error).toBe('Name must be 1–40 characters.')
    }
    expect(patch).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/menu/categories/[id]', () => {
  it('deletes the tab, every item in it and its place in the tab order, in one write', async () => {
    answer({ tab, itemIds: ['a', 'b', 'c'], settings: { categoryOrder: ['signature', 'espresso', 'snack'] } })
    const res = await DELETE(del(3), params('menu-category-espresso'))
    expect(await res.json()).toEqual({ success: true, deletedItems: 3 })
    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate).toHaveBeenCalledWith([
      { delete: { id: 'menu-category-espresso' } },
      { delete: { id: 'a' } }, { delete: { id: 'b' } }, { delete: { id: 'c' } },
      { patch: { id: 'menu-settings', set: { categoryOrder: ['signature', 'snack'] } } },
    ])
    expect(revalidatePath).toHaveBeenCalledWith('/menu')
  })

  it('deletes a tab that has no place in the saved order without touching the settings', async () => {
    answer({ tab, itemIds: [], settings: null })
    await DELETE(del(0), params('menu-category-espresso'))
    expect(mutate).toHaveBeenCalledWith([{ delete: { id: 'menu-category-espresso' } }])
  })

  it('refuses a tab with items when the screen did not say how many, as from a tablet not reloaded since the update', async () => {
    answer({ tab, itemIds: ['a'], settings: null })
    const res = await DELETE(del(), params('menu-category-espresso'))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Reload the POS to delete a tab that still has items.')
    expect(mutate).not.toHaveBeenCalled()
  })

  it('refuses when the tab now holds a different number of items than the screen showed', async () => {
    answer({ tab, itemIds: ['a', 'b', 'c'], settings: null })
    const res = await DELETE(del(2), params('menu-category-espresso'))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('Espresso now has 3 items. Reload the POS and try again.')
    expect(mutate).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('still deletes an empty tab without a count, and counts only the items the POS shows', async () => {
    answer({ tab, itemIds: [], settings: null })
    expect((await DELETE(del(), params('menu-category-espresso'))).status).toBe(200)
    answer({ tab, itemIds: ['a'], unavailable: ['off'], settings: null })
    mutate.mockClear()
    expect(await (await DELETE(del(1), params('menu-category-espresso'))).json()).toEqual({ success: true, deletedItems: 2 })
    expect(mutate).toHaveBeenCalledWith([{ delete: { id: 'menu-category-espresso' } }, { delete: { id: 'a' } }, { delete: { id: 'off' } }])
  })

  it('changes nothing for a missing tab or a failed write', async () => {
    answer({ tab: null, itemIds: [], settings: null })
    expect((await DELETE(del(0), params('nope'))).status).toBe(404)
    expect((await PATCH(req({ label: 'Classic' }), params('nope'))).status).toBe(404)
    answer({ tab, itemIds: ['a'], settings: null })
    mutate.mockRejectedValueOnce(new Error('down'))
    expect((await DELETE(del(1), params('menu-category-espresso'))).status).toBe(500)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
