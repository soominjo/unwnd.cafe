'use client'

import Image from 'next/image'
import type { SanityMenuItem } from '@/types/sanity'
import { CARD_PHOTO_RATIO, photoLoader, photoSrc } from './menuPhoto'
import { formatPeso, priceFor, type Temp } from './menuView'
import TempToggle from './TempToggle'

export interface MenuCardProps {
  item: SanityMenuItem
  /** The card's category shows photos: this card gets a photo, or a placeholder tile until it has one. */
  withPhoto: boolean
  temp: Temp | null
  /** Just added to the tray: the + shows a tick for a moment. */
  justAdded: boolean
  onTemp: (temp: Temp) => void
  onAdd: () => void
  /** Opens the item sheet. */
  onOpen: () => void
  /** In the first row on screen: load the photo up front, as it's the biggest thing in view. */
  preload?: boolean
}

// One menu item: the whole tall drink photo on top in a category with photos, a plain paper
// card otherwise.
export default function MenuCard({ item, withPhoto, temp, justAdded, onTemp, onAdd, onOpen, preload = false }: MenuCardProps) {
  return (
    <article className="group flex min-w-0 flex-col">
      {withPhoto && (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`See ${item.name}`}
          className="relative block aspect-9/16 w-full overflow-hidden rounded-[10px] bg-photo"
        >
          {item.image ? (
            <Image
              src={photoSrc(item.image, CARD_PHOTO_RATIO)}
              loader={photoLoader(item.image, CARD_PHOTO_RATIO)}
              alt=""
              fill
              preload={preload}
              sizes="(min-width: 1024px) 280px, (min-width: 640px) 30vw, 45vw"
              placeholder={item.lqip ? 'blur' : 'empty'}
              blurDataURL={item.lqip}
              className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.04]"
            />
          ) : (
            // In Cormorant like the rest of /menu: the brand display font would cost the page 76 KB.
            <span aria-hidden="true" className="absolute inset-0 grid place-items-center font-serif text-[1.75rem] text-foreground/20">
              unwnd.
            </span>
          )}
        </button>
      )}

      <div
        className={`flex min-w-0 flex-1 flex-col gap-1.5 ${
          withPhoto ? 'pt-2.75' : 'rounded-xl border border-hair bg-paper p-3.5'
        }`}
      >
        <h3 className="text-[15px] font-medium leading-tight">
          <button type="button" onClick={onOpen} className="block w-full text-left wrap-break-word hover:opacity-70">
            {item.name}
          </button>
        </h3>
        {item.description && (
          <p className="line-clamp-2 text-[12.5px] font-light leading-[1.4] text-ink-2">{item.description}</p>
        )}

        <div className="mt-auto flex flex-col gap-2.5 pt-1">
          <TempToggle item={item} temp={temp} onTemp={onTemp} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-base font-medium tabular-nums">{formatPeso(priceFor(item, temp))}</span>
            <button
              type="button"
              onClick={onAdd}
              aria-label={`Add ${item.name} to the tray`}
              className={`grid size-10.5 shrink-0 place-items-center rounded-full text-cream transition-colors motion-safe:active:scale-[.92] ${
                justAdded ? 'bg-added' : 'bg-foreground'
              }`}
            >
              {justAdded ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
