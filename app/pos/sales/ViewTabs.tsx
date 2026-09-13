export type View = 'recent' | 'completed' | 'summary' | 'names'

interface ViewTabsProps {
  view: View
  onChange: (view: View) => void
  pendingCount: number
  completedCount: number
  loading: boolean
  /** False for Week/Month/Year/a long Custom range — Recent/Completed aren't shown at all then. */
  detailed: boolean
}

const ALL_TABS: ReadonlyArray<{ key: View; label: string }> = [
  { key: 'recent', label: 'Recent Orders' },
  { key: 'completed', label: 'Completed' },
  { key: 'summary', label: 'Top Items' },
  { key: 'names', label: 'Top Names' },
]

/** Week/Month/Year/a long custom range skip the order lists — only the two leaderboards apply. */
const SUMMARY_ONLY_TABS: ReadonlyArray<{ key: View; label: string }> = ALL_TABS.filter(
  (tab) => tab.key === 'summary' || tab.key === 'names',
)

export default function ViewTabs({ view, onChange, pendingCount, completedCount, loading, detailed }: ViewTabsProps) {
  const tabs = detailed ? ALL_TABS : SUMMARY_ONLY_TABS
  return (
    <div className="flex flex-col items-center gap-2">
      {!detailed && !loading && (
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/50">
          <span>{pendingCount} pending</span>
          <span aria-hidden="true">·</span>
          <span>{completedCount} completed</span>
        </div>
      )}
      <nav aria-label="Views" className="flex justify-center">
        <div role="group" className="inline-flex flex-wrap justify-center gap-1 rounded-lg bg-foreground/6 p-1">
          {tabs.map(({ key, label }) => {
            const active = view === key
            const count = key === 'recent' ? pendingCount : key === 'completed' ? completedCount : 0
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key)}
                aria-pressed={active}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
                  active ? 'bg-foreground text-cream shadow-sm' : 'text-foreground/55 hover:bg-white/70 hover:text-foreground'
                }`}
              >
                {label}
                {detailed && !loading && count > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] tabular-nums ${
                      active
                        ? 'bg-cream/25 text-cream'
                        : key === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-foreground/10 text-foreground/60'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
