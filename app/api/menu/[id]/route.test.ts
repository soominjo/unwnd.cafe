import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requirePosAuth, del, commit, fetch, revalidatePath } = vi.hoisted(() => ({
  requirePosAuth: vi.fn(), del: vi.fn(), commit: vi.fn(), fetch: vi.fn(), revalidatePath: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/sanity/lib/writeClient', () => ({ getWriteClient: () => ({ delete: del, patch: () => ({ set: () => ({ commit }) }) }) }))
vi.mock('@/sanity/lib/client', () => ({ client: { withConfig: () => ({ fetch }) } }))

import { DELETE, PATCH } from './route'

const params = { params: Promise.resolve({ id: 'abc' }) }
const req = (body?: unknown) =>
  new NextRequest('http://pos.test/api/menu/abc', { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) })

beforeEach(() => {
  vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token')
  requirePosAuth.mockReset().mockResolvedValue(null)
  del.mockReset().mockResolvedValue({})
  commit.mockReset().mockResolvedValue({})
  fetch.mockReset()
  revalidatePath.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('/api/menu/[id]', () => {
  it('an edit refreshes /menu', async () => {
    fetch.mockResolvedValue({ _id: 'abc', category: 'espresso' })
    const res = await PATCH(req({ name: 'Americano', category: 'espresso', priceHot: 125 }), params)
    expect(res.status).toBe(200)
    expect(commit).toHaveBeenCalled()
    expect(revalidatePath).toHaveBeenCalledWith('/menu')
  })

  it('a delete refreshes /menu, and it stays deleted', async () => {
    fetch.mockResolvedValue({ _id: 'abc' })
    const res = await DELETE(req(), params)
    expect(res.status).toBe(200)
    expect(del).toHaveBeenCalledWith('abc')
    expect(revalidatePath).toHaveBeenCalledWith('/menu')
  })

  it('a missing item changes nothing', async () => {
    fetch.mockResolvedValue(null)
    expect((await PATCH(req({ name: 'Americano', category: 'espresso', priceHot: 125 }), params)).status).toBe(404)
    expect((await DELETE(req(), params)).status).toBe(404)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
