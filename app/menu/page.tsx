import MenuClient from './MenuClient'
import { readMenu } from '@/lib/posMenu'
import { toPublicMenu } from './publicMenu'

// The menu as the POS has it. Every menu save on the POS re-renders this page at once
// (revalidatePath in the menu routes); edits made in Sanity Studio reach it within a minute.
export const revalidate = 60

export default async function MenuPage() {
  const { categories, items } = toPublicMenu(await readMenu({ noStore: false }))

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">

      {/* ── Header ── */}
      <header className="bg-foreground text-cream px-8 md:px-16 pt-32 pb-10 shrink-0">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-cream/40 text-[9px] uppercase tracking-[0.45em] mb-4">
              unwnd. café
            </p>
            <h1
              className="font-serif lowercase tracking-tighter leading-none"
              style={{ fontSize: 'clamp(2.8rem, 7vw, 6rem)' }}
            >
              the menu.
            </h1>
          </div>
          <p className="text-cream/25 text-[10px] uppercase tracking-[0.3em] hidden md:block mb-1.5">
            {items.length} items
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="px-8 md:px-16 py-24">
          <p className="text-muted font-light">
            Menu items are being added — check back soon.
          </p>
        </div>
      ) : (
        <MenuClient items={items} categories={categories} />
      )}

    </main>
  )
}
