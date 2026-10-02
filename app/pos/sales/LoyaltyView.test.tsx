import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CardHolderList, GiveCardForm } from './LoyaltyView'
import type { CardHolderWithCard } from '@/lib/loyalty'

// LoyaltyView pulls in ManagerPinModal → PinPad only; nothing needs Next's runtime, but keep
// the font loader mocked in case a shared import reaches ReceiptPreview.
vi.mock('next/font/google', () => ({ IBM_Plex_Mono: () => ({ className: '' }) }))

const holder = (id: string, name: string, cardNumber: number, earned: number, usedTen = 0, usedFree = 0): CardHolderWithCard => ({
  _id: id, name, cardNumber, joinedAt: '2026-10-02T03:00:00Z', card: { earned, usedTen, usedFree }, orderCount: 2,
})
const holders = [holder('k', 'Kylene', 12, 5), holder('p', 'Paolo', 3, 6), holder('a', 'Ana', 1, 13, 1)]
const noop = () => {}

describe('CardHolderList', () => {
  const list = (confirmingId: string | null = null) => renderToStaticMarkup(
    <CardHolderList holders={holders} confirmingId={confirmingId} onRequestRemove={noop} onCancelRemove={noop} onConfirmRemove={noop} />,
  )

  it('shows each card with its number, stamps on the current card and what is ready', () => {
    const html = list()
    expect(html).toContain('No. 12')
    expect(html).toContain('5/11')
    expect(html).toContain('1 more for 10% off')
    expect(html).toContain('10% off ready')
    expect(html).toContain('Free drink ready')
    expect(html.match(/data-step=/g)).toHaveLength(33)
  })

  it('asks before removing a card, saying what would be lost', () => {
    expect(list()).not.toContain('Remove Kylene’s card No. 12?')
    expect(list('k')).toContain('Remove Kylene’s card No. 12? Its 5 stamps will be lost.')
    // Ana: 13 stamps with one 10% used → 2 on the card and the free drink ready.
    expect(list('a')).toContain('Its 2 stamps and the free drink ready will be lost.')
  })

  it('names each Remove button after its card', () => {
    expect(list()).toContain('aria-label="Remove Paolo’s card No. 3"')
  })
})

describe('GiveCardForm', () => {
  const form = (draft: string) => renderToStaticMarkup(
    <GiveCardForm draft={draft} onDraftChange={noop} holders={holders} onSubmit={noop} />,
  )

  it('needs a name of two or more characters before a card can be given', () => {
    expect(form('  ')).toMatch(/<button[^>]*disabled=""[^>]*>Give card/)
    expect(form('K')).toMatch(/<button[^>]*disabled=""[^>]*>Give card/)
    expect(form('K')).not.toContain('Enter the name on the card')
    expect(form('Kylene R.')).not.toMatch(/<button[^>]*disabled=""/)
  })

  it('waits for the cards to load, so a name already on a card is always caught', () => {
    const loading = renderToStaticMarkup(<GiveCardForm draft="Ana" onDraftChange={noop} holders={null} onSubmit={noop} />)
    expect(loading).toMatch(/<button[^>]*disabled=""[^>]*>Give card/)
  })

  it('points out a name that already has a card, whose number tells them apart', () => {
    expect(form('kylene')).toContain('Kylene already has card No. 12')
  })

  it('needs no manager PIN to give a card', () => {
    expect(form('Ana')).not.toContain('PIN')
  })

  it('shows the card being saved, and why one could not be given', () => {
    const saving = renderToStaticMarkup(<GiveCardForm draft="Ana" onDraftChange={noop} holders={holders} busy onSubmit={noop} />)
    expect(saving).toContain('aria-busy="true"')
    const refused = renderToStaticMarkup(
      <GiveCardForm draft="Ana" onDraftChange={noop} holders={holders} error="signed out · reload the page" onSubmit={noop} />,
    )
    expect(refused).toContain('signed out · reload the page')
  })

  it('will not give a card to a name the receipt printer cannot print', () => {
    const html = form('Kylene ←')
    expect(html).toContain('Use letters, numbers and simple punctuation only.')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Give card/)
  })
})
