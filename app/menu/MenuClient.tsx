'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useCartStore } from '@/store/useCartStore'
import type { SanityMenuItem } from '@/types/sanity'
import CategoryChips from './CategoryChips'
import ItemSheet from './ItemSheet'
import MenuCard from './MenuCard'
import TrayBar from './TrayBar'
import { countLabel, defaultTemp, menuSections, pickActive, priceFor, type Temp } from './menuView'
import { prefersReducedMotion } from './reducedMotion'

interface MenuClientProps {
  items: SanityMenuItem[]
  categories: { id: string; label: string }[]
}

// How long the + shows its tick after an add.
const ADDED_TICK_MS = 900

// Photos loaded up front: the first row of the phone grid, two across.
const FIRST_ROW_PHOTOS = 2

// The Nav and the chips cover the top ~140px: a category is the one being read from when its
// top slides under them until it leaves the upper part of the screen.
const SPY_ROOT_MARGIN = '-140px 0px -55% 0px'

// Every category on one page, with chips that follow the scroll. Adding an item updates the
// tray bar instead of opening the tray.
export default function MenuClient({ items, categories }: MenuClientProps) {
  const sections = useMemo(() => menuSections(items, categories), [items, categories])
  const labels = useMemo(() => new Map(categories.map((c) => [c.id, c.label])), [categories])

  const addItem = useCartStore((s) => s.addItem)
  const openTray = useCartStore((s) => s.openTray)
  const cartItems = useCartStore((s) => s.items)
  const count = cartItems.reduce((n, i) => n + i.quantity, 0)
  const total = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0)

  const [temps, setTemps] = useState<Record<string, Temp>>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [active, setActive] = useState(sections[0]?.id ?? '')
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const [pulseKey, setPulseKey] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const tickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const tempOf = (item: SanityMenuItem): Temp | null => temps[item._id] ?? defaultTemp(item)
  const setTemp = (id: string, temp: Temp) => setTemps((prev) => ({ ...prev, [id]: temp }))

  function add(item: SanityMenuItem) {
    const temp = tempOf(item)
    addItem({
      id: item._id,
      name: item.name,
      price: priceFor(item, temp),
      drinkType: item.drinkType ? temp ?? undefined : undefined,
    })
    clearTimeout(tickTimer.current)
    setJustAdded(item._id)
    tickTimer.current = setTimeout(() => setJustAdded(null), ADDED_TICK_MS)
    setPulseKey((k) => k + 1)
    // The count makes each message new, so a second add of the same item is read out too.
    const what = item.drinkType && temp ? `${item.name} (${temp})` : item.name
    setAnnouncement(`Added ${what}. Your tray has ${countLabel(count + 1, 'item')}.`)
  }

  useEffect(() => () => clearTimeout(tickTimer.current), [])

  // Mark the chip of the category being read. Categories leaving the band count too, so
  // scrolling back up hands the mark back to the category above.
  useEffect(() => {
    const order = sections.map((section) => section.id)
    let visible: ReadonlySet<string> = new Set()
    const observer = new IntersectionObserver(
      (entries) => {
        const next = new Set(visible)
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.cat
          if (!id) continue
          if (entry.isIntersecting) next.add(id)
          else next.delete(id)
        }
        visible = next
        setActive((current) => pickActive(next, order, current))
      },
      { rootMargin: SPY_ROOT_MARGIN }
    )
    document.querySelectorAll<HTMLElement>('section[data-cat]').forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [sections])

  function pick(id: string) {
    document.getElementById(`cat-${id}`)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    setActive(id)
  }

  const openItem = openId ? items.find((item) => item._id === openId) ?? null : null

  return (
    <>
      <CategoryChips sections={sections} active={active} onPick={pick} />

      <div className="mx-auto max-w-310 px-5 sm:px-10 lg:px-16">
        {sections.map((section, sectionIndex) => (
          <section
            key={section.id}
            id={`cat-${section.id}`}
            data-cat={section.id}
            aria-labelledby={`cat-title-${section.id}`}
            className="scroll-mt-[calc(var(--nav-h)+66px)] pt-7.5 pb-2.5"
          >
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <h2 id={`cat-title-${section.id}`} className="font-serif text-[2.3rem] font-medium leading-none tracking-[-0.01em]">
                {`${section.label.toLowerCase()}.`}
              </h2>
              <span className="text-xs tracking-[0.06em] text-ink-2">{countLabel(section.items.length, 'item')}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-4 lg:gap-x-6 lg:gap-y-10">
              {section.items.map((item, itemIndex) => (
                <MenuCard
                  key={item._id}
                  item={item}
                  withPhoto={section.withPhotos}
                  temp={tempOf(item)}
                  justAdded={justAdded === item._id}
                  onTemp={(temp) => setTemp(item._id, temp)}
                  onAdd={() => add(item)}
                  onOpen={() => setOpenId(item._id)}
                  // The first row on a phone: the biggest thing on screen when the page opens.
                  preload={sectionIndex === 0 && itemIndex < FIRST_ROW_PHOTOS}
                />
              ))}
            </div>
          </section>
        ))}
        <p className="pt-7 pb-2 text-[12.5px] text-ink-2">Prices are a guide. Please order and pay at the counter.</p>
      </div>

      <TrayBar count={count} total={total} pulseKey={pulseKey} onOpen={openTray} />

      <ItemSheet
        item={openItem}
        categoryLabel={openItem ? labels.get(openItem.category) ?? '' : ''}
        temp={openItem ? tempOf(openItem) : null}
        onTemp={(temp) => openItem && setTemp(openItem._id, temp)}
        onAdd={() => {
          if (!openItem) return
          add(openItem)
          setOpenId(null)
        }}
        onClose={() => setOpenId(null)}
      />

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </>
  )
}
