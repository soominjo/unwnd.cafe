import { describe, it, expect, vi } from 'vitest'
import { METHOD_CHANGE_MESSAGES, sendMethodChange } from './sendMethodChange'

const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe('sendMethodChange', () => {
  it('moves the payment to the method picked, with PATCH', async () => {
    const fetchImpl = reply(200, { success: true })
    expect(await sendMethodChange('sale-2', 'pay-0', 'card', fetchImpl)).toEqual({ error: null })
    expect(fetchImpl).toHaveBeenCalledWith('/api/sales/sale-2', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentKey: 'pay-0', method: 'card' }),
    })
  })

  it('says the order is gone when it was deleted on another device', async () => {
    expect(await sendMethodChange('sale-2', 'pay-0', 'card', reply(404, { success: false, error: 'Order not found' }))).toEqual({
      error: METHOD_CHANGE_MESSAGES.gone,
      gone: true,
    })
  })

  it('gives the route’s reason when the payment changed on another device', async () => {
    const changed = reply(409, { success: false, error: 'This payment changed on another device. Refresh, then try again.' })
    expect(await sendMethodChange('sale-2', 'pay-0', 'card', changed)).toEqual({ error: 'This payment changed on another device. Refresh, then try again.' })
  })

  it('says it failed on a reply that is not the POS’s own, and says so when no reply came', async () => {
    const gateway = vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 }))
    expect(await sendMethodChange('sale-2', 'pay-0', 'card', gateway)).toEqual({ error: METHOD_CHANGE_MESSAGES.failed })
    const offline = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    expect(await sendMethodChange('sale-2', 'pay-0', 'card', offline)).toEqual({ error: METHOD_CHANGE_MESSAGES.offline })
  })
})
