import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requirePosAuth, create, fetch, revalidatePath } = vi.hoisted(() => ({
  requirePosAuth: vi.fn(), create: vi.fn(), fetch: vi.fn(), revalidatePath: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/sanity/lib/writeClient', () => ({ getWriteClient: () => ({ create }) }))
vi.mock('@/sanity/lib/client', () => ({ client: { withConfig: () => ({ fetch }) } }))

import { POST } from './route'

const post = (body: unknown) => POST(new NextRequest('http://pos.test/api/menu', { method: 'POST', body: JSON.stringify(body) }))

beforeEach(() => {
  vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token')
  requirePosAuth.mockReset().mockResolvedValue(null)
  create.mockReset().mockResolvedValue({ _id: 'new' })
  revalidatePath.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/menu', () => {
  it('adds an item and refreshes /menu', async () => {
    const res = await post({ name: 'Americano', category: 'espresso', priceHot: 120, priceIce: 130 })
    expect(res.status).toBe(200)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ _type: 'menuItem', name: 'Americano', category: 'espresso', available: true }))
    expect(revalidatePath).toHaveBeenCalledTimes(1)
    expect(revalidatePath).toHaveBeenCalledWith('/menu')
  })

  it('leaves /menu alone when the item is refused or not saved', async () => {
    expect((await post({ name: 'Americano', category: 'espresso' })).status).toBe(400)
    create.mockRejectedValueOnce(new Error('Sanity is down'))
    expect((await post({ name: 'Americano', category: 'espresso', priceHot: 120 })).status).toBe(500)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
