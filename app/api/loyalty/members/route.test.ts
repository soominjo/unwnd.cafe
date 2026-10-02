import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { requirePosAuth, addCardHolder, fetchCardHolders } = vi.hoisted(() => ({
  requirePosAuth: vi.fn(), addCardHolder: vi.fn(), fetchCardHolders: vi.fn(),
}))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/lib/loyaltyStore', () => ({ addCardHolder, fetchCardHolders }))

import { GET, POST } from './route'

const PIN = '2468'
const post = (body: unknown) => POST(new NextRequest('http://pos.test/api/loyalty/members', {
  method: 'POST',
  body: typeof body === 'string' ? body : JSON.stringify(body),
}))

beforeEach(() => {
  vi.stubEnv('POS_PIN', PIN)
  vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token')
  requirePosAuth.mockReset().mockResolvedValue(null)
  addCardHolder.mockReset().mockImplementation(async (name: string) => ({
    _id: 'new-id', name, cardNumber: 8, joinedAt: '2026-10-02T05:00:00Z', card: { earned: 0, usedTen: 0, usedFree: 0 }, orderCount: 0,
  }))
  fetchCardHolders.mockReset()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/loyalty/members', () => {
  it('gives the card, under the name as cleaned up, with no manager PIN', async () => {
    const res = await post({ name: '  Kylene   R. ' })
    expect(res.status).toBe(201)
    expect(addCardHolder).toHaveBeenCalledWith('Kylene R.')
    expect((await res.json()).data).toMatchObject({ name: 'Kylene R.', cardNumber: 8 })
    expect(console.info).toHaveBeenCalledWith('Loyalty card given', { id: 'new-id', cardNumber: 8 })
  })

  it('refuses a name the receipt printer could not print', async () => {
    const res = await post({ name: 'Kylene ←' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Use letters, numbers and simple punctuation only.')
    expect(addCardHolder).not.toHaveBeenCalled()
  })

  it('refuses a missing name and a body that is not JSON', async () => {
    expect((await post({})).status).toBe(400)
    expect((await post('not json')).status).toBe(400)
    expect(addCardHolder).not.toHaveBeenCalled()
  })

  it('needs the POS session before anything else', async () => {
    requirePosAuth.mockResolvedValue(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    expect((await post({ name: 'Kylene', pin: PIN })).status).toBe(401)
    expect(addCardHolder).not.toHaveBeenCalled()
  })
})

describe('GET /api/loyalty/members', () => {
  it('lists the card holders for a signed-in POS', async () => {
    fetchCardHolders.mockResolvedValue([])
    const res = await GET()
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: [] })
  })
})
