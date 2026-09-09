import { variantClass } from '../utils'
import type { SalesSummary } from '../types'
import { EmptyState, Skeleton } from './ui'

interface TopItemsViewProps {
  summary: SalesSummary | null
  loading: boolean
}

/** Best sellers for the period, ranked by quantity, with a bar showing each item's share of the top seller. */
export default function TopItemsView({ summary, loading }: TopItemsViewProps) {
  if (loading) return <Skeleton rows={5} height="h-12" />

  const items = summary?.topItems ?? []
  if (items.length === 0) {
    return <EmptyState title="No sales in this period." hint="Best-selling items will rank here." />
  }
  const maxQty = Math.max(1, ...items.map((item) => item.qtySold))

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-white/80">
      <header className="flex items-baseline justify-between border-b border-border/70 bg-foreground/3 px-4 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60">Top items</h2>
        <span className="text-[10px] uppercase tracking-[0.16em] text-foreground/40">by quantity sold</span>
      </header>
      <ol className="divide-y divide-border/60">
        {items.map((item, i) => (
          <li
            key={`${item.name}-${item.variant ?? 'fixed'}`}
            className="grid grid-cols-[2rem_1fr_auto_6rem] items-center gap-x-4 px-4 py-3 sm:grid-cols-[2rem_1fr_9rem_6rem]"
          >
            <span className="font-display text-sm font-bold tabular-nums text-foreground/30">{String(i + 1).padStart(2, '0')}</span>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
              {item.variant && (
                <span className={`text-[10px] font-bold uppercase tracking-wider ${variantClass(item.variant)}`}>{item.variant}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-foreground/10 sm:block" aria-hidden="true">
                <div className="h-full rounded-full bg-foreground/60" style={{ width: `${(item.qtySold / maxQty) * 100}%` }} />
              </div>
              <span className="w-8 text-right text-xs tabular-nums text-foreground/60">×{item.qtySold}</span>
            </div>
            <span className="text-right text-sm font-semibold tabular-nums text-foreground">₱{item.revenue.toLocaleString()}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
