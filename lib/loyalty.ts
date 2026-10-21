// Loyalty card rules, shared by the server (stamp counts, reward checks) and the POS.
// Only card holders collect stamps. A card's stamps are never stored: they are counted
// from the card holder's linked sales and the rewards those sales used.

export const LOYALTY_CARD_SIZE = 11
export const LOYALTY_TEN_OFF_AT = 6
/** When today's stamp rules start: Oct 5, 2026, 12:00 AM in Manila. */
export const STAMP_RULES_FROM = '2026-10-04T16:00:00Z'
// What one item earns, hot or iced: a whole stamp, or half (two half-stamp items make one).
// Add-ons and any other category earn none.
const STAMPS_PER_ITEM = new Map<string, number>([
  ['signature', 1], ['matcha-series', 1], ['meal', 1],
  ['espresso', 0.5], ['non-coffee', 0.5], ['waffle', 0.5], ['snack', 0.5],
])
// Before STAMP_RULES_FROM: only Signature and Matcha Series earned, a stamp each. Orders from
// then keep counting that way, so no card changed when the rules did.
const STAMPS_PER_ITEM_BEFORE = new Map<string, number>([['signature', 1], ['matcha-series', 1]])
const STAMP_RULES_FROM_MS = Date.parse(STAMP_RULES_FROM)
/** The classic drinks: the free drink (at stamp 11) goes on one unit of one of these. */
export const CLASSIC_DRINK_CATEGORY_IDS: readonly string[] = ['espresso', 'non-coffee']
/** What the 10% off (at stamp 6) can go on: one unit of a classic drink, a Waffle or a Snack. */
export const TEN_OFF_CATEGORY_IDS: readonly string[] = ['espresso', 'non-coffee', 'waffle', 'snack']

export type LoyaltyReward = 'ten' | 'free'

