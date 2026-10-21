import { NextRequest, NextResponse } from 'next/server'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { client } from '@/sanity/lib/client'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { toSaleDiscountDocs } from '@/lib/sales/toSaleDiscountDocs'
import {
  MAX_ITEMS,
  isValidAmount,
  isValidDiscountRows,
  isValidNotes,
  isValidSaleItem,
  toSaleItemDoc,
  type SaleDiscountInput,
  type SaleItemInput,
} from '@/lib/sales/validateSaleInput'
import { LOYALTY_CARD_CHANGED, parseSaleLoyalty, rewardProblem, rewardsFitOrder, stampsIn, type CardTotals, type SaleLoyalty } from '@/lib/loyalty'
import { fetchCardTotals } from '@/lib/loyaltyStore'
import { rewardsRefusal } from '@/lib/sales/rewardsRefusal'
import { PAYMENTS_DONT_ADD_UP, handedTotal, isOrderType, parsePayments, toSalePaymentDocs } from '@/lib/sales/payments'

export const dynamic = 'force-dynamic'

const fresh = client.withConfig({ useCdn: false })

interface SaleInput {
  total:         number
  paymentAmount: number
  items:         SaleItemInput[]
  subtotal?:     number
  discounts?:    SaleDiscountInput[]
  notes?:        string
  /** Checked by parseSaleLoyalty, not by isValidSaleInput. */
  loyaltyMemberId?: unknown
  loyaltyRewards?:  unknown
  /** Dine in or take out, and how it was paid: absent from a POS older than them, which saves as before. */
  orderType?: unknown
  payments?:  unknown
}

function isValidIso(s: string): boolean {
  return !isNaN(Date.parse(s))
}

function isValidSaleInput(body: unknown): body is SaleInput {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  if (!isValidAmount(b.total) || !isValidAmount(b.paymentAmount)) return false
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > MAX_ITEMS) return false
  if (b.notes !== undefined && !isValidNotes(b.notes)) return false
  if (b.subtotal !== undefined && !isValidAmount(b.subtotal)) return false
  if (b.discounts !== undefined && !isValidDiscountRows(b.discounts)) return false
  return b.items.every(isValidSaleItem)
}

/**
 * A linked card must still exist, and any reward used must really be ready, so two devices
 * can't spend the same reward. This order's stamps count straight away. Null when the sale
 * can be saved; otherwise the reply. A card that changed carries LOYALTY_CARD_CHANGED, so
 * the POS reads the cards again and keeps the order on screen.
 */
async function checkSaleLoyalty(loyalty: SaleLoyalty, items: SaleItemInput[]): Promise<NextResponse | null> {
  // Each reward goes on its own unit: the free drink on a classic drink, the 10% on another
  // classic drink (espresso or non-coffee tab), waffle or snack item.
  if (!rewardsFitOrder(items, loyalty.rewards)) {
    return NextResponse.json({ success: false, error: await rewardsRefusal() }, { status: 400 })
  }
  let totals: CardTotals | null
  try {
    totals = await fetchCardTotals(loyalty.memberId)
  } catch (error) {
    console.error('Loyalty card could not be checked for a sale', { memberId: loyalty.memberId }, error)
    return NextResponse.json(
      { success: false, error: 'Could not check the loyalty card. Try again, or unlink it to charge without stamps.' },
      { status: 503 },
    )
  }
  if (!totals) {
    return NextResponse.json({ success: false, code: LOYALTY_CARD_CHANGED, error: 'This loyalty card was removed.' }, { status: 409 })
  }
  const problem = rewardProblem(totals, stampsIn(items), loyalty.rewards)
  return problem ? NextResponse.json({ success: false, code: LOYALTY_CARD_CHANGED, error: problem }, { status: 409 }) : null
}

