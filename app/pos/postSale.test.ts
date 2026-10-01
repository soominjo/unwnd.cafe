import { describe, it, expect } from 'vitest'
import { postSale } from './postSale'
import type { SalePayload } from './salePayload'

const payload: SalePayload = {
  total: 140,
  paymentAmount: 200,
  subtotal: 140,
  items: [{ lineId: 'wcm__ice', name: 'White Chocolate Mocha', variant: 'ice', price: 140, qty: 1 }],
  notes: 'Allen',
}

const respond = (status: number, body: string): typeof fetch => async () => new Response(body, { status })

describe('postSale', () => {
  it('POSTs the payload as JSON to /api/sales and resolves ok once it is saved', async () => {
    let seen: { url: string; init?: RequestInit } | null = null
    const fetchImpl: typeof fetch = async (url, init) => {
      seen = { url: String(url), init }
      return new Response(JSON.stringify({ success: true, id: 'sale-1' }), { status: 200 })
    }
    expect(await postSale(payload, fetchImpl)).toEqual({ ok: true })
    expect(seen).toEqual({
      url: '/api/sales',
      init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
    })
  })

  it("passes the server's own message through when it refuses the sale", async () => {
    const refused = respond(400, JSON.stringify({ success: false, error: 'Invalid sale data' }))
    expect(await postSale(payload, refused)).toEqual({ ok: false, error: 'Invalid sale data' })
  })

  it('falls back to a generic message when the server gives none', async () => {
    expect(await postSale(payload, respond(500, JSON.stringify({ success: false })))).toEqual({
      ok: false,
      error: 'Failed to save sale. Try again.',
    })
  })

  it('reports a network error when the request fails or the reply is not JSON', async () => {
    const offline: typeof fetch = async () => { throw new TypeError('Failed to fetch') }
    const network = { ok: false, error: 'Network error. Check connection and try again.' }
    expect(await postSale(payload, offline)).toEqual(network)
    expect(await postSale(payload, respond(502, '<html>Bad Gateway</html>'))).toEqual(network)
  })
})
