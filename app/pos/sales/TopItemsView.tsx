'use client'

import { useState } from 'react'
import { variantClass } from '../utils'
import type { SalesSummary } from '../types'
import { EmptyState, Skeleton } from './ui'

interface TopItemsViewProps {
  summary: SalesSummary | null
  loading: boolean
}

/** How many ranked rows to show once a category is applied. */
const MAX_DISPLAYED = 20

/** Best sellers for the period, ranked by quantity, with a bar showing each item's share of the top seller. */
export default function TopItemsView({ summary, loading }: TopItemsViewProps) {
  const [categoryId, setCategoryId] = useState<string | 'all'>('all')

  if (loading) return <Skeleton rows={5} height="h-12" />

  const allItems = summary?.topItems ?? []
  const categories = summary?.topItemCategories ?? []
  const items = (categoryId === 'all' ? allItems : allItems.filter((item) => item.categoryId === categoryId)).slice(0, MAX_DISPLAYED)
  const maxQty = Math.max(1, ...items.map((item) => item.qtySold))

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-white/80">
      <header className="flex items-baseline justify-between border-b border-border/70 bg-foreground/3 px-4 py-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60">Top items</h2>
        <span className="text-[10px] uppercase tracking-[0.16em] text-foreground/40">by quantity sold</span>
      </header>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-border/70 px-4 py-2.5">
          <CategoryChip active={categoryId === 'all'} onClick={() => setCategoryId('all')}>
            All
          </CategoryChip>
          {categories.map((c) => (
            <CategoryChip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
              {c.label}
            </CategoryChip>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="px-4 py-8">
          <EmptyState title="No sales in this period." hint="Best-selling items will rank here." />
        </div>
      ) : (
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
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${variantClass(item.variant)}`}>
                    {item.variant}
                  </span>
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
      )}
    </section>
  )
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-colors ${
        active ? 'bg-foreground text-cream' : 'bg-foreground/6 text-foreground/55 hover:bg-foreground/10 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}
