import { NextRequest, NextResponse } from 'next/server'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { toSaleDiscountDocs } from '@/lib/sales/toSaleDiscountDocs'
import {
  MAX_DISCOUNTS,
  MAX_ITEMS,
  MAX_PRICE,
  isValidAmount,
  isValidDiscountRows,
  isValidNotes,
  isValidSaleItem,
  toSaleItemDoc,
  type SaleDiscountInput,
  type SaleItemInput,
} from '@/lib/sales/validateSaleInput'
import { ORDER_CHANGED, ORDER_COMPLETED, ORDER_GONE, type AddItemsBody } from '@/lib/sales/addItems'
import { LOYALTY_CARD_CHANGED, REWARDS_NEED_ITEMS, rewardProblem, rewardsFitOrder, stampsIn, type CardTotals, type LoyaltyReward } from '@/lib/loyalty'
import { fetchCardTotals } from '@/lib/loyaltyStore'

export const dynamic = 'force-dynamic'

// Adds a customer's follow-up to their pending order, so one transaction stays one sale.
// Only the new lines are sent, with the revision of the order the POS opened: a save from a
// POS that opened an older version (another device changed the order, or this same save
// already went through and its reply was lost) is refused, never applied twice. The money
// is worked out here, from the order as stored.

interface StoredSale {
  _id: string
  _type: string
  _rev: string
  total: number
  notes?: string
  isCompleted?: boolean
  items: Array<{ _key: string; price: number; qty: number }>
  discounts?: Array<{ _key: string }>
  loyaltyMemberId?: string
  loyaltyRewards?: LoyaltyReward[]
}

type WriteClient = ReturnType<typeof getWriteClient>

const ID = /^[A-Za-z0-9_-]{1,100}$/
const REVISION = /^[A-Za-z0-9_-]{1,64}$/

const refuse = (status: number, error: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ success: false, error, ...extra }, { status })

function parseBody(body: unknown): AddItemsBody | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (typeof b.rev !== 'string' || !REVISION.test(b.rev)) return null
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > MAX_ITEMS || !b.items.every(isValidSaleItem)) return null
  const items = b.items as SaleItemInput[]
  const lineIds = items.map(i => i.lineId)
  if (lineIds.some(id => !ID.test(id)) || new Set(lineIds).size !== lineIds.length) return null
  const discounts = b.discounts ?? []
  // Rows go on new lines only: the saved part of the order keeps its own.
  if (!isValidDiscountRows(discounts) || discounts.some(d => !lineIds.includes(d.lineId))) return null
  if (b.paymentAmount !== undefined && !isValidAmount(b.paymentAmount)) return null
  if (b.notes !== undefined && !isValidNotes(b.notes)) return null
  const rewards = b.loyaltyRewards ?? []
  if (!Array.isArray(rewards) || rewards.some(r => r !== 'ten' && r !== 'free') || new Set(rewards).size !== rewards.length) return null
  return {
    rev: b.rev,
    items,
    discounts,
    ...(b.paymentAmount !== undefined ? { paymentAmount: b.paymentAmount } : {}),
    ...(b.notes !== undefined ? { notes: b.notes } : {}),
    loyaltyRewards: rewards as LoyaltyReward[],
  }
}

/**
 * The reply for an order that is not as the POS opened it: completed, gone, or changed. The
 * order comes back as it now is, so a POS whose earlier save went through (its reply lost)
 * can see its lines on it.
 */
async function refuseStale(writeClient: WriteClient, id: string): Promise<NextResponse> {
  let now: StoredSale | undefined
  try {
    now = await writeClient.getDocument<StoredSale>(id)
  } catch (error) {
    console.error('Order could not be read again after a refused save', { id }, error)
    return refuse(500, 'Failed to add the items.')
  }
  if (!now || now._type !== 'sale') return refuse(404, 'This order no longer exists.', { code: ORDER_GONE })
  if (now.isCompleted === true) return refuse(409, 'This order was completed, so nothing more can be added to it.', { code: ORDER_COMPLETED, data: now })
  return refuse(409, 'This order changed on another device.', { code: ORDER_CHANGED, data: now })
}

/** Each new line's discount rows come to no more than the line and its add-ons cost. */
function rowsFitTheirLines(items: SaleItemInput[], rows: SaleDiscountInput[]): boolean {
  return items.every(line => {
    const off = rows.filter(row => row.lineId === line.lineId).reduce((sum, row) => sum + row.amount, 0)
    const addons = items.filter(i => i.parentLineId === line.lineId).reduce((sum, i) => sum + i.price * i.qty, 0)
    return off <= line.price * line.qty + addons
  })
}

