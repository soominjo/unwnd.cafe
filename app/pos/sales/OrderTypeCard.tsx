import type { OrderTypeCounts } from '@/lib/sales/paymentTally'
import { BagIcon, CupIcon } from './icons'

/** Dine in and Take out for the period, beside How they paid on the Tally tab. */
export default function OrderTypeCard({ counts }: { counts: OrderTypeCounts }) {
  const asked = counts.dineIn + counts.takeOut
  const share = asked > 0 ? Math.round((counts.takeOut / asked) * 100) : 0
  const rows = [
    { label: 'Dine in', count: counts.dineIn, icon: <CupIcon width={18} height={18} />, tone: 'bg-foreground/8 text-foreground' },
    { label: 'Take out', count: counts.takeOut, icon: <BagIcon width={18} height={18} />, tone: 'bg-foreground text-cream' },
  ]
  return (
    <section aria-labelledby="order-type-title" className="space-y-2 rounded-lg border border-border bg-white/80 p-4 sm:p-5">
      <h2 id="order-type-title" className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60">Dine in · Take out</h2>
      {rows.map(row => (
        <div key={row.label} className="grid min-h-11 grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3">
          <span className={`grid h-9 w-9 place-items-center rounded-lg ${row.tone}`}>{row.icon}</span>
          <span className="text-sm text-foreground">{row.label}</span>
          <span className="font-display text-xl font-bold text-foreground">{row.count}</span>
        </div>
      ))}
      {counts.notRecorded > 0 && (
        <p className="text-xs text-foreground/55">Not recorded: {counts.notRecorded} {counts.notRecorded === 1 ? 'order' : 'orders'} from before it was asked.</p>
      )}
      {asked > 0 && <p className="text-xs text-foreground/55">{share}% of orders were take out.</p>}
    </section>
  )
}
