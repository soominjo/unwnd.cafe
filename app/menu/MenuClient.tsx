'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useCartStore } from '@/store/useCartStore'
import { urlFor } from '@/sanity/lib/image'

interface MenuItem {
  _id: string
  name: string
  price: number
  category: string
  description?: string
  image?: { asset: { _ref: string } }
}

export default function MenuClient({ items }: { items: MenuItem[] }) {
  const addItem = useCartStore((s) => s.addItem)
  const openTray = useCartStore((s) => s.openTray)

  function handleAdd(item: MenuItem) {
    addItem({ id: item._id, name: item.name, price: item.price })
    openTray()
  }

  // Group by category
  const grouped = items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const key = item.category ?? 'Other'
    acc[key] = [...(acc[key] ?? []), item]
    return acc
  }, {})

  return (
    <div className="space-y-20">
      {Object.entries(grouped).map(([category, categoryItems]) => (
        <section key={category}>
          <h2 className="text-[10px] uppercase tracking-[0.3em] text-muted mb-8 pb-4 border-b border-border">
            {category}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {categoryItems.map((item) => (
              <motion.article
                key={item._id}
                whileHover={{ y: -4 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className="group flex flex-col"
              >
                {item.image && (
                  <div className="relative aspect-[4/3] overflow-hidden mb-5">
                    <Image
                      src={urlFor(item.image).width(600).url()}
                      alt={item.name}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                    />
                  </div>
                )}

                <div className="flex-1 flex flex-col justify-between border-b border-border pb-6">
                  <div>
                    <h3 className="text-xl font-serif tracking-tight">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-muted font-light mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    )}
                    <p className="text-base font-light mt-2">${item.price.toFixed(2)}</p>
                  </div>

                  <button
                    onClick={() => handleAdd(item)}
                    className="mt-5 self-start border border-foreground px-5 py-2 text-[10px] uppercase tracking-[0.2em] hover:bg-foreground hover:text-white transition-all duration-300"
                  >
                    Add to Tray
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
