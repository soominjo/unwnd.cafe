'use client'

import Image from 'next/image'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCartStore } from '@/store/useCartStore'
import { urlFor } from '@/sanity/lib/image'
import type { SanityMenuItem as MenuItem } from '@/types/sanity'

function getPrice(item: MenuItem, temp: string): number {
  if (temp === 'Hot' && item.priceHot != null) return item.priceHot
  if (temp === 'Iced' && item.priceIce != null) return item.priceIce
  return item.price
}

type Selections = Record<string, { temp: string }>

const EASE: [number, number, number, number] = [0.76, 0, 0.24, 1]

const CATEGORY_ORDER = [
  'signature drink', 'coffee', 'non-coffee', 'tea', 'frappe', 'soda fizz', 'nachos', 'waffle',
]

const CATEGORY_LABELS: Record<string, string> = {
  'signature drink': 'Signature',
  'coffee':          'Espresso',
  'non-coffee':      'Non-Coffee',
  'tea':             'Tea',
  'frappe':          'Frappe',
  'soda fizz':       'Soda & Fizz',
  'nachos':          'Food',
  'waffle':          'Waffles',
}

export default function MenuClient({ items }: { items: MenuItem[] }) {
  const addItem  = useCartStore((s) => s.addItem)
  const openTray = useCartStore((s) => s.openTray)
  const [selections, setSelections]     = useState<Selections>({})
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)

  // Group + order categories
  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const key = item.category ?? 'Other'
    return { ...acc, [key]: [...(acc[key] ?? []), item] }
  }, {})

  const categories = [
    ...CATEGORY_ORDER.filter((c) => grouped[c]),
    ...Object.keys(grouped).filter((c) => !CATEGORY_ORDER.includes(c)),
  ]

  const [activeTab, setActiveTab] = useState(categories[0] ?? '')
  const activeItems = grouped[activeTab] ?? []

  function getSelection(id: string, item: MenuItem) {
    const sel = selections[id]
    const defaultTemp = item.drinkType === 'hot' ? 'Hot' : 'Iced'
    return { temp: sel?.temp ?? defaultTemp }
  }

  function setTemp(id: string, temp: string) {
    setSelections((prev) => ({ ...prev, [id]: { ...prev[id], temp } }))
  }

  function handleAdd(item: MenuItem) {
    const { temp } = getSelection(item._id, item)
    addItem({
      id: item._id,
      name: item.name,
      price: getPrice(item, temp),
      drinkType: item.drinkType ? temp : undefined,
    })
    openTray()
    setSelectedItem(null)
  }

  return (
    <>
      {/* ── Category tabs ── */}
      <div className="sticky top-14.25 z-30 bg-foreground shrink-0">
        <div className="flex overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              onMouseEnter={() => setActiveTab(cat)}
              className={`relative shrink-0 flex-1 min-w-fit px-6 py-5 text-xs font-bold uppercase tracking-[0.2em] transition-all duration-200 ${
                activeTab === cat
                  ? 'text-foreground bg-cream'
                  : 'text-cream/55 hover:text-cream'
              }`}
            >
              {CATEGORY_LABELS[cat] ?? cat}
              {activeTab === cat && (
                <motion.span
                  layoutId="tab-bar"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground"
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="absolute inset-0 overflow-y-auto"
          >
            {/* Item grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 p-3 md:p-5 min-h-full content-start">
              {activeItems.map((item, index) => {
                const sel = getSelection(item._id, item)
                return (
                  <motion.div
                    key={item._id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
                    className="group bg-background border border-foreground/10 border-l-2 border-l-foreground/30 hover:border-foreground/20 hover:border-l-foreground/70 hover:bg-foreground/3 transition-all duration-300 p-6 md:p-7 flex flex-col gap-3"
                  >
                    {/* Name + Price */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3
                          className="font-serif font-medium tracking-tight leading-tight cursor-pointer hover:opacity-60 transition-opacity duration-200"
                          style={{ fontSize: 'clamp(1.05rem, 1.6vw, 1.25rem)' }}
                          onClick={() => item.image && setSelectedItem(item)}
                        >
                          {item.name}
                          {item.image && (
                            <span className="ml-2 text-[8px] uppercase tracking-[0.2em] text-muted align-middle">↗</span>
                          )}
                        </h3>
                        {item.description && (
                          <p className="text-xs text-foreground/55 leading-relaxed line-clamp-2 mt-1.5">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <motion.span
                          key={`${item._id}-${sel.temp}`}
                          initial={{ opacity: 0, y: -3 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2 }}
                          className="font-serif text-2xl md:text-3xl tracking-tight leading-none block"
                        >
                          ₱{getPrice(item, sel.temp)}
                        </motion.span>
                        {item.priceHot != null && item.priceIce != null && item.priceHot !== item.priceIce && (
                          <span className="text-[9px] text-muted/70 tabular-nums mt-0.5 block">
                            {item.priceHot} · {item.priceIce}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Selectors + Add to Tray */}
                    <div className="flex items-center justify-between gap-2 mt-auto pt-3">
                      <div className="flex gap-1 flex-wrap">
                        {item.drinkType === 'both' && (
                          <div className="flex">
                            {['Hot', 'Iced'].map((t) => (
                              <button
                                key={t}
                                onClick={() => setTemp(item._id, t)}
                                className={`px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] border-t border-b border-r first:border-l transition-all duration-200 ${
                                  sel.temp === t
                                    ? 'bg-foreground text-cream border-foreground'
                                    : 'text-foreground/50 border-border hover:border-foreground/50 hover:text-foreground'
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        )}
                        {item.drinkType && item.drinkType !== 'both' && (
                          <span className="text-[10px] uppercase tracking-[0.15em] text-foreground/45 self-center">
                            {item.drinkType === 'hot' ? 'Hot' : 'Iced'}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleAdd(item)}
                        className="shrink-0 text-[9px] uppercase tracking-[0.15em] px-2.5 py-1 border border-foreground/25 text-foreground/60 hover:bg-foreground hover:text-cream hover:border-foreground transition-all duration-200"
                      >
                        Add to Tray
                      </button>
                    </div>
                  </motion.div>
                )
              })}

              {/* Fill empty cells to maintain grid alignment */}
              {activeItems.length % 3 !== 0 &&
                Array.from({ length: 3 - (activeItems.length % 3) }).map((_, i) => (
                  <div key={`fill-${i}`} className="bg-background hidden lg:block" />
                ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Product modal ── */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              onClick={() => setSelectedItem(null)}
              className="fixed inset-0 z-50 bg-black/60"
            />

            <motion.div
              key="modal"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none"
            >
              <div className="relative w-full max-w-2xl bg-cream text-foreground shadow-2xl pointer-events-auto max-h-[90vh] flex flex-col">
                <button
                  onClick={() => setSelectedItem(null)}
                  aria-label="Close modal"
                  className="absolute top-5 right-5 z-10 w-8 h-8 flex items-center justify-center text-muted hover:text-foreground transition-colors"
                >
                  ✕
                </button>

                {selectedItem.image && (
                  <div className="relative aspect-video w-full overflow-hidden shrink-0">
                    <Image
                      src={urlFor(selectedItem.image).width(900).url()}
                      alt={selectedItem.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 672px"
                      className="object-cover"
                    />
                  </div>
                )}

                <div className="flex-1 overflow-y-auto px-8 py-7 space-y-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="font-serif text-3xl tracking-tight leading-tight">
                      {selectedItem.name}
                    </h2>
                    <span className="font-serif text-2xl shrink-0">
                      ₱{getPrice(selectedItem, getSelection(selectedItem._id, selectedItem).temp)}
                    </span>
                  </div>

                  {selectedItem.description && (
                    <p className="text-sm font-light leading-relaxed text-muted">
                      {selectedItem.description}
                    </p>
                  )}

                  {selectedItem.ingredients && selectedItem.ingredients.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.3em] text-muted mb-3">
                        What&apos;s in it
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.ingredients.map((ing) => (
                          <span
                            key={ing}
                            className="px-3 py-1 border border-border text-[11px] uppercase tracking-[0.15em] text-muted"
                          >
                            {ing}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedItem.drinkType === 'both' && (
                    <div className="space-y-3">
                      {selectedItem.drinkType === 'both' && (
                        <div className="flex">
                          {['Hot', 'Iced'].map((t) => {
                            const sel = getSelection(selectedItem._id, selectedItem)
                            return (
                              <button
                                key={t}
                                onClick={() => setTemp(selectedItem._id, t)}
                                className={`px-5 py-2.5 text-[10px] uppercase tracking-[0.15em] border-t border-b border-r first:border-l transition-all duration-200 ${
                                  sel.temp === t
                                    ? 'bg-foreground text-cream border-foreground'
                                    : 'border-border text-muted hover:border-foreground hover:text-foreground'
                                }`}
                              >
                                {t}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-8 py-6 border-t border-border shrink-0">
                  <button
                    onClick={() => handleAdd(selectedItem)}
                    className="w-full border border-foreground py-3 text-[11px] uppercase tracking-[0.25em] hover:bg-foreground hover:text-cream transition-all duration-300"
                  >
                    Add to Tray
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
