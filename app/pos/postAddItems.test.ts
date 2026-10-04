import { describe, it, expect } from 'vitest'
import { postAddItems } from './postAddItems'
import type { AddItemsBody } from '@/lib/sales/addItems'
import type { Sale } from './types'

const body: AddItemsBody = {
  rev: 'rev-9',
  items: [{ lineId: 'cafe-latte__hot__ak3j9', name: 'Cafe Latte', variant: 'hot', price: 120, qty: 1, categoryId: 'espresso' }],
}
const updated: Sale = {
  _id: 'sale-214', _rev: 'rev-10', _createdAt: '2026-10-03T06:14:00Z', total: 910, paymentAmount: 910, change: 0,
  items: [
    { lineId: 'tiramisu__ice', name: 'Tiramisu', variant: 'ice', price: 160, qty: 2 },
    { lineId: 'cafe-latte__hot__ak3j9', name: 'Cafe Latte', variant: 'hot', price: 120, qty: 1, addedAt: '2026-10-03T06:31:00.000Z' },
  ],
}

const respond = (status: number, reply: unknown): typeof fetch => async () =>
  new Response(typeof reply === 'string' ? reply : JSON.stringify(reply), { status })

describe('postAddItems', () => {
  it('POSTs the new lines to the order’s items and gives back the order as saved', async () => {
    let seen: { url: string; init?: RequestInit } | null = null
    const fetchImpl: typeof fetch = async (url, init) => {
      seen = { url: String(url), init }
      return new Response(JSON.stringify({ success: true, data: updated }), { status: 200 })
    }
    expect(await postAddItems('sale-214', body, fetchImpl)).toEqual({ ok: true, sale: updated })
    expect(seen).toEqual({
      url: '/api/sales/sale-214/items',
      init: { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    })
  })

  it('passes a refusal’s reason and code through, with the order as it now is when the server sends it', async () => {
    expect(await postAddItems('sale-214', body, respond(409, { success: false, code: 'order-changed', error: 'This order changed on another device.', data: updated })))
      .toEqual({ ok: false, error: 'This order changed on another device.', code: 'order-changed', sale: updated })
    expect(await postAddItems('sale-214', body, respond(409, { success: false, code: 'order-completed', error: 'This order was completed.' })))
      .toEqual({ ok: false, error: 'This order was completed.', code: 'order-completed' })
  })

  it('reports a lost reply as unsure: the items may have been saved', async () => {
    const offline: typeof fetch = async () => { throw new TypeError('Failed to fetch') }
    expect(await postAddItems('sale-214', body, offline)).toEqual({ ok: false, error: 'No reply. Check the order on Sales before trying again.', unsure: true })
    expect(await postAddItems('sale-214', body, respond(502, '<html>Bad Gateway</html>')))
      .toEqual({ ok: false, error: 'No reply. Check the order on Sales before trying again.', unsure: true })
  })

  it('falls back to a generic message when the server gives none', async () => {
    expect(await postAddItems('sale-214', body, respond(500, { success: false }))).toEqual({ ok: false, error: 'Could not add the items. Try again.' })
  })
})
