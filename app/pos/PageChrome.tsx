import type { ReactNode } from 'react'

interface PageHeaderProps {
  /** The page's wordmark, such as "unwnd. time clock". */
  title: string
  /** A small line beside it on wider screens, such as today's date. */
  note?: string
  /** Controls placed before ← POS, such as the Manager page's Lock. */
  children?: ReactNode
}

// The header of the pages the POS header opens (Time clock, Manager), the same as Sales: the
// wordmark, and ← POS back to the till with a full page load.
export function PageHeader({ title, note, children }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 bg-foreground px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="font-logo text-xl sm:text-2xl whitespace-nowrap lowercase tracking-tight text-cream">{title}</span>
        {note && <span className="hidden text-[10px] uppercase tracking-[0.25em] text-cream/40 sm:inline" suppressHydrationWarning>{note}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {children}
        <a href="/pos" className="text-xs uppercase tracking-[0.2em] text-cream/50 transition-colors hover:text-cream">
          ← POS
        </a>
      </div>
    </header>
  )
}

export interface PageTab<T extends string> {
  key: T
  label: ReactNode
}

interface PageTabsProps<T extends string> {
  /** What the tabs switch between, for screen readers. */
  label: string
  tabs: readonly PageTab<T>[]
  value: T
  onChange: (key: T) => void
}

/** A row of tabs styled like Sales' views: the picked one dark green. */
export function PageTabs<T extends string>({ label, tabs, value, onChange }: PageTabsProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg bg-foreground/6 p-1">
      {tabs.map(tab => (
        <button
          key={tab.key}
          type="button"
          aria-pressed={value === tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
            value === tab.key ? 'bg-foreground text-cream shadow-sm' : 'text-foreground/55 hover:bg-white/70 hover:text-foreground'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
