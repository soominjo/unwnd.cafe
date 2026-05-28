import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/sanity/lib/client'
import { requirePosAuth } from '@/lib/requirePosAuth'

export const dynamic = 'force-dynamic'

const fresh = client.withConfig({ useCdn: false })

interface SaleItemRecord {
  name:    string
  variant: string | null
  price:   number
  qty:     number
}

interface SaleRecord {
  _id:           string
  _createdAt:    string
  total:         number
  paymentAmount: number
  change:        number
  items:         SaleItemRecord[]
}

interface TopItem {
  name:    string
  variant: string | null
  qtySold: number
  revenue: number
}

function isValidIso(s: string): boolean {
  return !isNaN(Date.parse(s))
}

export async function GET(request: NextRequest) {
  const authError = await requirePosAuth()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') ?? new Date(0).toISOString()
  const to   = searchParams.get('to')   ?? new Date().toISOString()

  if (!isValidIso(from) || !isValidIso(to)) {
    return NextResponse.json({ success: false, error: 'Invalid date range' }, { status: 400 })
  }

  try {
    const sales: SaleRecord[] = await fresh.fetch(
      `*[_type == "sale" && _createdAt >= $from && _createdAt <= $to]{
        _id, _createdAt, total, paymentAmount, change,
        items[]{ name, variant, price, qty }
      }`,
      { from, to },
      { cache: 'no-store' }
    )

    const orderCount    = sales.length
    const totalRevenue  = sales.reduce((sum, s) => sum + s.total, 0)
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0

    const itemMap = new Map<string, TopItem>()
    for (const sale of sales) {
      for (const item of sale.items ?? []) {
        const key      = `${item.name}__${item.variant ?? 'fixed'}`
        const existing = itemMap.get(key)
        if (existing) {
          itemMap.set(key, {
            ...existing,
            qtySold: existing.qtySold + item.qty,
            revenue: existing.revenue + item.price * item.qty,
          })
        } else {
          itemMap.set(key, {
            name:    item.name,
            variant: item.variant ?? null,
            qtySold: item.qty,
            revenue: item.price * item.qty,
          })
        }
      }
    }

    const topItems = [...itemMap.values()]
      .sort((a, b) => b.qtySold - a.qtySold)
      .slice(0, 10)

    return NextResponse.json({
      success: true,
      data: { totalRevenue, orderCount, avgOrderValue, topItems },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch summary.' }, { status: 500 })
  }
}
