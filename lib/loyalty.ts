// Loyalty card rules, shared by the server (stamp counts, reward checks) and the POS.
// Only card holders collect stamps. A card's stamps are never stored: they are counted
// from the card holder's linked sales and the rewards those sales used.

export const LOYALTY_CARD_SIZE = 11
export const LOYALTY_TEN_OFF_AT = 6
/** Each drink from these categories earns one stamp, hot or iced. */
export const STAMP_CATEGORY_IDS: readonly string[] = ['signature', 'matcha-series']
/** The classic drinks: both rewards (10% off at stamp 6, free at 11) go on one unit of one of these. */
export const CLASSIC_DRINK_CATEGORY_IDS: readonly string[] = ['espresso', 'non-coffee']

export type LoyaltyReward = 'ten' | 'free'

/** The parts of an order line or saved sale item the rules look at. */
export interface StampLine {
  lineId: string
  qty: number
  categoryId?: string | null
  parentLineId?: string
  isAddon?: boolean
}

export interface CardTotals {
  /** Stamps earned on every linked order. */
  earned: number
  usedTen: number
  usedFree: number
}

export interface LoyaltyCard extends CardTotals {
  /** Stamps on the card in progress, 0–10. */
  onCard: number
  fullCards: number
  tenReady: number
  freeReady: number
}

export interface CardHolder {
  _id: string
  name: string
  cardNumber: number
  /** When the card was handed out (the document's _createdAt). */
  joinedAt: string
}

export interface CardHolderWithCard extends CardHolder {
  card: CardTotals
  orderCount: number
}

function isAddonLine(line: StampLine): boolean {
  return Boolean(line.isAddon || line.parentLineId || line.lineId.startsWith('addon__'))
}

export function stampsIn(lines: readonly StampLine[]): number {
  return lines.reduce(
    (n, l) => n + (!isAddonLine(l) && l.categoryId && STAMP_CATEGORY_IDS.includes(l.categoryId) ? l.qty : 0),
    0,
  )
}

export function isClassicDrinkLine(line: StampLine): boolean {
  return !isAddonLine(line) && Boolean(line.categoryId && CLASSIC_DRINK_CATEGORY_IDS.includes(line.categoryId))
}

/** How many classic drinks the order has: each reward takes one. */
export function classicUnitsIn(lines: readonly StampLine[]): number {
  return lines.reduce((n, l) => n + (isClassicDrinkLine(l) ? l.qty : 0), 0)
}

// Every 11 stamps fill a card and the next ones start a new card. Each card unlocks one
// 10% off at stamp 6 and one free drink at stamp 11; what is ready is unlocked minus used.
export function cardState(totals: CardTotals): LoyaltyCard {
  const fullCards = Math.floor(totals.earned / LOYALTY_CARD_SIZE)
  const onCard = totals.earned % LOYALTY_CARD_SIZE
  const tenUnlocked = fullCards + (onCard >= LOYALTY_TEN_OFF_AT ? 1 : 0)
  return {
    ...totals,
    onCard,
    fullCards,
    tenReady: Math.max(0, tenUnlocked - totals.usedTen),
    freeReady: Math.max(0, fullCards - totals.usedFree),
  }
}

export function cardTotals(
  sales: readonly { items?: readonly StampLine[] | null; loyaltyRewards?: readonly string[] | null }[],
): CardTotals {
  return sales.reduce<CardTotals>(
    (t, sale) => addOrderToTotals(t, stampsIn(sale.items ?? []), sale.loyaltyRewards ?? []),
    { earned: 0, usedTen: 0, usedFree: 0 },
  )
}

export function addOrderToTotals(totals: CardTotals, stamps: number, rewards: readonly string[]): CardTotals {
  return {
    earned: totals.earned + stamps,
    usedTen: totals.usedTen + (rewards.includes('ten') ? 1 : 0),
    usedFree: totals.usedFree + (rewards.includes('free') ? 1 : 0),
  }
}

/** "  KYLENE " and "kylene" are the same name: case and extra spaces don't matter. */
export function loyaltyKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

