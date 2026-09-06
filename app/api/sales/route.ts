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
  note?:   string
}

interface SaleDiscountInput {
  lineId: string
  name:   string
  amount: number
}

interface SaleInput {
  total:         number
  paymentAmount: number
  items:         SaleItemInput[]
  subtotal?:     number
  discounts?:    SaleDiscountInput[]
  notes?:        string
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
  if (b.notes !== undefined) {
    const n = b.notes
    if (typeof n !== 'string') return false
    if (n.length > 100) return false
  }
  if (b.subtotal !== undefined) {
    if (typeof b.subtotal !== 'number' || !Number.isFinite(b.subtotal) || b.subtotal < 0 || b.subtotal > MAX_PRICE) return false
  }
  if (b.discounts !== undefined) {
    if (!Array.isArray(b.discounts) || b.discounts.length > 50) return false
    const discountsValid = b.discounts.every((d: unknown) => {
      if (!d || typeof d !== 'object') return false
      const dd = d as Record<string, unknown>
      if (typeof dd.lineId !== 'string' || dd.lineId.length > 100) return false
      if (typeof dd.name !== 'string' || dd.name.length === 0 || dd.name.length > 200) return false
      return typeof dd.amount === 'number' && Number.isFinite(dd.amount) && dd.amount >= 0 && dd.amount <= MAX_PRICE
    })
    if (!discountsValid) return false
  }
  return b.items.every((item: unknown) => {
    if (!item || typeof item !== 'object') return false
    const i = item as Record<string, unknown>
    if (typeof i.lineId !== 'string' || i.lineId.length > 100) return false
    if (typeof i.name !== 'string' || i.name.length === 0 || i.name.length > 200) return false
    if (typeof i.price !== 'number' || !Number.isFinite(i.price) || i.price < 0 || i.price > MAX_PRICE) return false
    if (typeof i.qty !== 'number' || !Number.isFinite(i.qty) || i.qty < 1 || i.qty > MAX_QTY) return false
    if (typeof i.variant === 'string' && i.variant.length > 100) return false
    if (i.note !== undefined && (typeof i.note !== 'string' || i.note.length > 200)) return false
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

  const { total, paymentAmount, items, notes, subtotal, discounts } = body
  const change = paymentAmount - total

  try {
    const writeClient = getWriteClient()
    const doc = await writeClient.create({
      _type: 'sale',
      total,
      paymentAmount,
      change,
      ...(subtotal !== undefined ? { subtotal } : {}),
      ...(notes ? { notes: notes.trim() } : {}),
      ...(discounts && discounts.length > 0 ? {
        discounts: discounts.map((d) => ({
          _type:  'saleDiscount',
          _key:   d.lineId,
          lineId: d.lineId,
          name:   d.name,
          amount: d.amount,
        })),
      } : {}),
      items: items.map((item) => ({
        _type:   'saleItem',
        _key:    item.lineId,
        lineId:  item.lineId,
        name:    item.name,
        variant: item.variant ?? null,
        price:   item.price,
        qty:     item.qty,
        ...(item.note ? { note: item.note } : {}),
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
