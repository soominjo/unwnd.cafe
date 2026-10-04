import { describe, it, expect } from 'vitest'
import {
  LOYALTY_CARD_SIZE,
  stampsIn,
  isClassicDrinkLine,
  classicUnitsIn,
  cardState,
  cardTotals,
  addOrderToTotals,
  loyaltyKey,
  matchCardHolders,
  isNearMiss,
  nextMilestone,
  barSteps,
  formatStamps,
  stampCount,
  isTenOffLine,
  rewardsFitOrder,
  type BarStep,
  parseSaleLoyalty,
  rewardProblem,
  cardHolderNameProblem,
  type CardHolder,
  type StampLine,
} from './loyalty'

const line = (categoryId: string | undefined, qty: number, extra: Partial<StampLine> = {}): StampLine =>
  ({ ...extra, lineId: `${categoryId ?? 'x'}-${qty}-${extra.lineId ?? ''}`, categoryId, qty })

// The new stamp rules start on Oct 5, 2026, 12:00 AM in Manila (Oct 4, 4:00 PM UTC).
const BEFORE = '2026-10-04T15:59:59Z'
const AFTER = '2026-10-04T16:00:00Z'

describe('stampsIn', () => {
  it('from Oct 5 in Manila: 1 for Signature, Matcha Series and Meal; ½ for Espresso, Non-Coffee, Waffle and Snack', () => {
    expect(stampsIn([line('signature', 2), line('matcha-series', 1), line('meal', 1)], AFTER)).toBe(4)
    expect(stampsIn([line('espresso', 1), line('non-coffee', 1), line('waffle', 1), line('snack', 1)], AFTER)).toBe(2)
    // Two half-stamp items make one stamp.
    expect(stampsIn([line('espresso', 1), line('snack', 1)], AFTER)).toBe(1)
    expect(stampsIn([line('waffle', 1)], AFTER)).toBe(0.5)
  })

  it('counts the order on screen, which has no date yet, by the new rules', () => {
    expect(stampsIn([line('espresso', 3)])).toBe(1.5)
  })

  it('keeps the old rules for orders before then: 1 for Signature and Matcha Series, nothing else', () => {
    // The owner's example when cards began: 2 Signature + 1 Espresso + 3 Matcha Series = 5.
    expect(stampsIn([line('signature', 2), line('espresso', 1), line('matcha-series', 3), line('meal', 2), line('snack', 1)], BEFORE)).toBe(5)
  })

  it('counts items added to an older order later by the new rules', () => {
    expect(stampsIn([line('espresso', 1), line('waffle', 1, { lineId: 'w', addedAt: AFTER })], BEFORE)).toBe(0.5)
  })

  it('counts a missing or unreadable date by the new rules, and a line with no added date by its sale’s', () => {
    for (const date of [undefined, null, '', 'not a date']) expect(stampsIn([line('waffle', 2)], date)).toBe(1)
    expect(stampsIn([line('espresso', 1, { lineId: 'e', addedAt: null })], BEFORE)).toBe(0)
  })

  it('counts no add-ons or lines without a category', () => {
    expect(stampsIn([
      line(undefined, 2),
      { lineId: 'addon__shot__a', categoryId: 'signature', qty: 1, parentLineId: 'a' },
      { lineId: 'addon__shot', categoryId: 'waffle', qty: 1, isAddon: true },
    ], AFTER)).toBe(0)
  })
})

describe('isTenOffLine', () => {
  it('is an Espresso, Non-Coffee, Waffle or Snack item: what the 10% can go on, never an add-on', () => {
    for (const id of ['espresso', 'non-coffee', 'waffle', 'snack']) expect(isTenOffLine(line(id, 1))).toBe(true)
    for (const id of ['signature', 'matcha-series', 'meal']) expect(isTenOffLine(line(id, 1))).toBe(false)
    expect(isTenOffLine({ lineId: 'addon__cream__a', categoryId: 'waffle', qty: 1, parentLineId: 'a' })).toBe(false)
  })
})

