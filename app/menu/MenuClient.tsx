'use client'

import Image from 'next/image'
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCartStore } from '@/store/useCartStore'
import { urlFor } from '@/sanity/lib/image'

interface MenuItem {
  _id: string
  name: string
  price: number
  category: string
  description?: string
  image?: { asset: { _ref: string } }
  drinkType?: 'hot' | 'iced' | 'both'
  sizes?: string[]
  ingredients?: string[]
}

type Selections = Record<string, { temp: string; size: string }>

const EASE: [number, number, number, number] = [0.76, 0, 0.24, 1]

export default function MenuClient({ items }: { items: MenuItem[] }) {
  const addItem = useCartStore((s) => s.addItem)
  const openTray = useCartStore((s) => s.openTray)
  const [selections, setSelections] = useState<Selections>({})
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)

  function getSelection(id: string, item: MenuItem) {
    const sel = selections[id]
    const defaultTemp =
      item.drinkType === 'hot' ? 'Hot'
      : item.drinkType === 'iced' ? 'Iced'
      : sel?.temp ?? 'Hot'
    const defaultSize = item.sizes?.[0] ?? ''
    return {
      temp: sel?.temp ?? defaultTemp,
      size: sel?.size ?? defaultSize,
    }
  }

  function setTemp(id: string, temp: string) {
    setSelections((prev) => ({ ...prev, [id]: { ...prev[id], temp } }))
  }

  function setSize(id: string, size: string) {
    setSelections((prev) => ({ ...prev, [id]: { ...prev[id], size } }))
  }

  function handleAdd(item: MenuItem) {
    const { temp, size } = getSelection(item._id, item)
    addItem({
      id: item._id,
      name: item.name,
      price: item.price,
      drinkType: item.drinkType ? temp : undefined,
      ounce: size || undefined,
    })
    openTray()
    setSelectedItem(null)
  }

  // Group by category
  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const key = item.category ?? 'Other'
    acc[key] = [...(acc[key] ?? []), item]
    return acc
  }, {})

  return (
    <>
      <div className="space-y-20">
        {Object.entries(grouped).map(([category, categoryItems]) => (
          <section key={category}>
            <h2 className="text-[10px] uppercase tracking-[0.3em] text-muted mb-8 pb-4 border-b border-border">
              {category}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
              {categoryItems.map((item) => {
                const sel = getSelection(item._id, item)
                return (
                  <motion.article
                    key={item._id}
                    whileHover={{ y: -8, boxShadow: '0px 15px 35px rgba(37, 79, 34, 0.08)' }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    className="flex flex-col group"
                  >
                    {item.image && (
                      <div
                        className="relative aspect-4/3 overflow-hidden mb-5 cursor-pointer"
                        onClick={() => setSelectedItem(item)}
                      >
                        <Image
                          src={urlFor(item.image).width(600).url()}
                          alt={item.name}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                        />
                      </div>
                    )}

                    <div className="flex-1 flex flex-col justify-between border-b border-border pb-6">
                      <div>
                        <h3
                          className="text-xl font-serif tracking-tight cursor-pointer hover:opacity-70 transition-opacity"
                          onClick={() => setSelectedItem(item)}
                        >
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="text-sm text-muted font-light mt-1 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                        <p className="text-base font-light mt-2">₱{item.price.toFixed(2)}</p>

                        {/* ── Drink type selector ── */}
                        {item.drinkType === 'both' && (
                          <div className="flex gap-2 mt-3">
                            {['Hot', 'Iced'].map((t) => (
                              <button
                                key={t}
                                onClick={() => setTemp(item._id, t)}
                                className={`px-3 py-1 text-[10px] uppercase tracking-[0.15em] border transition-all duration-200 ${
                                  sel.temp === t
                                    ? 'bg-foreground text-cream border-foreground'
                                    : 'border-border text-muted hover:border-foreground hover:text-foreground'
                                }`}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        )}

                        {item.drinkType && item.drinkType !== 'both' && (
                          <p className="text-[10px] uppercase tracking-[0.2em] text-muted mt-3">
                            {item.drinkType === 'hot' ? 'Hot' : 'Iced'}
                          </p>
                        )}

                        {/* ── Size selector ── */}
                        {item.sizes && item.sizes.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {item.sizes.map((s) => (
                              <button
                                key={s}
                                onClick={() => setSize(item._id, s)}
                                className={`px-3 py-1 text-[10px] uppercase tracking-[0.15em] border transition-all duration-200 ${
                                  sel.size === s
                                    ? 'bg-foreground text-cream border-foreground'
                                    : 'border-border text-muted hover:border-foreground hover:text-foreground'
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleAdd(item)}
                        className="mt-5 self-start border border-foreground px-5 py-2 text-[10px] uppercase tracking-[0.2em] hover:bg-foreground hover:text-cream opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 focus:opacity-100 focus:translate-y-0 transition-all duration-300"
                      >
                        Add to Tray
                      </button>
                    </div>
                  </motion.article>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* ── Product Modal ── */}
      <AnimatePresence>
        {selectedItem && (
          <>
            {/* Backdrop */}
            <motion.div
              key="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              onClick={() => setSelectedItem(null)}
              className="fixed inset-0 z-50 bg-black/60"
            />

            {/* Modal content */}
            <motion.div
              key="modal-content"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none"
            >
              <div className="relative w-full max-w-2xl bg-cream text-foreground shadow-2xl pointer-events-auto max-h-[90vh] flex flex-col">
                {/* Close button */}
                <button
                  onClick={() => setSelectedItem(null)}
                  aria-label="Close modal"
                  className="absolute top-5 right-5 z-10 w-8 h-8 flex items-center justify-center text-muted hover:text-foreground transition-colors text-lg leading-none"
                >
                  ✕
                </button>

                {/* Image */}
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

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-8 py-7 space-y-6">
                  {/* Name + price */}
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="font-serif text-3xl tracking-tight leading-tight">
                      {selectedItem.name}
                    </h2>
                    <span className="text-xl font-light shrink-0">
                      ₱{selectedItem.price.toFixed(2)}
                    </span>
                  </div>

                  {/* Description */}
                  {selectedItem.description && (
                    <p className="text-sm font-light leading-relaxed text-muted">
                      {selectedItem.description}
                    </p>
                  )}

                  {/* Ingredients */}
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

                  {/* Temp + size selectors in modal */}
                  {(selectedItem.drinkType === 'both' || (selectedItem.sizes && selectedItem.sizes.length > 0)) && (
                    <div className="space-y-3">
                      {selectedItem.drinkType === 'both' && (
                        <div className="flex gap-2">
                          {['Hot', 'Iced'].map((t) => {
                            const sel = getSelection(selectedItem._id, selectedItem)
                            return (
                              <button
                                key={t}
                                onClick={() => setTemp(selectedItem._id, t)}
                                className={`px-4 py-2 text-[10px] uppercase tracking-[0.15em] border transition-all duration-200 ${
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

                      {selectedItem.sizes && selectedItem.sizes.length > 0 && (
                        <div className="flex gap-2">
                          {selectedItem.sizes.map((s) => {
                            const sel = getSelection(selectedItem._id, selectedItem)
                            return (
                              <button
                                key={s}
                                onClick={() => setSize(selectedItem._id, s)}
                                className={`px-4 py-2 text-[10px] uppercase tracking-[0.15em] border transition-all duration-200 ${
                                  sel.size === s
                                    ? 'bg-foreground text-cream border-foreground'
                                    : 'border-border text-muted hover:border-foreground hover:text-foreground'
                                }`}
                              >
                                {s}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Add to Tray footer */}
                <div className="px-8 py-6 border-t border-border">
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
