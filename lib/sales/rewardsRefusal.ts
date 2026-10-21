import { REWARDS_NEED_ITEMS_GENERIC, loyaltyCopy } from '@/lib/loyalty'
import { getResolvedCategories } from '@/lib/menuCategories'

// Server only: what the sale routes answer when an order's loyalty rewards have no item of
// their own to go on, naming the tabs as the menu calls them now. Read only on that refusal,
// so a menu that can't be read never blocks a sale: the answer then names no tab.

export async function rewardsRefusal(): Promise<string> {
  try {
    const tabs = await getResolvedCategories()
    return loyaltyCopy((id) => tabs.find((t) => t.id === id)?.label).rewardsNeedItems
  } catch {
    return REWARDS_NEED_ITEMS_GENERIC
  }
}
