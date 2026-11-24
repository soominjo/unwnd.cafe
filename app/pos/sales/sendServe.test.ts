import { describe, it, expect, vi } from 'vitest'
import { sendServe } from './sendServe'

const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }))
const offline = () => vi.fn(async () => { throw new TypeError('Failed to fetch') })
const gateway = () => vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 }))

const patch = (body: unknown) =>
  expect.objectContaining({
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

/** A request that never answers: it only ends when it is called off. */
const hung = () =>
  vi.fn(
    (...[, init]: Parameters<typeof fetch>) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
      }),
  )

describe('sendServe', () => {
  it('ticks lines as served with their line ids', async () => {
    const fetchImpl = reply(200, { success: true, isCompleted: false, servedAt: '2026-11-24T11:46:00.000Z' })
    expect(await sendServe('sale-1', { kind: 'serve', lineIds: ['classic-fries'] }, fetchImpl)).toEqual({ error: null })
    expect(fetchImpl).toHaveBeenCalledWith('/api/sales/sale-1', patch({ serveLineIds: ['classic-fries'] }))
  })

  it('moves lines back to still to serve with their line ids', async () => {
    const fetchImpl = reply(200, { success: true, isCompleted: false, servedAt: null })
    expect(await sendServe('sale-1', { kind: 'unserve', lineIds: ['latte', 'nachos'] }, fetchImpl)).toEqual({ error: null })
    expect(fetchImpl).toHaveBeenCalledWith('/api/sales/sale-1', patch({ unserveLineIds: ['latte', 'nachos'] }))
  })

  it('completes the order with markCompleted, which ticks every line left', async () => {
    const fetchImpl = reply(200, { success: true })
    expect(await sendServe('sale-1', { kind: 'complete' }, fetchImpl)).toEqual({ error: null })
    expect(fetchImpl).toHaveBeenCalledWith('/api/sales/sale-1', patch({ markCompleted: true }))
  })

  it('says the order is gone when it was deleted on another device', async () => {
    const gone = reply(404, { success: false, error: 'Order not found' })
    expect(await sendServe('sale-1', { kind: 'serve', lineIds: ['classic-fries'] }, gone)).toEqual({
      error: 'That order was deleted on another device.',
      gone: true,
    })
  })

  it('gives the route’s reason, such as a change made on another device', async () => {
    const clash = reply(409, { success: false, error: 'This order changed on another device. Refresh, then try again.' })
    expect(await sendServe('sale-1', { kind: 'serve', lineIds: ['classic-fries'] }, clash)).toEqual({
      error: 'This order changed on another device. Refresh, then try again.',
    })
  })

  it('says what failed when the reply is not the POS’s own, such as a gateway’s error page', async () => {
    expect(await sendServe('sale-1', { kind: 'serve', lineIds: ['fries'] }, gateway())).toEqual({ error: 'Could not mark the item served.' })
    expect(await sendServe('sale-1', { kind: 'unserve', lineIds: ['fries'] }, gateway())).toEqual({ error: 'Could not move the item back to Recent.' })
    expect(await sendServe('sale-1', { kind: 'complete' }, gateway())).toEqual({ error: 'Failed to complete order.' })
  })

  it('counts the items in what failed: an Undo of Complete moves several back', async () => {
    expect(await sendServe('sale-1', { kind: 'unserve', lineIds: ['latte', 'fries'] }, gateway())).toEqual({ error: 'Could not move the items back to Recent.' })
    expect(await sendServe('sale-1', { kind: 'serve', lineIds: ['latte', 'fries'] }, offline())).toEqual({ error: 'Network error. Could not mark the items served.' })
  })

  it('treats a reply that is not a success as failed, even with a 200', async () => {
    expect(await sendServe('sale-1', { kind: 'complete' }, reply(200, { success: false }))).toEqual({ error: 'Failed to complete order.' })
  })

  it('gives up when no reply comes in time, as when the wifi drops mid-request', async () => {
    expect(await sendServe('sale-1', { kind: 'serve', lineIds: ['fries'] }, hung(), 20)).toEqual({ error: 'Network error. Could not mark the item served.' })
  })

  it('says so when no reply came', async () => {
    expect(await sendServe('sale-1', { kind: 'serve', lineIds: ['fries'] }, offline())).toEqual({ error: 'Network error. Could not mark the item served.' })
    expect(await sendServe('sale-1', { kind: 'unserve', lineIds: ['fries'] }, offline())).toEqual({ error: 'Network error. Could not move the item back to Recent.' })
    expect(await sendServe('sale-1', { kind: 'complete' }, offline())).toEqual({ error: 'Network error. Could not complete order.' })
  })
})
