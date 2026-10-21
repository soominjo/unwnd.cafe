import { describe, it, expect, vi } from 'vitest'

const { getResolvedCategories } = vi.hoisted(() => ({ getResolvedCategories: vi.fn() }))
vi.mock('@/lib/menuCategories', () => ({ getResolvedCategories }))

import { REWARDS_NEED_ITEMS_GENERIC } from '@/lib/loyalty'
import { rewardsRefusal } from './rewardsRefusal'

describe('the refusal for rewards with no item of their own', () => {
  it('names the tabs as the menu calls them now', async () => {
    getResolvedCategories.mockResolvedValue([
      { id: 'espresso', label: 'Classic' }, { id: 'non-coffee', label: 'Non-Coffee' },
      { id: 'waffle', label: 'Waffle' }, { id: 'snack', label: 'Snack' },
    ])
    expect(await rewardsRefusal()).toBe('Each loyalty reward needs its own item: a Classic or Non-Coffee drink for the free drink, and a Classic, Non-Coffee, Waffle or Snack item for the 10%.')
  })

  it('falls back to wording without tab names when the menu cannot be read', async () => {
    getResolvedCategories.mockRejectedValue(new Error('Sanity is down'))
    expect(await rewardsRefusal()).toBe(REWARDS_NEED_ITEMS_GENERIC)
  })
})
