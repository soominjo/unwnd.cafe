import { PERIOD_LABELS, TIMECLOCK_PERIODS, formatDay, periodRange, type TimeclockPeriod } from '@/lib/timeclock/time'

interface PeriodChipsProps {
  value: TimeclockPeriod
  /** Today, for the dates under the chips. */
  now: number
  onChange: (period: TimeclockPeriod) => void
}

// This week · Last week · This month · Last month, the picked one dark green, with the period's
// dates under them. My records and the Manager page's Hours both show it.
export default function PeriodChips({ value, now, onChange }: PeriodChipsProps) {
  const range = periodRange(value, now)
  return (
    <>
      <div role="group" aria-label="Period" className="flex flex-wrap gap-1.5">
        {TIMECLOCK_PERIODS.map(key => (
          <button
            key={key}
            type="button"
            aria-pressed={value === key}
            onClick={() => onChange(key)}
            className={`h-9 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
              value === key ? 'border-foreground bg-foreground text-cream' : 'border-foreground/20 bg-white text-foreground/65 hover:text-foreground'
            }`}
          >
            {PERIOD_LABELS[key]}
          </button>
        ))}
      </div>
      <p className="-mt-2 text-xs text-foreground/45">{`${formatDay(range.from)} – ${formatDay(Date.parse(range.to) - 1)}`}</p>
    </>
  )
}
