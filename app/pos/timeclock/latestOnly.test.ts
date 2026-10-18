import { describe, it, expect } from 'vitest'
import { latestOnly } from './latestOnly'

// A read whose answer the test hands over when it chooses.
function deferredRead() {
  const pending: (() => void)[] = []
  const read = (label: string) => new Promise<string>(resolve => pending.push(() => resolve(label)))
  return { read, answer: (index: number) => pending[index]() }
}

describe('latestOnly', () => {
  it('drops an earlier read that answers after a later one', async () => {
    const { read, answer } = deferredRead()
    const latest = latestOnly(read)
    const first = latest('after John clocked in')
    const second = latest('after Ana clocked in')
    answer(1)
    answer(0)
    expect(await second).toEqual({ latest: true, value: 'after Ana clocked in' })
    expect(await first).toEqual({ latest: false })
  })

  it('uses each read when they answer in order', async () => {
    const latest = latestOnly(async (n: number) => n * 2)
    expect(await latest(1)).toEqual({ latest: true, value: 2 })
    expect(await latest(2)).toEqual({ latest: true, value: 4 })
  })
})
