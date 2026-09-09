import type { SalesSummary } from '../types'

interface KpiStripProps {
  summary: SalesSummary | null
  loading: boolean
}

/** Revenue, order count and average ticket for the selected period — always in view, whatever tab is open. */
export default function KpiStrip({ summary, loading }: KpiStripProps) {
  const tiles = [
    { label: 'Revenue', value: `₱${(summary?.totalRevenue ?? 0).toLocaleString()}` },
    { label: 'Orders', value: String(summary?.orderCount ?? 0) },
    { label: 'Avg. order', value: `₱${Math.round(summary?.avgOrderValue ?? 0).toLocaleString()}` },
  ]

  return (
    <section className="grid grid-cols-3 gap-3" aria-label="Period summary">
      {tiles.map(({ label, value }) => (
        <div key={label} className="rounded-lg border border-border bg-white/70 px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">{label}</p>
          {loading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-foreground/10" aria-hidden="true" />
          ) : (
            <p className="mt-1 font-display text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl">{value}</p>
          )}
        </div>
      ))}
    </section>
  )
}
