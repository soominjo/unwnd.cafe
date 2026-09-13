export type View = 'recent' | 'completed' | 'summary'
export type SummaryTab = 'items' | 'names'

interface ViewTabsProps {
  view: View
  onChange: (view: View) => void
  pendingCount: number
  completedCount: number
  loading: boolean
  /** False for Week/Month/Year/a long Custom range — too much to page through order-by-order. */
  detailed: boolean
  /** Which of Top Items / Top Names shows when `!detailed`. Ignored otherwise. */
  summaryTab: SummaryTab
  onSummaryTabChange: (tab: SummaryTab) => void
}

const TABS: ReadonlyArray<{ key: View; label: string }> = [
  { key: 'recent', label: 'Recent Orders' },
  { key: 'completed', label: 'Completed' },
  { key: 'summary', label: 'Top Items' },
]

const SUMMARY_TABS: ReadonlyArray<{ key: SummaryTab; label: string }> = [
  { key: 'items', label: 'Top Items' },
  { key: 'names', label: 'Top Names' },
]

const TAB_BUTTON =
  'flex items-center gap-2 rounded-md px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors'
const TAB_BUTTON_ACTIVE = 'bg-foreground text-cream shadow-sm'
const TAB_BUTTON_INACTIVE = 'text-foreground/55 hover:bg-white/70 hover:text-foreground'

export default function ViewTabs({
  view,
  onChange,
  pendingCount,
  completedCount,
  loading,
  detailed,
  summaryTab,
  onSummaryTabChange,
}: ViewTabsProps) {
  if (!detailed) {
    return (
      <div className="flex flex-col items-center gap-2">
        {!loading && (
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/50">
            <span>{pendingCount} pending</span>
            <span aria-hidden="true">·</span>
            <span>{completedCount} completed</span>
          </div>
        )}
        <nav aria-label="Summary view" className="flex justify-center">
          <div role="group" className="inline-flex flex-wrap justify-center gap-1 rounded-lg bg-foreground/6 p-1">
            {SUMMARY_TABS.map(({ key, label }) => {
              const active = summaryTab === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSummaryTabChange(key)}
                  aria-pressed={active}
                  className={`${TAB_BUTTON} ${active ? TAB_BUTTON_ACTIVE : TAB_BUTTON_INACTIVE}`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    )
  }

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
              className={`${TAB_BUTTON} ${active ? TAB_BUTTON_ACTIVE : TAB_BUTTON_INACTIVE}`}
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
