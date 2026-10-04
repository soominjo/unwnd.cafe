import { describe, it, expect, vi, beforeEach } from 'vitest'

const { read, create, remove, createIfNotExists, patch, inc, set } = vi.hoisted(() => ({
  read: vi.fn(), create: vi.fn(), remove: vi.fn(), createIfNotExists: vi.fn(), patch: vi.fn(), inc: vi.fn(), set: vi.fn(),
}))
vi.mock('@/sanity/lib/client', () => ({ client: { withConfig: () => ({ fetch: read }) } }))
vi.mock('@/sanity/lib/writeClient', () => ({ getWriteClient: () => ({ create, delete: remove, createIfNotExists, patch }) }))

import { addCardHolder, fetchCardHolders, fetchCardTotals, removeCardHolder } from './loyaltyStore'

const members = [
  { _id: 'kylene', name: 'Kylene', cardNumber: 1, _createdAt: '2026-10-02T03:00:00Z' },
  { _id: 'ben', name: 'Ben', cardNumber: 2, _createdAt: '2026-10-01T03:00:00Z' },
]
const linkedSales = [
  { loyaltyMemberId: 'kylene', loyaltyRewards: null, items: [{ lineId: 'a', qty: 2, categoryId: 'signature' }, { lineId: 'b', qty: 3, categoryId: 'matcha-series' }] },
  { loyaltyMemberId: 'kylene', loyaltyRewards: ['ten'], items: [{ lineId: 'c', qty: 1, categoryId: 'signature' }] },
  { loyaltyMemberId: 'gone', loyaltyRewards: null, items: [{ lineId: 'd', qty: 4, categoryId: 'signature' }] },
]

beforeEach(() => {
  read.mockReset()
  create.mockReset()
  remove.mockReset()
  createIfNotExists.mockReset()
  patch.mockReset()
  inc.mockReset()
  set.mockReset()
  patch.mockReturnValue({ inc, set })
  set.mockReturnValue({ commit: async () => ({}) })
})

// The card counter after its increment.
const counterAt = (last: number) => inc.mockReturnValue({ commit: async () => ({ last }) })

describe('fetchCardHolders', () => {
  it('gives each card holder the stamps and rewards of their own linked sales', async () => {
    read.mockImplementation(async (query: string) => (query.includes('"loyaltyMember"') ? members : linkedSales))
    expect(await fetchCardHolders()).toEqual([
      { _id: 'kylene', name: 'Kylene', cardNumber: 1, joinedAt: '2026-10-02T03:00:00Z', card: { earned: 6, usedTen: 1, usedFree: 0 }, orderCount: 2 },
      { _id: 'ben', name: 'Ben', cardNumber: 2, joinedAt: '2026-10-01T03:00:00Z', card: { earned: 0, usedTen: 0, usedFree: 0 }, orderCount: 0 },
    ])
  })
})

describe('fetchCardHolders, the stamp rules by date', () => {
  it('asks for each linked sale’s date and when each of its lines was added', async () => {
    read.mockImplementation(async (query: string) => (query.includes('"loyaltyMember"') ? members : []))
    await fetchCardHolders()
    const salesQuery = read.mock.calls.map(call => call[0] as string).find(query => query.includes('"sale"'))
    expect(salesQuery).toContain('_createdAt')
    expect(salesQuery).toContain('addedAt')
  })

  it('counts an Espresso from Oct 5 as half a stamp, and one from before as none', async () => {
    const sales = [
      { _createdAt: '2026-10-04T10:00:00Z', loyaltyMemberId: 'ben', loyaltyRewards: null, items: [{ lineId: 'e', qty: 1, categoryId: 'espresso' }] },
      { _createdAt: '2026-10-05T10:00:00Z', loyaltyMemberId: 'ben', loyaltyRewards: null, items: [{ lineId: 'f', qty: 1, categoryId: 'espresso' }] },
    ]
    read.mockImplementation(async (query: string) => (query.includes('"loyaltyMember"') ? members : sales))
    expect((await fetchCardHolders()).find(h => h._id === 'ben')?.card.earned).toBe(0.5)
  })
})

describe('fetchCardTotals', () => {
  it('counts one card holder’s sales, or gives null when there is no such card holder', async () => {
    read.mockResolvedValueOnce({ exists: true, sales: linkedSales.slice(0, 2) })
    expect(await fetchCardTotals('kylene')).toEqual({ earned: 6, usedTen: 1, usedFree: 0 })
    read.mockResolvedValueOnce({ exists: false, sales: [] })
    expect(await fetchCardTotals('nobody')).toBeNull()
  })
})

describe('addCardHolder', () => {
  beforeEach(() => {
    create.mockImplementation(async (doc: Record<string, unknown>) => ({ ...doc, _id: 'new-id', _createdAt: '2026-10-02T05:00:00Z' }))
  })

  it('gives the new card the counter’s next number', async () => {
    read.mockResolvedValueOnce(7)
    counterAt(8)
    const holder = await addCardHolder('Kylene R.')
    expect(createIfNotExists).toHaveBeenCalledWith({ _id: 'loyalty-card-counter', _type: 'loyaltyCardCounter', last: 7 })
    expect(inc).toHaveBeenCalledWith({ last: 1 })
    expect(create).toHaveBeenCalledWith({ _type: 'loyaltyMember', name: 'Kylene R.', cardNumber: 8 })
    expect(holder).toEqual({ _id: 'new-id', name: 'Kylene R.', cardNumber: 8, joinedAt: '2026-10-02T05:00:00Z', card: { earned: 0, usedTen: 0, usedFree: 0 }, orderCount: 0 })
  })

  it('starts the counter at 0 when no card was ever given, so the first card is No. 1', async () => {
    read.mockResolvedValueOnce(null)
    counterAt(1)
    expect((await addCardHolder('Ana')).cardNumber).toBe(1)
    expect(createIfNotExists).toHaveBeenCalledWith(expect.objectContaining({ last: 0 }))
  })

  it('never hands out a removed card’s number again', async () => {
    // No. 13 was removed, so the highest card left is 12, but the counter already stands at 13.
    read.mockResolvedValueOnce(12)
    counterAt(14)
    expect((await addCardHolder('Kylene R.')).cardNumber).toBe(14)
    expect(set).not.toHaveBeenCalled()
  })

  it('passes a card numbered by hand in Studio, and moves the counter past it', async () => {
    read.mockResolvedValueOnce(20)
    counterAt(9)
    expect((await addCardHolder('Ana')).cardNumber).toBe(21)
    expect(set).toHaveBeenCalledWith({ last: 21 })
  })
})

describe('removeCardHolder', () => {
  it('only ever deletes a loyalty card holder', async () => {
    remove.mockResolvedValueOnce({ results: [{ id: 'kylene' }] })
    expect(await removeCardHolder('kylene')).toBe(true)
    expect(remove).toHaveBeenCalledWith({ query: '*[_type == "loyaltyMember" && _id == $id]', params: { id: 'kylene' } })
    remove.mockResolvedValueOnce({ results: [] })
    expect(await removeCardHolder('a-sale-id')).toBe(false)
  })
})
