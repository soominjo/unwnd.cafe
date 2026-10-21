interface StarsProps {
  /** How many stars to light, rounded to the nearest whole star (0–5). */
  filled: number
  /** Read out instead of the stars, e.g. "4 out of 5 stars". Without one the stars are decorative. */
  label?: string
  className?: string
}

// Five stars: the lit ones in the text colour, the rest faded.
export default function Stars({ filled, label, className }: StarsProps) {
  const lit = Math.min(5, Math.max(0, Math.round(filled)))
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  return (
    <span {...a11y} className={className}>
      <span>{'★'.repeat(lit)}</span>
      {lit < 5 && <span className="opacity-25">{'★'.repeat(5 - lit)}</span>}
    </span>
  )
}
