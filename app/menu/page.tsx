import MenuClient from './MenuClient'
import { readMenu } from '@/lib/posMenu'
import { countLabel } from './menuView'
import { fetchPhotoPreviews } from './photoPreviews'
import { toPublicMenu } from './publicMenu'

// The menu as the POS has it. Every menu save on the POS re-renders this page at once
// (revalidatePath in the menu routes); edits made in Sanity Studio reach it within a minute.
export const revalidate = 60

// The menu's column: 20px gutters on phones, 40px from 640px, 64px from 1024px.
const WRAP = 'mx-auto max-w-310 px-5 sm:px-10 lg:px-16'

export default async function MenuPage() {
  const [menu, previews] = await Promise.all([readMenu({ noStore: false }), fetchPhotoPreviews()])
  const { categories, items } = toPublicMenu(menu, previews)

  return (
    <main className="min-h-screen bg-background text-foreground">

      {/* ── Header ── */}
      <header className="bg-foreground text-cream pt-[calc(var(--nav-h)+1.875rem)] pb-8.5">
        <div className={WRAP}>
          {/* Cormorant, not font-logo: the brand display font would add 76 KB to this page. */}
          <p className="font-serif text-[17px] text-cream/65 mb-2.5">unwnd. café</p>
          <h1
            className="font-serif font-medium lowercase leading-[0.9] tracking-[-0.02em]"
            style={{ fontSize: 'clamp(3rem, 15vw, 6rem)' }}
          >
            the menu.
          </h1>
          <p className="mt-3.5 text-xs uppercase tracking-[0.16em] text-cream/60">
            {countLabel(items.length, 'item')} · prices in pesos
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <div className={`${WRAP} py-24`}>
          <p className="text-ink-2 font-light">
            Menu items are being added — check back soon.
          </p>
        </div>
      ) : (
        <MenuClient items={items} categories={categories} />
      )}

    </main>
  )
}
