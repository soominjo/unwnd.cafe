import { describe, it, expect } from 'vitest'
import { saleRounds } from './rounds'

const line = (lineId: string, addedAt?: string) => ({ lineId, ...(addedAt ? { addedAt } : {}) })

describe('saleRounds', () => {
  it('splits an order’s lines by when they were ordered: the first checkout, then each Add items save', () => {
    const items = [line('a'), line('b'), line('c', '2026-10-03T06:31:00Z'), line('d', '2026-10-03T06:31:00Z'), line('e', '2026-10-03T06:45:00Z')]
    expect(saleRounds(items)).toEqual([
      { addedAt: null, items: [line('a'), line('b')] },
      { addedAt: '2026-10-03T06:31:00Z', items: [line('c', '2026-10-03T06:31:00Z'), line('d', '2026-10-03T06:31:00Z')] },
      { addedAt: '2026-10-03T06:45:00Z', items: [line('e', '2026-10-03T06:45:00Z')] },
    ])
  })

  it('is one group for an order nothing was added to, and keeps added lines whose first lines were taken off', () => {
    expect(saleRounds([line('a'), line('b')])).toEqual([{ addedAt: null, items: [line('a'), line('b')] }])
    expect(saleRounds([line('c', '2026-10-03T06:31:00Z')])).toEqual([{ addedAt: '2026-10-03T06:31:00Z', items: [line('c', '2026-10-03T06:31:00Z')] }])
  })
})
