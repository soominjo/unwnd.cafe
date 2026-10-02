import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const { requirePosAuth, removeCardHolder } = vi.hoisted(() => ({ requirePosAuth: vi.fn(), removeCardHolder: vi.fn() }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/lib/loyaltyStore', () => ({ removeCardHolder }))

import { DELETE } from './route'

const PIN = '2468'
const remove = (id: string, body: unknown) => DELETE(
  new NextRequest(`http://pos.test/api/loyalty/members/${id}`, { method: 'DELETE', body: JSON.stringify(body) }),
  { params: Promise.resolve({ id }) },
)

beforeEach(() => {
  vi.stubEnv('POS_PIN', PIN)
  vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token')
  requirePosAuth.mockReset().mockResolvedValue(null)
  removeCardHolder.mockReset().mockResolvedValue(true)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('DELETE /api/loyalty/members/[id]', () => {
  it('removes the card with the manager PIN', async () => {
    const res = await remove('kylene', { pin: PIN })
    expect(res.status).toBe(200)
    expect(removeCardHolder).toHaveBeenCalledWith('kylene')
    expect(console.info).toHaveBeenCalledWith('Loyalty card removed', { id: 'kylene' })
  })

  it('refuses a wrong PIN with 403 and removes nothing', async () => {
    expect((await remove('kylene', { pin: '1357' })).status).toBe(403)
    expect(removeCardHolder).not.toHaveBeenCalled()
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain('1357')
  })

  it('refuses an id that is not a document id, such as a draft', async () => {
    expect((await remove('drafts.kylene', { pin: PIN })).status).toBe(400)
    expect(removeCardHolder).not.toHaveBeenCalled()
  })

  it('says when there was no such card holder', async () => {
    removeCardHolder.mockResolvedValue(false)
    expect((await remove('a-sale-id', { pin: PIN })).status).toBe(404)
  })
})
