import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined) }),
}))

import ManagerPage from './page'

beforeEach(() => {
  jar.clear()
})

describe('the Manager page, as the server sends it', () => {
  it('opens unlocked when the manager left it unlocked, so a reload or Back asks for no PIN', async () => {
    jar.set('pos_manager_unlocked', '1')
    const html = renderToStaticMarkup(await ManagerPage())
    expect(html).toContain('Lock</button>')
    expect(html).not.toContain('Manager PIN')
  })

  it('asks for the manager PIN when it was locked, or never opened', async () => {
    expect(renderToStaticMarkup(await ManagerPage())).toContain('Manager PIN')
    jar.set('pos_manager_unlocked', '')
    expect(renderToStaticMarkup(await ManagerPage())).toContain('Manager PIN')
  })
})