const CARD_NUMBER_QUERY = /^(?:no\.?\s*|#)?(\d{1,6})$/i

// Card holders for what was typed in Customer name: the one card number it names
// ("12", "#12", "No. 12"), or every name that starts with it, exact names first.
export function matchCardHolders<T extends CardHolder>(holders: readonly T[], query: string): T[] {
  const typed = query.trim()
  if (!typed) return []
  const byNumber = CARD_NUMBER_QUERY.exec(typed)
  if (byNumber) return holders.filter(h => h.cardNumber === Number(byNumber[1]))
  const key = loyaltyKey(typed)
  return holders
    .filter(h => loyaltyKey(h.name).startsWith(key))
    .sort((a, b) => {
      const exact = Number(loyaltyKey(b.name) === key) - Number(loyaltyKey(a.name) === key)
      return exact || a.cardNumber - b.cardNumber
    })
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return row[b.length]
}

// A spelling close to a card holder's name ("Kylen" for "Kylene"): short names allow one
// letter of difference, longer ones two. Used for "did you mean" hints only.
export function isNearMiss(typedKey: string, savedKey: string): boolean {
  if (typedKey === savedKey) return false
  const limit = Math.min(typedKey.length, savedKey.length) <= 4 ? 1 : 2
  return editDistance(typedKey, savedKey) <= limit
}

export function nextMilestone(onCard: number): string {
  if (onCard < LOYALTY_TEN_OFF_AT) return `${LOYALTY_TEN_OFF_AT - onCard} more for 10% off`
  return `${LOYALTY_CARD_SIZE - onCard} more for a free drink`
}

export type BarStep = 'saved' | 'new' | 'empty'

/** The stamp bar's 11 steps: stamps already saved, then this order's, then the rest. */
export function barSteps(saved: number, pending: number): { steps: BarStep[]; overflow: number } {
  const steps = Array.from({ length: LOYALTY_CARD_SIZE }, (_, i): BarStep =>
    i < saved ? 'saved' : i < saved + pending ? 'new' : 'empty')
  return { steps, overflow: Math.max(0, saved + pending - LOYALTY_CARD_SIZE) }
}

export interface SaleLoyalty {
  memberId: string
  rewards: LoyaltyReward[]
}

/**
 * The code POST /api/sales answers with when the linked card changed after the POS read it
 * (removed, or a reward used on another device), so the POS can read the cards again and
 * keep the order on screen.
 */
export const LOYALTY_CARD_CHANGED = 'loyalty-card-changed'

const MEMBER_ID = /^[A-Za-z0-9_-]{1,100}$/

/**
 * The loyalty part of a POST /api/sales body: null when no card holder is linked,
 * 'invalid' when it is malformed. A Sanity draft id ("drafts.…") is never valid.
 */
export function parseSaleLoyalty(body: { loyaltyMemberId?: unknown; loyaltyRewards?: unknown }): SaleLoyalty | null | 'invalid' {
  const { loyaltyMemberId: memberId, loyaltyRewards: rawRewards } = body
  if (memberId === undefined) return rawRewards === undefined ? null : 'invalid'
  if (typeof memberId !== 'string' || !MEMBER_ID.test(memberId)) return 'invalid'
  const rewards: unknown = rawRewards ?? []
  if (!Array.isArray(rewards) || rewards.some(r => r !== 'ten' && r !== 'free') || new Set(rewards).size !== rewards.length) {
    return 'invalid'
  }
  return { memberId, rewards: rewards as LoyaltyReward[] }
}

/** Why a reward on this order can't be used (its stamps count straight away), or null when they all can. */
export function rewardProblem(totals: CardTotals, orderStamps: number, rewards: readonly LoyaltyReward[]): string | null {
  const card = cardState({ ...totals, earned: totals.earned + orderStamps })
  if (rewards.includes('ten') && card.tenReady < 1) return 'This card has no 10% off ready.'
  if (rewards.includes('free') && card.freeReady < 1) return 'This card has no free drink ready.'
  return null
}

/** The POS suggests names from two typed characters, so a card name needs at least that many. */
export const MIN_CARD_NAME_LENGTH = 2
export const MAX_CARD_NAME_LENGTH = 60
// Letters (any script), accents, digits, spaces and . , ' ’ & ( ) - only.
const CARD_NAME_CHARACTERS = new RegExp(String.raw`^[\p{L}\p{M}\p{N} .,'’&()-]+$`, 'u')
const HAS_LETTER = new RegExp(String.raw`\p{L}`, 'u')

/** A card holder's name as it is saved: trimmed, with single spaces. */
export function cleanCardHolderName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/**
 * Why a name can't go on a loyalty card, or null when it can. It is printed on receipts,
 * and the thermal printer reads some symbols (arrows, for one) as commands, so only
 * letters, numbers and simple punctuation are allowed. It needs a letter beyond "No.",
 * or a card-number search ("No. 12") would hide it.
 */
export function cardHolderNameProblem(raw: string): string | null {
  const name = cleanCardHolderName(raw)
  if (name.length < MIN_CARD_NAME_LENGTH || name.length > MAX_CARD_NAME_LENGTH) {
    return `Enter the name on the card: ${MIN_CARD_NAME_LENGTH} to ${MAX_CARD_NAME_LENGTH} characters.`
  }
  if (!CARD_NAME_CHARACTERS.test(name)) return 'Use letters, numbers and simple punctuation only.'
  if (CARD_NUMBER_QUERY.test(name) || !HAS_LETTER.test(name.replace(/^no\.?\s*/i, ''))) {
    return 'The name needs at least one letter, other than “No.”.'
  }
  return null
}
