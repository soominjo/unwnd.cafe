import { PERIOD_OPTIONS, todayPH, type Period } from './dateRange'

export interface PeriodUpdates {
  period?: Period
  customFrom?: string
  customTo?: string
}

interface PeriodFilterProps {
  period: Period
  customFrom: string
  customTo: string
  onChange: (updates: PeriodUpdates) => void
}

/** Segmented period picker; the custom range reveals two date fields beneath it. */
export default function PeriodFilter({ period, customFrom, customTo, onChange }: PeriodFilterProps) {
  const maxDate = todayPH()
  const incomplete = period === 'custom' && (!customFrom || !customTo)

  return (
    <section className="space-y-3">
      <div role="group" aria-label="Period" className="inline-flex flex-wrap gap-1 rounded-lg bg-foreground/6 p-1">
        {PERIOD_OPTIONS.map(({ key, label }) => {
          const active = period === key
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ period: key })}
              className={`rounded-md px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
                active ? 'bg-foreground text-cream shadow-sm' : 'text-foreground/55 hover:bg-white/70 hover:text-foreground'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {period === 'custom' && (
        <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-white/60 px-4 py-3">
          <DateField
            label="From"
            value={customFrom}
            max={customTo || maxDate}
            onChange={(value) => onChange({ period: 'custom', customFrom: value })}
          />
          <DateField
            label="To"
            value={customTo}
            min={customFrom || undefined}
            max={maxDate}
            onChange={(value) => onChange({ period: 'custom', customTo: value })}
          />
          {incomplete && <p className="pb-2.5 text-xs text-foreground/45">Pick both dates to load results.</p>}
        </div>
      )}
    </section>
  )
}

interface DateFieldProps {
  label: string
  value: string
  min?: string
  max?: string
  onChange: (value: string) => void
}

function DateField({ label, value, min, max, onChange }: DateFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/50">
      {label}
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-foreground/20 bg-white px-3 text-sm font-medium normal-case tracking-normal text-foreground focus:border-foreground/50 focus:outline-none"
      />
    </label>
  )
}
