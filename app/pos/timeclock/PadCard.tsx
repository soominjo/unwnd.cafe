import type { ReactNode } from 'react'

interface PadCardProps {
  /** The small capitals line at the top, such as "Enter your PIN". */
  title: string
  /** One plain line under it. */
  note?: string
  /** A quiet line under the keys. */
  hint?: string
  /** The PinPad. */
  children: ReactNode
}

// The POS's dark PIN panel, as on the login screen, holding a PinPad on the Time clock page.
export default function PadCard({ title, note, hint, children }: PadCardProps) {
  return (
    <section aria-label={title} className="w-full max-w-sm rounded-sm bg-foreground px-6 pb-7 pt-5 text-cream shadow-xl">
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-cream/60">{title}</p>
      {note && <p className="mt-1.5 text-center text-xs text-cream/55">{note}</p>}
      <div className="mt-6">{children}</div>
      {hint && <p className="mt-5 text-center text-xs text-cream/45">{hint}</p>}
    </section>
  )
}
