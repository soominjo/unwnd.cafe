import { client } from '@/sanity/lib/client'
import { getWriteClient } from '@/sanity/lib/writeClient'
import { cardTotals, type CardHolderWithCard, type CardTotals, type StampLine } from '@/lib/loyalty'

// Server only: loyalty card holders and the sales linked to them. Stamps are never
// stored; every read counts them again from the linked sales.

const fresh = client.withConfig({ useCdn: false })

interface MemberDoc {
  _id: string
  name: string
  cardNumber: number
  _createdAt: string
}

interface LinkedSale {
  /** The stamp rules go by it: without it, every old sale would count by today's rules. */
  _createdAt: string
  loyaltyMemberId: string
  loyaltyRewards: string[] | null
  items: StampLine[] | null
}

// Each sale's date and each line's added date: the stamp rules go by when an item was ordered.
const LINKED_SALE = `{ _createdAt, loyaltyMemberId, loyaltyRewards, items[]{ lineId, qty, categoryId, isAddon, parentLineId, addedAt } }`
const NO_STAMPS: CardTotals = { earned: 0, usedTen: 0, usedFree: 0 }
/** Card numbers come from this counter, which only goes up, so a removed card's number is never given out again. */
const CARD_COUNTER_ID = 'loyalty-card-counter'

/** How long the /pos page waits for card holders before rendering without them. */
export const CARD_HOLDERS_TIMEOUT_MS = 3000

/** Every card holder, by card number, with the totals of their linked sales. */
export async function fetchCardHolders(): Promise<CardHolderWithCard[]> {
  const [members, sales] = await Promise.all([
    fresh.fetch<MemberDoc[]>(`*[_type == "loyaltyMember"] | order(cardNumber asc){ _id, name, cardNumber, _createdAt }`, {}, { cache: 'no-store' }),
    fresh.fetch<LinkedSale[]>(`*[_type == "sale" && defined(loyaltyMemberId)]${LINKED_SALE}`, {}, { cache: 'no-store' }),
  ])
  const byMember = new Map<string, LinkedSale[]>()
  for (const sale of sales) {
    const list = byMember.get(sale.loyaltyMemberId)
    if (list) list.push(sale)
    else byMember.set(sale.loyaltyMemberId, [sale])
  }
  return members.map((m) => {
    const linked = byMember.get(m._id) ?? []
    return { _id: m._id, name: m.name, cardNumber: m.cardNumber, joinedAt: m._createdAt, card: cardTotals(linked), orderCount: linked.length }
  })
}

/** One card holder's totals, or null when no card holder has that id. */
export async function fetchCardTotals(memberId: string): Promise<CardTotals | null> {
  const result = await fresh.fetch<{ exists: boolean; sales: LinkedSale[] }>(
    `{ "exists": defined(*[_type == "loyaltyMember" && _id == $id][0]._id), "sales": *[_type == "sale" && loyaltyMemberId == $id]${LINKED_SALE} }`,
    { id: memberId },
    { cache: 'no-store' },
  )
  return result.exists ? cardTotals(result.sales) : null
}

/**
 * Adds a card holder under the next card number. The counter's increment is atomic, so two
 * cards given at the same moment still get different numbers. The first time, the counter
 * starts from the highest number already on a card.
 */
export async function addCardHolder(name: string): Promise<CardHolderWithCard> {
  const writeClient = getWriteClient()
  const highest = await fresh.fetch<number | null>(
    `*[_type == "loyaltyMember" && defined(cardNumber)] | order(cardNumber desc)[0].cardNumber`,
    {},
    { cache: 'no-store' },
  )
  await writeClient.createIfNotExists({ _id: CARD_COUNTER_ID, _type: 'loyaltyCardCounter', last: highest ?? 0 })
  const counter = await writeClient.patch(CARD_COUNTER_ID).inc({ last: 1 }).commit<{ last: number }>()
  let cardNumber = counter.last
  // A card numbered by hand in Studio can be ahead of the counter: move the counter past it.
  // This step is not atomic, but it only runs after such a hand edit (the field is read-only there).
  if (highest !== null && cardNumber <= highest) {
    cardNumber = highest + 1
    await writeClient.patch(CARD_COUNTER_ID).set({ last: cardNumber }).commit()
  }
  const doc = await writeClient.create({ _type: 'loyaltyMember', name, cardNumber })
  return { _id: doc._id, name, cardNumber: Number(doc.cardNumber), joinedAt: doc._createdAt, card: NO_STAMPS, orderCount: 0 }
}

/** Removes a card holder. The query matches card holders only, so no other document can be deleted. */
export async function removeCardHolder(id: string): Promise<boolean> {
  const result = await getWriteClient().delete({ query: '*[_type == "loyaltyMember" && _id == $id]', params: { id } })
  return result.results.length > 0
}

/**
 * Card holders for the /pos page to render with, so the name field can suggest them at
 * once. Never throws: null when they cannot be read in time, and loyalty is unavailable
 * on that page load.
 */
export async function loadCardHolders(): Promise<CardHolderWithCard[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Card holders took longer than ${CARD_HOLDERS_TIMEOUT_MS}ms`)), CARD_HOLDERS_TIMEOUT_MS)
  })
  try {
    return await Promise.race([fetchCardHolders(), timeout])
  } catch (error) {
    console.error('Loyalty card holders could not be loaded for the POS', error)
    return null
  } finally {
    clearTimeout(timer)
  }
}
