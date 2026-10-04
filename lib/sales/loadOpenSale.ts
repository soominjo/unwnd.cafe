import { client } from '@/sanity/lib/client'
import { openOrderFromSale, type OpenOrder } from '@/app/pos/addToOrder'
import type { Sale } from '@/app/pos/types'

// Server only: the pending order /pos?edit=<id> adds items to, read with the menu so the POS
// paints it straight away. Never throws.

/** Why an order can't be added to: marked complete, not there, or not readable in time. */
export type OpenSaleProblem = 'completed' | 'gone' | 'unreadable'
export type OpenSaleLoad = { order: OpenOrder } | { problem: OpenSaleProblem }

/** How long the /pos page waits for the order before opening a new order instead. */
export const OPEN_SALE_TIMEOUT_MS = 3000

const fresh = client.withConfig({ useCdn: false })
const ID = /^[A-Za-z0-9_-]{1,100}$/

export async function loadOpenSale(id: string): Promise<OpenSaleLoad> {
  if (!ID.test(id)) return { problem: 'gone' }
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`The order took longer than ${OPEN_SALE_TIMEOUT_MS}ms`)), OPEN_SALE_TIMEOUT_MS)
  })
  try {
    const sale = await Promise.race([
      fresh.fetch<Sale | null>('*[_type == "sale" && _id == $id][0]', { id }, { cache: 'no-store' }),
      timeout,
    ])
    if (!sale) return { problem: 'gone' }
    if (sale.isCompleted === true) return { problem: 'completed' }
    return { order: openOrderFromSale(sale) }
  } catch (error) {
    console.error('Order could not be loaded to add items to it', { id }, error)
    return { problem: 'unreadable' }
  } finally {
    clearTimeout(timer)
  }
}
