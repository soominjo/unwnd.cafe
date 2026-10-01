import { describe, it, expect } from 'vitest'
import { verifyPosPin } from './verifyPosPin'

const status = (code: number): typeof fetch => async () => new Response('{}', { status: code })

describe('verifyPosPin', () => {
  it('checks the PIN with the POS login route', async () => {
    let seen: { url: string; init?: RequestInit } | null = null
    const fetchImpl: typeof fetch = async (url, init) => {
      seen = { url: String(url), init }
      return new Response('{"ok":true}', { status: 200 })
    }
    expect(await verifyPosPin('2468', fetchImpl)).toBe('ok')
    expect(seen).toEqual({
      url: '/api/pos-auth',
      init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"pin":"2468"}' },
    })
  })

  it('only takes the login route’s own { ok: true } as a pass, not any 200', async () => {
    const blank: typeof fetch = async () => new Response('<html>captive portal</html>', { status: 200 })
    expect(await verifyPosPin('2468', blank)).toBe('unreachable')
    expect(await verifyPosPin('2468', status(200))).toBe('unreachable')
  })

  it('tells a wrong PIN apart from a server it cannot reach', async () => {
    expect(await verifyPosPin('0000', status(401))).toBe('wrong')
    expect(await verifyPosPin('2468', status(500))).toBe('unreachable')
    const offline: typeof fetch = async () => { throw new TypeError('Failed to fetch') }
    expect(await verifyPosPin('2468', offline)).toBe('unreachable')
  })
})
