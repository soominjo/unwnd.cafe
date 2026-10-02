import { describe, it, expect, vi, afterEach } from 'vitest'
import { REFETCH_TIMEOUT_MS, refetchCardHolders } from './refetchCardHolders'

afterEach(() => {
  vi.useRealTimers()
})

const holders = [{ _id: 'k', name: 'Kylene', cardNumber: 12, joinedAt: '2026-10-02T00:00:00Z', card: { earned: 5, usedTen: 0, usedFree: 0 }, orderCount: 1 }]
const reply = (status: number, body: string): typeof fetch => async () => new Response(body, { status })

describe('refetchCardHolders', () => {
  it('reads the card holders as the server has them now', async () => {
    let asked: string | undefined
    const fetchImpl: typeof fetch = async (url) => {
      asked = String(url)
      return new Response(JSON.stringify({ success: true, data: holders }), { status: 200 })
    }
    expect(await refetchCardHolders(fetchImpl)).toEqual(holders)
    expect(asked).toBe('/api/loyalty/members')
  })

  it('gives null, never throws, when they cannot be read', async () => {
    const offline: typeof fetch = async () => { throw new TypeError('Failed to fetch') }
    expect(await refetchCardHolders(offline)).toBeNull()
    expect(await refetchCardHolders(reply(401, JSON.stringify({ success: false, error: 'Unauthorized' })))).toBeNull()
    expect(await refetchCardHolders(reply(200, '<html>captive portal</html>'))).toBeNull()
    expect(await refetchCardHolders(reply(200, JSON.stringify({ success: true, data: 'nope' })))).toBeNull()
  })

  it('gives up on a reply that never comes, so a checkout waiting on it is never stuck', async () => {
    vi.useFakeTimers()
    // A request that only ends when it is aborted, like one on a dead connection.
    const stalled: typeof fetch = (_url, init) => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })
    const pending = refetchCardHolders(stalled)
    await vi.advanceTimersByTimeAsync(REFETCH_TIMEOUT_MS)
    expect(await pending).toBeNull()
  })
})
