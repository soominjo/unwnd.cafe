'use client'

import Image from 'next/image'
import { useEffect, useRef, type MouseEvent } from 'react'
import type { SanityMenuItem } from '@/types/sanity'
import { SHEET_PHOTO_RATIO, photoLoader, photoSrc } from './menuPhoto'
import { formatPeso, priceFor, type Temp } from './menuView'
import TempToggle from './TempToggle'

interface ItemSheetProps {
  /** The item shown, or null when the sheet is closed. */
  item: SanityMenuItem | null
  categoryLabel: string
  temp: Temp | null
  onTemp: (temp: Temp) => void
  onAdd: () => void
  onClose: () => void
}

// One item up close: a bottom sheet on phones, a centred card on wider screens, with the big
// photo when there is one. A native <dialog>, so Esc, focus and the backdrop come for free.
export default function ItemSheet({ item, categoryLabel, temp, onTemp, onAdd, onClose }: ItemSheetProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (item && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    } else if (!item && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [item])

  // A click on the dimmed backdrop lands on the dialog itself, never on its content.
  const closeOnBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose()
  }

  const photo = item?.image
  const tempSuffix = item?.drinkType === 'both' && temp ? ` · ${temp}` : ''

  return (
    <dialog
      ref={ref}
      aria-labelledby="item-sheet-title"
      onClose={onClose}
      onClick={closeOnBackdrop}
      className={`m-auto mb-0 max-h-[min(92svh,860px)] w-full max-w-120 overflow-auto overscroll-contain rounded-t-[22px] bg-paper p-0 text-foreground backdrop:bg-[rgba(0,22,5,.5)] motion-safe:open:animate-[sheet-up_.32s_cubic-bezier(.2,.8,.2,1)] sm:mb-auto sm:rounded-2xl ${
        photo ? 'sm:max-w-225' : ''
      }`}
    >
      {/* First in the dialog, so it is what opening the sheet focuses. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 z-10 grid size-10.5 place-items-center rounded-full bg-paper/95 text-[15px]"
      >
        ✕
      </button>

      {item && (
        <div className={photo ? 'sm:grid sm:grid-cols-[1.05fr_1fr]' : undefined}>
          {photo && (
            // 4:5 at every width: tall enough for the whole cup and its toppings, short enough to
            // keep the Add button on a phone's screen.
            <div className="relative aspect-4/5 bg-photo">
              <Image
                src={photoSrc(photo, SHEET_PHOTO_RATIO)}
                loader={photoLoader(photo, SHEET_PHOTO_RATIO)}
                alt=""
                fill
                sizes="(min-width: 640px) 470px, 100vw"
                placeholder={item.lqip ? 'blur' : 'empty'}
                blurDataURL={item.lqip}
                className="object-cover"
              />
            </div>
          )}

          <div className="flex flex-col gap-3.5 p-5.5 pb-[calc(22px+env(safe-area-inset-bottom))] sm:justify-center sm:p-8">
            <p className="text-[10.5px] font-medium uppercase tracking-[0.3em] text-ink-2">{categoryLabel}</p>
            <h2 id="item-sheet-title" className="pr-12 font-serif text-[2.2rem] font-medium leading-[1.02]">
              {item.name}
            </h2>
            {item.description && <p className="font-light text-ink-2">{item.description}</p>}

            {item.ingredients && item.ingredients.length > 0 && (
              <div>
                <p className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.3em] text-ink-2">What’s in it</p>
                <ul role="list" className="flex flex-wrap gap-1.5">
                  {item.ingredients.map((ingredient) => (
                    <li key={ingredient} className="rounded-full border border-hair-2 px-3 py-1 text-xs text-ink-2">
                      {ingredient}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <TempToggle item={item} temp={temp} onTemp={onTemp} large />
            <button
              type="button"
              onClick={onAdd}
              className="mt-1.5 min-h-13 rounded-full bg-foreground text-[14.5px] tracking-[0.03em] text-cream"
            >
              Add to tray · {formatPeso(priceFor(item, temp))}
              {tempSuffix}
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