describe('rewardsFitOrder', () => {
  it('needs an Espresso or Non-Coffee drink for the free drink, and another unit the 10% can go on for the 10%', () => {
    expect(rewardsFitOrder([line('waffle', 1)], ['ten'])).toBe(true)
    expect(rewardsFitOrder([line('waffle', 1)], ['free'])).toBe(false)
    expect(rewardsFitOrder([line('espresso', 1)], ['ten', 'free'])).toBe(false)
    expect(rewardsFitOrder([line('espresso', 1), line('snack', 1)], ['ten', 'free'])).toBe(true)
    expect(rewardsFitOrder([line('espresso', 2)], ['ten', 'free'])).toBe(true)
    expect(rewardsFitOrder([line('signature', 2), line('meal', 1)], ['ten'])).toBe(false)
    expect(rewardsFitOrder([line('signature', 2)], [])).toBe(true)
  })
})

describe('isClassicDrinkLine', () => {
  it('is any Espresso or Non-Coffee drink, never Signature, Matcha Series or an add-on', () => {
    expect(isClassicDrinkLine(line('espresso', 1))).toBe(true)
    expect(isClassicDrinkLine(line('non-coffee', 1))).toBe(true)
    expect(isClassicDrinkLine(line('signature', 1))).toBe(false)
    expect(isClassicDrinkLine(line('matcha-series', 1))).toBe(false)
    expect(isClassicDrinkLine({ lineId: 'addon__milk__a', categoryId: 'espresso', qty: 1, parentLineId: 'a' })).toBe(false)
  })
})

describe('classicUnitsIn', () => {
  it('counts the classic drinks a reward can go on, one per unit', () => {
    expect(classicUnitsIn([line('espresso', 2), line('non-coffee', 1), line('signature', 3)])).toBe(3)
    expect(classicUnitsIn([line('signature', 1), { lineId: 'addon__milk__a', categoryId: 'espresso', qty: 1, parentLineId: 'a' }])).toBe(0)
  })
})

describe('cardState', () => {
  it('fills one card of 11: 10% at stamp 6, the free drink at 11, then a new card', () => {
    expect(cardState({ earned: 5, usedTen: 0, usedFree: 0 })).toMatchObject({ onCard: 5, fullCards: 0, tenReady: 0, freeReady: 0 })
    expect(cardState({ earned: 6, usedTen: 0, usedFree: 0 })).toMatchObject({ onCard: 6, tenReady: 1, freeReady: 0 })
    expect(cardState({ earned: 11, usedTen: 0, usedFree: 0 })).toMatchObject({ onCard: 0, fullCards: 1, tenReady: 1, freeReady: 1 })
  })

  it('holds half stamps: 5½ is short of the 10%, 10½ of the free drink, and 11½ starts a new card', () => {
    expect(cardState({ earned: 5.5, usedTen: 0, usedFree: 0 })).toMatchObject({ onCard: 5.5, tenReady: 0 })
    expect(cardState({ earned: 10.5, usedTen: 0, usedFree: 0 })).toMatchObject({ onCard: 10.5, fullCards: 0, tenReady: 1, freeReady: 0 })
    expect(cardState({ earned: 11.5, usedTen: 0, usedFree: 0 })).toMatchObject({ onCard: 0.5, fullCards: 1, freeReady: 1 })
  })

  it('takes used rewards off, keeps an unused 10% after the card fills, and never goes below zero', () => {
    expect(cardState({ earned: 13, usedTen: 1, usedFree: 1 })).toMatchObject({ onCard: 2, tenReady: 0, freeReady: 0 })
    expect(cardState({ earned: 17, usedTen: 0, usedFree: 1 })).toMatchObject({ onCard: 6, tenReady: 2, freeReady: 0 })
    expect(cardState({ earned: 3, usedTen: 1, usedFree: 0 }).tenReady).toBe(0)
  })
})