/** The parts of an order line or saved sale item the rules look at. */
export interface StampLine {
  lineId: string
  qty: number
  categoryId?: string | null
  parentLineId?: string
  isAddon?: boolean
  /** When a line was added to a saved order (Add items): it counts by the rules of that time. */
  addedAt?: string | null
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

/** What one item of a category earns, by the rules of when it was ordered; the order on screen has no date yet. */
function stampsPerItem(categoryId: string, orderedAt: string | null | undefined): number {
  const before = orderedAt != null && Date.parse(orderedAt) < STAMP_RULES_FROM_MS
  return (before ? STAMPS_PER_ITEM_BEFORE : STAMPS_PER_ITEM).get(categoryId) ?? 0
}

/** The stamps an order's lines earn; a line added to it later counts from when it was added. */
export function stampsIn(lines: readonly StampLine[], orderedAt?: string | null): number {
  return lines.reduce(
    (n, l) => n + (isAddonLine(l) || !l.categoryId ? 0 : stampsPerItem(l.categoryId, l.addedAt ?? orderedAt) * l.qty),
    0,
  )
}

export function isClassicDrinkLine(line: StampLine): boolean {
  return !isAddonLine(line) && Boolean(line.categoryId && CLASSIC_DRINK_CATEGORY_IDS.includes(line.categoryId))
}

/** How many classic drinks the order has: the free drink takes one. */
export function classicUnitsIn(lines: readonly StampLine[]): number {
  return lines.reduce((n, l) => n + (isClassicDrinkLine(l) ? l.qty : 0), 0)
}

export function isTenOffLine(line: StampLine): boolean {
  return !isAddonLine(line) && Boolean(line.categoryId && TEN_OFF_CATEGORY_IDS.includes(line.categoryId))
}

/** The rewards refusal when the tabs' names can't be read: it names no tab. */
export const REWARDS_NEED_ITEMS_GENERIC =
  'Each loyalty reward needs its own item in the order: one for the free drink and another for the 10% off.'

/** The staff-facing loyalty sentences, naming tabs as the menu calls them today. */
export interface LoyaltyCopy {
  noStampsYet: string
  freeDrinkTap: string
  freeDrinkAdd: string
  tenNeedsItem: string
  rewardsNeedItems: string
}

const NO_FREE_DRINK_TAB = 'Free drink ready, but no tab on the menu takes it.'
const WHOLE_STAMP_IDS = [...STAMPS_PER_ITEM].filter(([, n]) => n === 1).map(([id]) => id)
const HALF_STAMP_IDS = [...STAMPS_PER_ITEM].filter(([, n]) => n === 0.5).map(([id]) => id)

/** "A, B and C" or "A, B or C"; empty when there are none. */
function joinNames(names: readonly string[], word: 'and' | 'or'): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} ${word} ${names[names.length - 1]}`
}

const withArticle = (phrase: string) => `${/^[aeiou]/i.test(phrase) ? 'an' : 'a'} ${phrase}`

/**
 * The loyalty hints and the rewards refusal, built from the tabs' names on the menu now. `labelOf`
 * gives a tab's name, or undefined for a tab no longer on the menu, which is left out.
 */
export function loyaltyCopy(labelOf: (categoryId: string) => string | undefined): LoyaltyCopy {
  const names = (ids: readonly string[]) => ids.map(labelOf).filter((name): name is string => Boolean(name))
  const whole = joinNames(names(WHOLE_STAMP_IDS), 'and')
  const half = joinNames(names(HALF_STAMP_IDS), 'and')
  const classic = joinNames(names(CLASSIC_DRINK_CATEGORY_IDS), 'or')
  const ten = joinNames(names(TEN_OFF_CATEGORY_IDS), 'or')
  const stampParts = whole && half
    ? `: ${whole} items earn 1, ${half} items ½`
    : whole ? `: ${whole} items earn 1` : half ? `: ${half} items earn ½` : ''
  return {
    noStampsYet: `No stamps from this order yet${stampParts}.`,
    freeDrinkTap: classic ? `Free drink ready: tap “Make free” on ${withArticle(classic)} drink.` : NO_FREE_DRINK_TAB,
    freeDrinkAdd: classic ? `Free drink ready: add ${withArticle(classic)} drink to use it.` : NO_FREE_DRINK_TAB,
    tenNeedsItem: ten
      ? `The 10% off is for one ${ten} item. Ask the customer to add one to use it.`
      : 'The 10% off needs an item from a tab that takes it, and none is on the menu.',
    rewardsNeedItems: classic && ten
      ? `Each loyalty reward needs its own item: ${withArticle(classic)} drink for the free drink, and ${withArticle(ten)} item for the 10%.`
      : REWARDS_NEED_ITEMS_GENERIC,
  }
}

export interface LoyaltyPerks {
  stamps: boolean
  freeDrink: boolean
  tenOff: boolean
}

/** What a tab gives on loyalty cards under today's rules, for the warning before it is deleted. */
export function loyaltyPerksOf(categoryId: string): LoyaltyPerks {
  return {
    stamps: STAMPS_PER_ITEM.has(categoryId),
    freeDrink: CLASSIC_DRINK_CATEGORY_IDS.includes(categoryId),
    tenOff: TEN_OFF_CATEGORY_IDS.includes(categoryId),
  }
}

/** Whether the order has an item for each reward it uses: a classic drink for the free one, and another unit the 10% can go on. */
export function rewardsFitOrder(lines: readonly StampLine[], rewards: readonly string[]): boolean {
  const free = rewards.includes('free') ? 1 : 0
  if (free > classicUnitsIn(lines)) return false
  const tenOffUnits = lines.reduce((n, l) => n + (isTenOffLine(l) ? l.qty : 0), 0)
  return !rewards.includes('ten') || tenOffUnits - free >= 1
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
  sales: readonly { _createdAt?: string | null; items?: readonly StampLine[] | null; loyaltyRewards?: readonly string[] | null }[],
): CardTotals {
  return sales.reduce<CardTotals>(
    (t, sale) => addOrderToTotals(t, stampsIn(sale.items ?? [], sale._createdAt), sale.loyaltyRewards ?? []),
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

/** A stamp count as the card shows it, a half as ½: "6", "6½", "½". */
export function formatStamps(n: number): string {
  const whole = Math.floor(n)
  if (n - whole < 0.5) return String(whole)
  return whole > 0 ? `${whole}½` : '½'
}

/** "½ stamp", "1 stamp", "1½ stamps". */
export function stampCount(n: number): string {
  return `${formatStamps(n)} ${n > 0 && n <= 1 ? 'stamp' : 'stamps'}`
}

export function nextMilestone(onCard: number): string {
  if (onCard < LOYALTY_TEN_OFF_AT) return `${formatStamps(LOYALTY_TEN_OFF_AT - onCard)} more for 10% off`
  return `${formatStamps(LOYALTY_CARD_SIZE - onCard)} more for a free drink`
}

export type BarHalf = 'saved' | 'new' | 'empty'

/** One step of the stamp bar, by halves: a half stamp fills one. */
export interface BarStep {
  first: BarHalf
  second: BarHalf
}

/** The stamp bar's 11 steps: stamps already saved, then this order's, then the rest. */
export function barSteps(saved: number, pending: number): { steps: BarStep[]; overflow: number } {
  const half = (h: number): BarHalf => (h < saved * 2 ? 'saved' : h < (saved + pending) * 2 ? 'new' : 'empty')
  const steps = Array.from({ length: LOYALTY_CARD_SIZE }, (_, i): BarStep => ({ first: half(2 * i), second: half(2 * i + 1) }))
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

// A saved discount row is named by savedDiscountName (app/pos/discounts.ts): its label, then
// the drink in brackets. The loyalty rows' labels start these ways.
const SAVED_REWARD_ROWS: readonly (readonly [prefix: string, reward: LoyaltyReward])[] = [
  ['Loyalty -10%', 'ten'],
  ['Loyalty free drink', 'free'],
]

/** The loyalty reward a saved discount row stands for, read from its name; null for any other row. */
export function rewardOfSavedDiscount(name: string): LoyaltyReward | null {
  return SAVED_REWARD_ROWS.find(([prefix]) => name.startsWith(prefix))?.[1] ?? null
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
