import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import LoyaltyCardsModal from './LoyaltyCardsModal'
import type { CardHolderWithCard } from '@/lib/loyalty'

const kylene: CardHolderWithCard = {
  _id: 'k', name: 'Kylene', cardNumber: 12, joinedAt: '2026-10-02T03:00:00Z', card: { earned: 5, usedTen: 0, usedFree: 0 }, orderCount: 2,
}
const noop = () => {}
const panel = (holders: CardHolderWithCard[] | null) =>
  renderToStaticMarkup(<LoyaltyCardsModal holders={holders} onHoldersChange={noop} onClose={noop} />)

describe('LoyaltyCardsModal', () => {
  it('shows the cards the POS already has, and the form to give one', () => {
    const html = panel([kylene])
    expect(html).toContain('role="dialog"')
    expect(html).toContain('Loyalty Cards')
    expect(html).toContain('Give a card')
    expect(html).toContain('No. 12')
    expect(html).toContain('1 card given out')
  })

  it('waits for the cards when the POS has none yet', () => {
    expect(panel(null)).toMatch(/<button[^>]*disabled=""[^>]*>Give card/)
  })
})