describe('cardTotals', () => {
  it('adds up stamps, each sale by the rules of its date, and the rewards each linked sale used', () => {
    const sales = [
      { _createdAt: BEFORE, items: [line('signature', 4), line('espresso', 2)], loyaltyRewards: [] },
      { _createdAt: AFTER, items: [line('matcha-series', 3), line('espresso', 1)], loyaltyRewards: ['ten'] },
      { _createdAt: AFTER, items: [line('espresso', 1)], loyaltyRewards: ['free'] },
      { _createdAt: AFTER, items: [line('meal', 1)] },
    ]
    // 4 (the Espressos before Oct 5 earn nothing) + 3½ + ½ + 1.
    expect(cardTotals(sales)).toEqual({ earned: 9, usedTen: 1, usedFree: 1 })
  })
})

describe('addOrderToTotals', () => {
  it('adds a new order’s stamps and rewards without touching the original', () => {
    const before = { earned: 5, usedTen: 0, usedFree: 0 }
    expect(addOrderToTotals(before, 2, ['ten'])).toEqual({ earned: 7, usedTen: 1, usedFree: 0 })
    expect(before.earned).toBe(5)
  })
})

describe('matching card holders', () => {
  const holders: CardHolder[] = [
    { _id: 'a', name: 'Kylene', cardNumber: 12, joinedAt: '2026-10-02T00:00:00Z' },
    { _id: 'b', name: 'Kyle', cardNumber: 3, joinedAt: '2026-09-01T00:00:00Z' },
    { _id: 'c', name: 'Kylene', cardNumber: 4, joinedAt: '2026-08-01T00:00:00Z' },
    { _id: 'd', name: 'Maria Santos', cardNumber: 7, joinedAt: '2026-08-01T00:00:00Z' },
  ]

  it('ignores capitals and extra spaces', () => {
    expect(loyaltyKey('  MARIA   Santos ')).toBe('maria santos')
  })

  it('finds holders by the start of their name, exact names first, then by card number', () => {
    expect(matchCardHolders(holders, 'KYLENE').map(h => h.cardNumber)).toEqual([4, 12])
    expect(matchCardHolders(holders, 'kyl').map(h => h.cardNumber)).toEqual([3, 4, 12])
    expect(matchCardHolders(holders, 'maria s').map(h => h._id)).toEqual(['d'])
  })

  it('finds a holder by card number, written as 12, #12 or No. 12', () => {
    for (const q of ['12', '#12', 'No. 12', 'no 12']) {
      expect(matchCardHolders(holders, q).map(h => h._id)).toEqual(['a'])
    }
  })

  it('finds nothing for an empty query', () => {
    expect(matchCardHolders(holders, '   ')).toEqual([])
  })

  it('flags near-miss spellings for "did you mean"', () => {
    expect(isNearMiss('kylen', 'kylene')).toBe(true)
    expect(isNearMiss('trisha', 'tricia')).toBe(true)
    expect(isNearMiss('john', 'johnny')).toBe(false)
    expect(isNearMiss('kylene', 'kylene')).toBe(false)
  })
})

// A step as one word when both of its halves are alike, else "first/second".
const look = (steps: BarStep[]) => steps.map(s => (s.first === s.second ? s.first : `${s.first}/${s.second}`)).join(',')

describe('writing stamps', () => {
  it('writes a half stamp as ½', () => {
    expect([0, 0.5, 1, 1.5, 6, 6.5, 10.5].map(formatStamps)).toEqual(['0', '½', '1', '1½', '6', '6½', '10½'])
    expect([0, 0.5, 1, 1.5, 2].map(stampCount)).toEqual(['0 stamps', '½ stamp', '1 stamp', '1½ stamps', '2 stamps'])
  })
})

