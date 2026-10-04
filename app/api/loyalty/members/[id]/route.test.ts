import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { requirePosAuth, removeCardHolder } = vi.hoisted(() => ({ requirePosAuth: vi.fn(), removeCardHolder: vi.fn() }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/lib/loyaltyStore', () => ({ removeCardHolder }))

import { DELETE } from './route'

const remove = (id: string) => DELETE(
  new NextRequest(`http://pos.test/api/loyalty/members/${id}`, { method: 'DELETE' }),
  { params: Promise.resolve({ id }) },
)

beforeEach(() => {
  vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token')
  requirePosAuth.mockReset().mockResolvedValue(null)
  removeCardHolder.mockReset().mockResolvedValue(true)
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('DELETE /api/loyalty/members/[id]', () => {
  it('removes the card with no manager PIN: the POS session is enough', async () => {
    const res = await remove('kylene')
    expect(res.status).toBe(200)
    expect(removeCardHolder).toHaveBeenCalledWith('kylene')
    expect(console.info).toHaveBeenCalledWith('Loyalty card removed', { id: 'kylene' })
  })

  it('removes nothing for a POS that has signed out', async () => {
    requirePosAuth.mockResolvedValue(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    expect((await remove('kylene')).status).toBe(401)
    expect(removeCardHolder).not.toHaveBeenCalled()
  })

  it('refuses an id that is not a document id, such as a draft', async () => {
    expect((await remove('drafts.kylene')).status).toBe(400)
    expect(removeCardHolder).not.toHaveBeenCalled()
  })

  it('says when there was no such card holder', async () => {
    removeCardHolder.mockResolvedValue(false)
    expect((await remove('a-sale-id')).status).toBe(404)
  })
})
