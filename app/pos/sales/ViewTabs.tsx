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
    <nav aria-label="Views" className="flex justify-center">
      <div role="group" className="inline-flex flex-wrap justify-center gap-1 rounded-lg bg-foreground/6 p-1">
        {TABS.map(({ key, label }) => {
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
              {!loading && count > 0 && (
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
  )
}
