import { describe, it, expect, vi } from 'vitest'
import { createServeQueue } from './serveQueue'

/** A change whose reply comes when the test says, true when it went through. */
function reply() {
  let settle: (ok: boolean) => void = () => {}
  const promise = new Promise<boolean>(resolve => {
    settle = resolve
  })
  return { promise, settle }
}

const settled = () => new Promise(resolve => setTimeout(resolve, 0))

describe('createServeQueue', () => {
  it('sends an order’s changes one at a time, in the order they were made', async () => {
    const queue = createServeQueue(() => {})
    const sent: string[] = []
    const first = reply()
    queue.push('bea', () => (sent.push('latte'), first.promise))
    queue.push('bea', async () => (sent.push('fries'), true))
    await settled()
    expect(sent).toEqual(['latte'])
    first.settle(true)
    await settled()
    expect(sent).toEqual(['latte', 'fries'])
  })

  it('sends different orders’ changes side by side', async () => {
    const queue = createServeQueue(() => {})
    const sent: string[] = []
    queue.push('bea', () => (sent.push('bea'), reply().promise))
    queue.push('migs', () => (sent.push('migs'), reply().promise))
    await settled()
    expect(sent).toEqual(['bea', 'migs'])
  })

  it('drops an order’s waiting changes when one fails, but not another order’s', async () => {
    const queue = createServeQueue(() => {})
    const sent: string[] = []
    const bea = reply()
    const migs = reply()
    queue.push('bea', () => (sent.push('bea latte'), bea.promise))
    queue.push('bea', async () => (sent.push('bea fries'), true))
    queue.push('migs', () => (sent.push('migs americano'), migs.promise))
    queue.push('migs', async () => (sent.push('migs undo'), true))
    bea.settle(false)
    migs.settle(true)
    await settled()
    expect(sent).toEqual(['bea latte', 'migs americano', 'migs undo'])
  })

  it('counts a change that throws as failed', async () => {
    const queue = createServeQueue(() => {})
    const sent: string[] = []
    queue.push('bea', async () => {
      throw new Error('no reply')
    })
    queue.push('bea', async () => (sent.push('fries'), true))
    await settled()
    expect(sent).toEqual([])
  })

  it('is busy until every order’s changes are done, then says so once', async () => {
    const onIdle = vi.fn()
    const queue = createServeQueue(onIdle)
    expect(queue.busy()).toBe(false)
    const bea = reply()
    const migs = reply()
    queue.push('bea', () => bea.promise)
    queue.push('bea', async () => true)
    queue.push('migs', () => migs.promise)
    expect(queue.busy()).toBe(true)
    bea.settle(true)
    await settled()
    expect(onIdle).not.toHaveBeenCalled()
    expect(queue.busy()).toBe(true)
    migs.settle(false)
    await settled()
    expect(onIdle).toHaveBeenCalledTimes(1)
    expect(queue.busy()).toBe(false)
  })

  it('sends a change made after the order went quiet straight away', async () => {
    const onIdle = vi.fn()
    const queue = createServeQueue(onIdle)
    const sent: string[] = []
    queue.push('bea', async () => (sent.push('latte'), false))
    await settled()
    queue.push('bea', async () => (sent.push('latte again'), true))
    await settled()
    expect(sent).toEqual(['latte', 'latte again'])
    expect(onIdle).toHaveBeenCalledTimes(2)
  })
})
