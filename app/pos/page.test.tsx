import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { PosMenu } from '@/lib/posMenu'

const { jar, menu } = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  menu: { current: null as PosMenu | null },
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}))
vi.mock('next/font/google', () => ({ IBM_Plex_Mono: () => ({ className: '' }) }))
vi.mock('@/lib/posMenu', () => ({ loadPosMenu: async () => menu.current }))
vi.mock('@/lib/loyaltyStore', () => ({ loadCardHolders: async () => [] }))
vi.mock('@/lib/sales/loadOpenSale', () => ({ loadOpenSale: async () => ({ problem: 'gone' }) }))

import POSPage from './page'

const live: PosMenu = {
  categories: [{ id: 'signature', label: 'Signature', type: 'drink', order: 1, _sanityId: 'menu-category-signature' }],
  items: [],
  categoryOrder: ['signature'],
}

const render = async () => renderToStaticMarkup(await POSPage({ searchParams: Promise.resolve({}) }))

beforeEach(() => {
  jar.clear()
  menu.current = live
})

describe('the POS page, as the server sends it', () => {
  it('opens with menu editing still on when the manager left it on, so a reload asks for nothing', async () => {
    jar.set('pos_menu_unlocked', '1')
    const html = await render()
    expect(html).toContain('>Lock</span>')
    expect(html).toContain('title="Manage menu"')
  })

  it('opens locked when editing was locked, or never turned on', async () => {
    expect(await render()).toContain('>Manager</span>')
    jar.set('pos_menu_unlocked', '')
    const html = await render()
    expect(html).toContain('>Manager</span>')
    expect(html).not.toContain('title="Manage menu"')
  })

  it('ignores the Manager page cookie: unlocking that page does not open menu editing', async () => {
    jar.set('pos_manager_unlocked', '1')
    expect(await render()).not.toContain('>Lock</span>')
  })
})
