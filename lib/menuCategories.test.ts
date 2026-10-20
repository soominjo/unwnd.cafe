import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fetch } = vi.hoisted(() => ({ fetch: vi.fn() }))
vi.mock('@/sanity/lib/client', () => ({ client: { fetch, withConfig: () => ({ fetch }) } }))

import { getResolvedCategories } from './menuCategories'

beforeEach(() => {
  // No custom tabs and no saved tab order: the built-in tabs alone, in their own order.
  fetch.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce(null)
})

describe('the built-in tabs', () => {
  it('call the espresso tab Classic, keeping its id so the loyalty rules for it still apply', async () => {
    const tabs = await getResolvedCategories()
    expect(tabs.find((t) => t.id === 'espresso')?.label).toBe('Classic')
    expect(tabs.map((t) => t.label)).not.toContain('Espresso')
  })
})
