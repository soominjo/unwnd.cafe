export type View = 'recent' | 'completed' | 'summary'

interface ViewTabsProps {
  view: View
  onChange: (view: View) => void
  pendingCount: number
  completedCount: number
  loading: boolean
}

const TABS: ReadonlyArray<{ key: View; label: string }> = [
  { key: 'recent', label: 'Recent Orders' },
  { key: 'completed', label: 'Completed' },
  { key: 'summary', label: 'Top Items' },
]

export default function ViewTabs({ view, onChange, pendingCount, completedCount, loading }: ViewTabsProps) {
  return (
    <nav className="flex justify-center gap-8 border-b border-foreground/15" aria-label="Views">
      {TABS.map(({ key, label }) => {
        const active = view === key
        const count = key === 'recent' ? pendingCount : key === 'completed' ? completedCount : 0
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px flex items-center gap-2 border-b-[3px] pb-3 text-xs font-extrabold uppercase tracking-[0.16em] transition-colors ${
              active ? 'border-foreground text-foreground' : 'border-transparent text-foreground/50 hover:text-foreground/80'
            }`}
          >
            {label}
            {!loading && count > 0 && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] tabular-nums ${
                  key === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-foreground/10 text-foreground/60'
                }`}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
