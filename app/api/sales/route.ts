import { NextRequest, NextResponse } from 'next/server'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { client } from '@/sanity/lib/client'
import { requirePosAuth } from '@/lib/requirePosAuth'

export const dynamic = 'force-dynamic'

const fresh = client.withConfig({ useCdn: false })

interface SaleItemInput {
  lineId:  string
  name:    string
  variant: string | null
  price:   number
  qty:     number
}

interface SaleInput {
  total:         number
  paymentAmount: number
  items:         SaleItemInput[]
}

function isValidIso(s: string): boolean {
  return !isNaN(Date.parse(s))
}

const MAX_PRICE = 1_000_000
const MAX_QTY   = 1_000

function isValidSaleInput(body: unknown): body is SaleInput {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  if (typeof b.total !== 'number' || !Number.isFinite(b.total) || b.total < 0 || b.total > MAX_PRICE) return false
  if (typeof b.paymentAmount !== 'number' || !Number.isFinite(b.paymentAmount) || b.paymentAmount < 0 || b.paymentAmount > MAX_PRICE) return false
  if (!Array.isArray(b.items) || b.items.length === 0 || b.items.length > 50) return false
  return b.items.every((item: unknown) => {
    if (!item || typeof item !== 'object') return false
    const i = item as Record<string, unknown>
    if (typeof i.lineId !== 'string' || i.lineId.length > 100) return false
    if (typeof i.name !== 'string' || i.name.length === 0 || i.name.length > 200) return false
    if (typeof i.price !== 'number' || !Number.isFinite(i.price) || i.price < 0 || i.price > MAX_PRICE) return false
    if (typeof i.qty !== 'number' || !Number.isFinite(i.qty) || i.qty < 1 || i.qty > MAX_QTY) return false
    if (typeof i.variant === 'string' && i.variant.length > 100) return false
    return (typeof i.variant === 'string' || i.variant === null)
  })
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

  const { total, paymentAmount, items } = body
  const change = paymentAmount - total

  try {
    const writeClient = getWriteClient()
    const doc = await writeClient.create({
      _type: 'sale',
      total,
      paymentAmount,
      change,
      items: items.map((item) => ({
        _type:   'saleItem',
        _key:    item.lineId,
        lineId:  item.lineId,
        name:    item.name,
        variant: item.variant ?? null,
        price:   item.price,
        qty:     item.qty,
      })),
    })
    return NextResponse.json({ success: true, id: doc._id })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to save sale.' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const authError = await requirePosAuth()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const from     = searchParams.get('from') ?? new Date(0).toISOString()
  const to       = searchParams.get('to')   ?? new Date().toISOString()
  const pageRaw  = parseInt(searchParams.get('page') ?? '1', 10)
  const page     = isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
  const limitRaw = parseInt(searchParams.get('limit') ?? '20', 10)
  const limit    = isNaN(limitRaw) ? 20 : Math.min(limitRaw, 100)
  const offset   = (page - 1) * limit

  if (!isValidIso(from) || !isValidIso(to)) {
    return NextResponse.json({ success: false, error: 'Invalid date range' }, { status: 400 })
  }

  try {
    const [sales, total] = await Promise.all([
      fresh.fetch(
        `*[_type == "sale" && _createdAt >= $from && _createdAt <= $to] | order(_createdAt desc)[$offset..$end]`,
        { from, to, offset, end: offset + limit - 1 },
        { cache: 'no-store' }
      ),
      fresh.fetch(
        `count(*[_type == "sale" && _createdAt >= $from && _createdAt <= $to])`,
        { from, to },
        { cache: 'no-store' }
      ),
    ])
    return NextResponse.json({ success: true, data: sales, total, page, limit })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch sales.' }, { status: 500 })
  }
}