export async function POST(request: NextRequest) {
  const authError = await requirePosAuth()
  if (authError) return authError

  if (!process.env.SANITY_API_WRITE_TOKEN) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!isValidSaleInput(body)) {
    return NextResponse.json({ success: false, error: 'Invalid sale data' }, { status: 400 })
  }

  const loyalty = parseSaleLoyalty(body)
  if (loyalty === 'invalid') {
    return NextResponse.json({ success: false, error: 'Invalid sale data' }, { status: 400 })
  }

  const { total, items, notes, subtotal, discounts, orderType } = body
  if (orderType !== undefined && !isOrderType(orderType)) {
    return NextResponse.json({ success: false, error: 'Invalid sale data' }, { status: 400 })
  }
  // The payments must cover the total exactly; what was handed over then comes from them, not
  // from the paymentAmount sent.
  const payments = body.payments === undefined ? null : parsePayments(body.payments, total)
  if (body.payments !== undefined && !payments) {
    return NextResponse.json({ success: false, error: PAYMENTS_DONT_ADD_UP }, { status: 400 })
  }
  const paymentAmount = payments ? handedTotal(payments, total) : body.paymentAmount
  const change = paymentAmount - total

  if (loyalty) {
    const refused = await checkSaleLoyalty(loyalty, items)
    if (refused) return refused
  }

  try {
    const writeClient = getWriteClient()
    const doc = await writeClient.create({
      _type: 'sale',
      total,
      paymentAmount,
      change,
      ...(subtotal !== undefined ? { subtotal } : {}),
      ...(notes ? { notes: notes.trim() } : {}),
      ...(discounts && discounts.length > 0 ? { discounts: toSaleDiscountDocs(discounts) } : {}),
      ...(loyalty ? { loyaltyMemberId: loyalty.memberId, loyaltyRewards: loyalty.rewards } : {}),
      ...(orderType ? { orderType } : {}),
      ...(payments ? { payments: toSalePaymentDocs(payments) } : {}),
      items: items.map(item => toSaleItemDoc(item)),
    })
    return NextResponse.json({ success: true, id: doc._id })
  } catch (error) {
    console.error('Sale could not be saved', error)
    return NextResponse.json({ success: false, error: 'Failed to save sale.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const authError = await requirePosAuth()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const from       = searchParams.get('from') ?? new Date(0).toISOString()
  const to         = searchParams.get('to')   ?? new Date().toISOString()
  const statusRaw  = searchParams.get('status')
  const pageRaw    = parseInt(searchParams.get('page') ?? '1', 10)
  const page       = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
  const limitRaw   = parseInt(searchParams.get('limit') ?? '20', 10)
  const limit      = isNaN(limitRaw) ? 20 : Math.min(limitRaw, 100)
  const offset     = (page - 1) * limit

  if (!isValidIso(from) || !isValidIso(to)) {
    return NextResponse.json({ success: false, error: 'Invalid date range' }, { status: 400 })
  }
  if (statusRaw !== null && statusRaw !== 'pending' && statusRaw !== 'completed') {
    return NextResponse.json({ success: false, error: 'Invalid status filter' }, { status: 400 })
  }
  // Whole-period pagination/counts per completion status, not just the current page —
  // the Recent/Completed tabs would otherwise only ever reflect the newest 20 sales overall.
  const statusFilter =
    statusRaw === 'completed' ? ' && isCompleted == true' : statusRaw === 'pending' ? ' && isCompleted != true' : ''

  try {
    const [sales, total] = await Promise.all([
      fresh.fetch(
        `*[_type == "sale" && _createdAt >= $from && _createdAt <= $to${statusFilter}] | order(_createdAt desc)[$offset..$end]`,
        { from, to, offset, end: offset + limit - 1 },
        { cache: 'no-store' }
      ),
      fresh.fetch(
        `count(*[_type == "sale" && _createdAt >= $from && _createdAt <= $to${statusFilter}])`,
        { from, to },
        { cache: 'no-store' }
      ),
    ])
    return NextResponse.json({ success: true, data: sales, total, page, limit })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch sales.' }, { status: 500 })
  }
}
