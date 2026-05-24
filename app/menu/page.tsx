import { client } from '@/sanity/lib/client'
import MenuClient from './MenuClient'

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

async function getMenuItems(): Promise<MenuItem[]> {
  return client.fetch(
    `*[_type == "menuItem" && available == true] | order(category asc, name asc) {
      _id, name, price, category, description, image, drinkType, sizes, ingredients
    }`
  )
}

export default async function MenuPage() {
  const items = await getMenuItems()

  return (
    <main className="min-h-screen bg-cream text-foreground pt-32 pb-24 px-8 md:px-16">
      {/* Header */}
      <header className="mb-20">
        <h1
          className="font-serif lowercase tracking-tighter leading-none"
          style={{ fontSize: 'clamp(3rem, 8vw, 7rem)' }}
        >
          the menu.
        </h1>
        <p className="text-muted text-[11px] uppercase tracking-[0.3em] mt-4">
          Crafted for the aesthetic soul
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-muted font-light">
          Menu items are being added — check back soon.
        </p>
      ) : (
        <MenuClient items={items} />
      )}
    </main>
  )
}
