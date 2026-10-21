import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requirePosAuth, createOrReplace, fetch, revalidatePath } = vi.hoisted(() => ({
  requirePosAuth: vi.fn(), createOrReplace: vi.fn(), fetch: vi.fn(), revalidatePath: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/sanity/lib/writeClient', () => ({ getWriteClient: () => ({ createOrReplace }) }))
vi.mock('@/sanity/lib/client', () => ({ client: { withConfig: () => ({ fetch }) } }))

import { POST } from './route'

const post = (body: unknown) => POST(new NextRequest('http://pos.test/api/menu/settings', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => {
  vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token')
  requirePosAuth.mockReset().mockResolvedValue(null)
  createOrReplace.mockReset().mockResolvedValue({})
  fetch.mockReset().mockResolvedValue({ categoryOrder: [] })
  revalidatePath.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/menu/settings', () => {
  it('saves the dragged tab order and refreshes /menu', async () => {
    const res = await post({ categoryOrder: ['espresso', 'signature'] })
    expect(res.status).toBe(200)
    expect(createOrReplace).toHaveBeenCalledWith({ _id: 'menu-settings', _type: 'menuSettings', categoryOrder: ['espresso', 'signature'] })
    expect(revalidatePath).toHaveBeenCalledWith('/menu')
  })

  it('no longer hides items by id', async () => {
    const res = await post({ itemId: 'cafe-latte', action: 'hide' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Invalid request body')
    expect(createOrReplace).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
