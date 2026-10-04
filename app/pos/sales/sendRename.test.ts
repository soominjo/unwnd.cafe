import { describe, it, expect, vi } from 'vitest'
import { RENAME_MESSAGES, sendRename } from './sendRename'

const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe('sendRename', () => {
  it('saves the name on the order, with PATCH and the name as the notes', async () => {
    const fetchImpl = reply(200, { success: true, notes: 'Ana' })
    expect(await sendRename('sale-2', 'Ana', fetchImpl)).toEqual({ error: null })
    expect(fetchImpl).toHaveBeenCalledWith('/api/sales/sale-2', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Ana' }),
    })
  })

  it('says the order is gone when it was deleted on another device', async () => {
    expect(await sendRename('sale-2', 'Ana', reply(404, { success: false, error: 'Order not found' }))).toEqual({ error: RENAME_MESSAGES.gone, gone: true })
  })

  it('gives the route’s reason for a name it refused', async () => {
    const refused = reply(400, { success: false, error: 'An order on a loyalty card keeps the card holder’s name.' })
    expect(await sendRename('sale-3', 'Ana', refused)).toEqual({ error: 'An order on a loyalty card keeps the card holder’s name.' })
  })

  it('says it failed when the reply is not the POS’s own, such as a gateway’s error page', async () => {
    const gateway = vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 }))
    expect(await sendRename('sale-2', 'Ana', gateway)).toEqual({ error: RENAME_MESSAGES.failed })
  })

  it('says so when no reply came', async () => {
    const offline = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    expect(await sendRename('sale-2', 'Ana', offline)).toEqual({ error: RENAME_MESSAGES.offline })
  })
})
