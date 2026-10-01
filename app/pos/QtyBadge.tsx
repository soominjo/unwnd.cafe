interface QtyBadgeProps {
  qty: number
  className?: string
}

// The amber "×N" quantity mark — how many of an item to make, readable at a
// glance. The review screen shows it beside an item ordered more than once;
// Sales history shows it on every line, ×1 included.
export default function QtyBadge({ qty, className = '' }: QtyBadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-amber-400 text-foreground text-sm font-black tabular-nums tracking-wide shadow-sm ${className}`}
    >
      ×{qty}
    </span>
  )
}
