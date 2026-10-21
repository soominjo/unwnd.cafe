'use client'

import type { SanityMenuItem } from '@/types/sanity'
import { tempNote, type Temp } from './menuView'

interface TempToggleProps {
  item: SanityMenuItem
  temp: Temp | null
  onTemp: (temp: Temp) => void
  /** The item sheet's bigger version. */
  large?: boolean
}

const TEMPS: readonly Temp[] = ['Hot', 'Iced']

// Hot/Iced for a drink that comes both ways, "Iced only"/"Hot only" for one that doesn't,
// nothing for food.
export default function TempToggle({ item, temp, onTemp, large = false }: TempToggleProps) {
  if (item.drinkType === 'both') {
    return (
      <div role="group" aria-label="Hot or iced" className="inline-flex self-start rounded-full border border-hair-2 p-0.5">
        {TEMPS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={temp === t}
            onClick={() => onTemp(t)}
            className={`rounded-full tracking-[0.03em] transition-colors ${
              large ? 'min-h-10 px-5.5 text-[13.5px]' : 'min-h-7 px-3 text-xs'
            } ${temp === t ? 'bg-foreground text-cream' : 'text-ink-2 hover:text-foreground'}`}
          >
            {t}
          </button>
        ))}
      </div>
    )
  }

  const note = tempNote(item)
  if (!note) return null
  return (
    <span className="inline-flex min-h-8.5 items-center self-start text-xs tracking-[0.03em] text-ink-2">{note}</span>
  )
}
