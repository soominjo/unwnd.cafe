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
  isCompleted?:  boolean
  notes?:        string
}

interface TopItem {
  name:    string
  variant: string | null
  qtySold: number
  revenue: number
}

interface TopCustomer {
  name:        string
  orderCount:  number
  totalSpent:  number
}

/** How many entries each leaderboard shows. */
const LEADERBOARD_SIZE = 20

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
        _id, _createdAt, total, paymentAmount, change, isCompleted, notes,
        items[]{ name, variant, price, qty }
      }`,
      { from, to },
      { cache: 'no-store' }
    )

    const orderCount     = sales.length
    const totalRevenue   = sales.reduce((sum, s) => sum + s.total, 0)
    const avgOrderValue  = orderCount > 0 ? totalRevenue / orderCount : 0
    const completedCount = sales.filter((s) => s.isCompleted === true).length
    const pendingCount   = orderCount - completedCount

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
      .slice(0, LEADERBOARD_SIZE)

    // Only sales with a customer name (stored as the sale's notes) can be attributed —
    // "No name" orders are excluded rather than lumped together as one "customer".
    const customerMap = new Map<string, TopCustomer>()
    for (const sale of sales) {
      const name = sale.notes?.trim()
      if (!name) continue
      const existing = customerMap.get(name)
      if (existing) {
        customerMap.set(name, {
          ...existing,
          orderCount: existing.orderCount + 1,
          totalSpent: existing.totalSpent + sale.total,
        })
      } else {
        customerMap.set(name, { name, orderCount: 1, totalSpent: sale.total })
      }
    }

    const topCustomers = [...customerMap.values()]
      .sort((a, b) => b.orderCount - a.orderCount || b.totalSpent - a.totalSpent)
      .slice(0, LEADERBOARD_SIZE)

    return NextResponse.json({
      success: true,
      data: { totalRevenue, orderCount, avgOrderValue, topItems, topCustomers, pendingCount, completedCount },
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch summary.' }, { status: 500 })
  }
}
