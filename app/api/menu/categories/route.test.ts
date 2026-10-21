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

const post = (body: unknown) => POST(new NextRequest('http://pos.test/api/menu/categories', { method: 'POST', body: JSON.stringify(body) }))

// What Sanity answers: whether the id is taken, and the highest tab order so far.
function answer(existing: unknown[]) {
  fetch.mockImplementation(async (query: string) => (query.includes('id == $id') ? existing : [{ order: 9 }]))
}

beforeEach(() => {
  vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token')
  requirePosAuth.mockReset().mockResolvedValue(null)
  create.mockReset().mockResolvedValue({ _id: 'new-tab' })
  revalidatePath.mockReset()
  answer([])
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/menu/categories', () => {
  it('adds a tab under a former code name: re-adding Espresso brings the espresso id back', async () => {
    const res = await post({ label: 'Espresso', type: 'drink' })
    expect(res.status).toBe(200)
    expect(create).toHaveBeenCalledWith({ _type: 'menuCategory', id: 'espresso', label: 'Espresso', type: 'drink', order: 10 })
    expect(revalidatePath).toHaveBeenCalledWith('/menu')
  })

  it('refuses a name already in use, or over 40 characters, without refreshing /menu', async () => {
    answer([{ _id: 'x' }])
    expect((await post({ label: 'Espresso', type: 'drink' })).status).toBe(409)
    answer([])
    expect((await post({ label: 'x'.repeat(41), type: 'drink' })).status).toBe(400)
    expect(create).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
