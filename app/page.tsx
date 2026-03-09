import Link from 'next/link'
import Image from 'next/image'
import { client } from '@/sanity/lib/client'
import { urlFor } from '@/sanity/lib/image'

interface MenuItem {
  _id: string
  name: string
  price: number
  category: string
  image?: { asset: { _ref: string } }
}

async function getFeaturedItems(): Promise<MenuItem[]> {
  return client.fetch(
    `*[_type == "menuItem" && featured == true && available == true] | order(_createdAt asc) [0...6] {
      _id, name, price, category, image
    }`
  )
}

export default async function HomePage() {
  const featured = await getFeaturedItems()

  return (
    <main className="bg-white text-foreground">
      {/* ─── Hero ─── */}
      <section className="relative min-h-screen flex flex-col justify-end bg-black overflow-hidden">
        {/* Swap this <div> for a <video> or <Image> once you have assets */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/60" />

        <div className="relative z-10 px-8 pb-16 md:px-16 md:pb-24">
          <h1
            className="font-serif text-white lowercase leading-none tracking-tighter"
            style={{ fontSize: 'clamp(4rem, 15vw, 14rem)' }}
          >
            unwnd.
          </h1>
          <p className="text-white/60 text-xs uppercase tracking-[0.3em] mt-4 mb-10">
            A place to slow down &amp; savour
          </p>
          <Link
            href="/menu"
            className="inline-block border border-white text-white text-[11px] uppercase tracking-[0.25em] px-8 py-3 hover:bg-white hover:text-black transition-all duration-300"
          >
            View Menu
          </Link>
        </div>
      </section>

      {/* ─── Featured Items ─── */}
      {featured.length > 0 && (
        <section className="px-8 py-24 md:px-16">
          <div className="flex items-baseline justify-between mb-16">
            <h2 className="font-serif text-4xl md:text-5xl lowercase tracking-tighter">
              featured.
            </h2>
            <Link
              href="/menu"
              className="text-[10px] uppercase tracking-[0.25em] text-muted hover:text-foreground transition-colors"
            >
              Full Menu →
            </Link>
          </div>

          {/* Masonry grid */}
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-8 space-y-8">
            {featured.map((item, i) => (
              <div
                key={item._id}
                className="break-inside-avoid border border-border overflow-hidden group"
              >
                {item.image ? (
                  <div className="relative overflow-hidden aspect-[4/3]">
                    <Image
                      src={urlFor(item.image).width(600).url()}
                      alt={item.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                    />
                  </div>
                ) : (
                  <div
                    className="aspect-[4/3] bg-border"
                    style={{ aspectRatio: i % 3 === 1 ? '4/5' : '4/3' }}
                  />
                )}
                <div className="p-6">
                  <span className="text-[10px] uppercase tracking-widest text-muted">
                    {item.category}
                  </span>
                  <h3 className="font-serif text-xl mt-1 tracking-tight">{item.name}</h3>
                  <p className="text-sm font-light mt-1">${item.price.toFixed(2)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </main>
  )
}