/** Rewards on the new lines: new to this order, each on a new item it can go on, and ready on the card. */
async function checkRewards(order: StoredSale, body: AddItemsBody): Promise<NextResponse | null> {
  const rewards = body.loyaltyRewards ?? []
  if (rewards.length === 0) return null
  if (!order.loyaltyMemberId) return refuse(400, 'This order has no loyalty card.')
  if (rewards.some(r => (order.loyaltyRewards ?? []).includes(r))) return refuse(400, 'This order used that reward already.')
  if (!rewardsFitOrder(body.items, rewards)) return refuse(400, REWARDS_NEED_ITEMS)
  let totals: CardTotals | null
  try {
    // The card's totals already count this order's saved part.
    totals = await fetchCardTotals(order.loyaltyMemberId)
  } catch (error) {
    console.error('Loyalty card could not be checked for items added to an order', { memberId: order.loyaltyMemberId }, error)
    return refuse(503, 'Could not check the loyalty card. Try again.')
  }
  if (!totals) return refuse(409, 'This loyalty card was removed.', { code: LOYALTY_CARD_CHANGED })
  const problem = rewardProblem(totals, stampsIn(body.items), rewards)
  return problem ? refuse(409, problem, { code: LOYALTY_CARD_CHANGED }) : null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requirePosAuth()
  if (authError) return authError

  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return refuse(500, 'Server misconfiguration')
  }

  const { id } = await params
  if (!ID.test(id)) return refuse(400, 'Invalid ID')

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return refuse(400, 'Invalid JSON')
  }
  const body = parseBody(raw)
  if (!body) return refuse(400, 'Invalid sale data')

  const writeClient = getWriteClient()
  let order: StoredSale | undefined
  try {
    order = await writeClient.getDocument<StoredSale>(id)
  } catch (error) {
    console.error('Order could not be read to add items', { id }, error)
    return refuse(500, 'Failed to add the items.')
  }
  if (!order || order._type !== 'sale' || order.isCompleted === true || order._rev !== body.rev) {
    return refuseStale(writeClient, id)
  }
  if (!Array.isArray(order.items) || !isValidAmount(order.total)) return refuse(422, 'This order could not be read.')

  const savedKeys = new Set(order.items.map(i => i._key))
  if (body.items.some(i => savedKeys.has(i.lineId))) return refuse(400, 'These lines are on the order already.')
  if (order.items.length + body.items.length > MAX_ITEMS) {
    return refuse(400, `An order holds up to ${MAX_ITEMS} lines. Start a new order for the rest.`)
  }
  const rows = body.discounts ?? []
  if (!rowsFitTheirLines(body.items, rows)) return refuse(400, 'Invalid sale data')
  if ((order.discounts?.length ?? 0) + rows.length > MAX_DISCOUNTS) return refuse(400, 'This order holds too many discounts to add more.')
  const addedSubtotal = body.items.reduce((sum, i) => sum + i.price * i.qty, 0)
  const addedOff = rows.reduce((sum, d) => sum + d.amount, 0)
  const total = order.total + addedSubtotal - addedOff
  if (!isValidAmount(total)) return refuse(400, `An order can come to at most ₱${MAX_PRICE.toLocaleString('en-PH')}.`)

  const refused = await checkRewards(order, body)
  if (refused) return refused

  const paymentAmount = body.paymentAmount ?? total
  const rewards = body.loyaltyRewards ?? []
  const addedAt = new Date().toISOString()
  // A name sent names or renames the order (empty clears it), but an order on a loyalty card
  // keeps the card holder's name.
  const naming = body.notes !== undefined && !order.loyaltyMemberId
  const name = body.notes?.trim() ?? ''

  try {
    // Both arrays are written whole in one set: a Sanity patch holds a single insert, so two
    // appends would lose the first. The revision check makes the whole write safe, since
    // nothing can have changed the order since it was read.
    let patch = writeClient
      .patch(id)
      .ifRevisionId(body.rev)
      .set({
        items: [...order.items, ...body.items.map(item => toSaleItemDoc(item, addedAt))],
        ...(rows.length > 0 ? { discounts: [...(order.discounts ?? []), ...toSaleDiscountDocs(rows)] } : {}),
        // Before any discount, so worked out from every line, saved and new.
        subtotal: order.items.reduce((sum, i) => sum + i.price * i.qty, 0) + addedSubtotal,
        total,
        paymentAmount,
        change: paymentAmount - total,
        ...(naming && name ? { notes: name } : {}),
        ...(rewards.length > 0 ? { loyaltyRewards: [...(order.loyaltyRewards ?? []), ...rewards] } : {}),
      })
    if (naming && !name) patch = patch.unset(['notes'])
    const updated = await patch.commit()
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    // Sanity refuses the revision when the order changed after it was read here.
    if ((error as { statusCode?: unknown }).statusCode === 409) return refuseStale(writeClient, id)
    console.error('Items could not be added to an order', { id }, error)
    return refuse(500, 'Failed to add the items.')
  }
}