describe('the stamp bar', () => {
  it('says what the next reward needs, halves included', () => {
    expect(nextMilestone(5)).toBe('1 more for 10% off')
    expect(nextMilestone(8)).toBe('3 more for a free drink')
    expect(nextMilestone(5.5)).toBe('½ more for 10% off')
    expect(nextMilestone(8.5)).toBe('2½ more for a free drink')
  })

  it('draws saved stamps, then this order’s, and counts any that spill onto a new card', () => {
    const { steps, overflow } = barSteps(5, 3)
    expect(steps).toHaveLength(LOYALTY_CARD_SIZE)
    expect(look(steps)).toBe('saved,saved,saved,saved,saved,new,new,new,empty,empty,empty')
    expect(overflow).toBe(0)
    expect(barSteps(9, 4).overflow).toBe(2)
  })

  it('fills half a step for a half stamp, saved ones first', () => {
    // 5½ saved and 1½ from this order: the 6th step is half saved, half new.
    expect(look(barSteps(5.5, 1.5).steps)).toBe('saved,saved,saved,saved,saved,saved/new,new,empty,empty,empty,empty')
    expect(look(barSteps(0, 0.5).steps)).toBe('new/empty,empty,empty,empty,empty,empty,empty,empty,empty,empty,empty')
    expect(barSteps(10.5, 1).overflow).toBe(0.5)
  })
})

describe('the loyalty part of a sale', () => {
  it('reads the linked card holder and the rewards used', () => {
    expect(parseSaleLoyalty({ loyaltyMemberId: 'abc123', loyaltyRewards: ['ten', 'free'] })).toEqual({ memberId: 'abc123', rewards: ['ten', 'free'] })
    expect(parseSaleLoyalty({ loyaltyMemberId: 'abc123' })).toEqual({ memberId: 'abc123', rewards: [] })
    expect(parseSaleLoyalty({})).toBeNull()
  })

  it('refuses a malformed id, an unknown or repeated reward, or rewards without a card holder', () => {
    expect(parseSaleLoyalty({ loyaltyMemberId: 'drafts.abc' })).toBe('invalid')
    expect(parseSaleLoyalty({ loyaltyMemberId: 42 })).toBe('invalid')
    expect(parseSaleLoyalty({ loyaltyMemberId: 'abc', loyaltyRewards: ['twenty'] })).toBe('invalid')
    expect(parseSaleLoyalty({ loyaltyMemberId: 'abc', loyaltyRewards: ['ten', 'ten'] })).toBe('invalid')
    expect(parseSaleLoyalty({ loyaltyRewards: ['ten'] })).toBe('invalid')
  })

  it('checks each reward is ready, counting this order’s stamps straight away', () => {
    const five = { earned: 5, usedTen: 0, usedFree: 0 }
    expect(rewardProblem(five, 0, ['ten'])).toBe('This card has no 10% off ready.')
    expect(rewardProblem(five, 1, ['ten'])).toBeNull()
    expect(rewardProblem({ earned: 6, usedTen: 1, usedFree: 0 }, 0, ['ten'])).toBe('This card has no 10% off ready.')
    expect(rewardProblem({ earned: 10, usedTen: 1, usedFree: 0 }, 1, ['free'])).toBeNull()
    expect(rewardProblem(five, 3, [])).toBeNull()
  })
})

describe('cardHolderNameProblem', () => {
  it('accepts names with letters, accents, numbers and simple punctuation', () => {
    for (const name of ['Kylene R.', 'María José', "O'Brien", 'Ana-Liza', 'Ñino 2', 'Jo & Mae (Twins)']) {
      expect(cardHolderNameProblem(name)).toBeNull()
    }
  })

  it('refuses symbols the receipt printer could read as commands, invisible names and names without a letter', () => {
    expect(cardHolderNameProblem('←p022')).toBe('Use letters, numbers and simple punctuation only.')
    expect(cardHolderNameProblem('​​')).toBe('Use letters, numbers and simple punctuation only.')
    expect(cardHolderNameProblem('No. 12')).toBe('The name needs at least one letter, other than “No.”.')
    expect(cardHolderNameProblem('12')).toBe('The name needs at least one letter, other than “No.”.')
  })

  it('needs 2 to 60 characters, as the POS suggests names from two', () => {
    const tooShortOrLong = 'Enter the name on the card: 2 to 60 characters.'
    expect(cardHolderNameProblem('   ')).toBe(tooShortOrLong)
    expect(cardHolderNameProblem(' J ')).toBe(tooShortOrLong)
    expect(cardHolderNameProblem('a'.repeat(61))).toBe(tooShortOrLong)
    expect(cardHolderNameProblem('Jo')).toBeNull()
  })
})
