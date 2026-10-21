# The POS Owns the Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Sanity the menu's only source, edited from the POS in manager mode. Every item and tab can be edited, deleted and renamed, deletes stick, items keep the order they were added in, and `/menu` shows each POS save on its next visit.

**Architecture:**
- **The move.** A one-time script copies the six tabs still written in code into Sanity. Then the code menu (`MENU`, `BUILT_IN_CATEGORIES`) is deleted.
- **One reader.** `readMenu` in `lib/posMenu.ts` feeds both `/pos` (`no-store`, behind the existing timeout) and `/menu` (static, re-rendered by `revalidatePath('/menu')` from every menu write route, plus a 60 s backstop).
- **Tabs.** New tab routes (rename, delete with items) and a reworked category manager.
- **Fallback.** A last-menu copy in `localStorage` replaces the code fallback.

**Tech Stack:**
- Next.js 16.2 (App Router, route handlers, no `cacheComponents`), React 19
- next-sanity 11 / @sanity/client 7.22
- Vitest 4: node environment, `react-dom/server` static markup for components
- Node 24, which runs `.ts` scripts directly

**Spec:** `docs/superpowers/specs/2026-10-20-pos-owns-the-menu-design.md`. Read it first; this plan argues from it.

## Global Constraints

- **The dataset.** Localhost and live share Sanity project `mguahlyz`, dataset `production`.
  - No test and no implementation step writes to Sanity.
  - The only write is Task 8's move, after the owner says yes.
- **Tests never load the real Sanity client.** `sanity/env.ts` throws without env vars, so mock `@/sanity/lib/client` and `@/sanity/lib/writeClient`, or the module that imports them.
- **Tab ids never change.** Rename changes `label` only. The `espresso` tab's label is **Classic**.
- **Tab names** are trimmed and 1–40 characters (`MAX_CATEGORY_LABEL = 40`).
- **Item order within a tab** is GROQ `order(_createdAt asc, _id asc)`, the same on `/pos` and `/menu`.
- **Menu reads skip the API CDN** (`client.withConfig({ useCdn: false })`).
  - POS reads pass `{ cache: 'no-store' }`.
  - `/menu` reads pass `{}`, so the page stays static. `cache: 'no-store'` would make it dynamic.
- **`/menu` freshness.**
  - `app/menu/page.tsx` exports `revalidate = 60`.
  - Every menu write route calls `revalidatePath('/menu')` after its Sanity write succeeds, and never on a refusal or failure.
  - `revalidatePath` passes no cache-life profile, so Next expires the page immediately and the next visit renders fresh (`node_modules/next/dist/server/web/spec-extension/revalidate.js`, lines 80–100 and 208). No other freshness mechanism is needed.
- **Move script `_id`s** are `menu-category-<id>`. No dots, because dotted ids are not publicly readable.
- **Saved menu `localStorage` key:** `unwnd.pos.lastMenu`.
- **Apostrophes and quotes.** UI copy with an apostrophe uses ’ (U+2019), as in "you’re" on the Manager page, so static markup doesn't escape it. Keep the existing curly quotes in “Make free”.
- **`console.log`.** None in app code. The move script prints with `process.stdout.write`.
- **Line endings.** Every file touched is LF today; keep LF, and make new files LF.
- **One commit for the whole feature** (the owner's workflow: straight on `main`, body starting "Owner feedback.", with the Co-Authored-By trailer).
  - No per-task commits. Each task ends green: its tests plus `npx tsc --noEmit`.
  - Push only after Task 8's move.
- **React 19 lint.** State set from an effect goes through `void Promise.resolve().then(() => …)`, as the POS already does, to satisfy `react-hooks/set-state-in-effect`.

## Review Focus

Each of these is pinned by a test in the task named.

1. **A tab renamed to spaces, or to more than 40 characters,** is refused with a message and keeps its old name. Task 5: PATCH test.
2. **Deleting the tab that is open on the POS** moves the POS to the first tab instead of an empty grid. Task 6: `withoutTab` test.
3. **A saved menu in `localStorage` that is corrupt, half-written or an old shape** is ignored, and the POS still opens. Task 7: `readSavedMenu` test.
4. **Every tab a loyalty rule names gets deleted.** The staff hints still read as whole sentences, and the rewards refusal falls back to generic text. Task 2: `loyaltyCopy` test.
5. **The move run twice, or a tab id Sanity already has,** creates nothing extra. Task 1: `moveCodeTabs` test.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `scripts/move-code-tabs-to-sanity.ts` (new) | The six former code tabs, `moveCodeTabs`, and the run-it-directly CLI | 1 |
| `scripts/move-code-tabs-to-sanity.test.ts` (new) | Its tests | 1, 3 |
| `vitest.config.ts` | Also include `scripts/**/*.test.ts` | 1 |
| `lib/loyalty.ts` | Adds `loyaltyCopy`, `loyaltyPerksOf` and `REWARDS_NEED_ITEMS_GENERIC`; removes `REWARDS_NEED_ITEMS` | 2 |
| `lib/sales/rewardsRefusal.ts` (new) | Server: the rewards refusal named by the live tabs | 2 |
| `app/api/sales/route.ts`, `app/api/sales/[id]/items/route.ts` | Use `rewardsRefusal()` | 2 |
| `app/pos/CustomerNameField.tsx` | Hints from a `copy: LoyaltyCopy` prop | 2 |
| `lib/menuCategories.ts` | Tabs from Sanity only; `ResolvedCategory` without `isBuiltIn` | 3 |
| `lib/posMenu.ts` | `readMenu` (the shared reader), ordered items with description and image, `loadPosMenu` | 3 |
| `app/menu/publicMenu.ts` (new) | Maps the reader's menu to what `/menu` shows | 3 |
| `app/menu/page.tsx` | Renders from `readMenu`; `revalidate = 60` | 3 |
| `app/pos/menuData.ts`, `app/pos/menuData.test.ts` | Deleted | 3 |
| `lib/menuCategoryLabel.ts` (new) | `MAX_CATEGORY_LABEL` and `cleanCategoryLabel` | 5 |
| `app/api/menu/route.ts`, `app/api/menu/[id]/route.ts`, `app/api/menu/settings/route.ts` | Refresh `/menu` after writes; settings drops hide/restore | 3, 4 |
| `app/api/menu/categories/route.ts`, `app/api/menu/categories/[id]/route.ts` | Add (any name), rename (new PATCH), delete with items | 3, 5 |
| `app/pos/categoryEdits.ts` (new) | Pure: `deletePrompt` and `withoutTab` | 6 |
| `app/pos/ManageMenuModal.tsx` | Every tab with Rename and Delete; `CategoryRow` | 3, 6 |
| `app/pos/savedMenu.ts` (new) | `saveMenu` and `readSavedMenu` | 7 |
| `app/pos/POSClient.tsx` | Sanity-only menu, loyalty copy, tab handlers, saved-menu fallback | 2, 3, 6, 7 |
| `sanity/schemaTypes/menuItem.ts`, `sanity/schemaTypes/menuCategory.ts` | Drop the fixed tab lists and the "built-in" wording | 3 |

---

### Task 1: The one-time move script

**Files:**
- Create: `scripts/move-code-tabs-to-sanity.ts`
- Create: `scripts/move-code-tabs-to-sanity.test.ts`
- Modify: `vitest.config.ts` (`test.include` gains `'scripts/**/*.test.ts'`)

**Interfaces:**
- Produces:
  - `export interface FormerCodeTab { id: string; label: string; type: 'drink' | 'food'; order: number }`
  - `export const FORMER_CODE_TABS: readonly FormerCodeTab[]`
  - `export function tabDocId(id: string): string`, which returns `` `menu-category-${id}` ``
  - `export interface TabMoveClient { fetch<T>(query: string): Promise<T>; createIfNotExists(doc: FormerCodeTab & { _id: string; _type: 'menuCategory' }): Promise<unknown> }`
  - `export async function moveCodeTabs(client: TabMoveClient): Promise<{ created: string[]; alreadyThere: string[] }>`. Both lists hold tab ids.

- [ ] **Step 1: Write the failing test** `scripts/move-code-tabs-to-sanity.test.ts`

```ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@/sanity/lib/client', () => ({ client: { withConfig: () => ({}) } }))

import { BUILT_IN_CATEGORIES } from '@/lib/menuCategories'
import { FORMER_CODE_TABS, moveCodeTabs, tabDocId, type TabMoveClient } from './move-code-tabs-to-sanity'

function fakeClient(existingIds: string[]) {
  const created: unknown[] = []
  const client: TabMoveClient = {
    fetch: vi.fn(async () => existingIds) as TabMoveClient['fetch'],
    createIfNotExists: vi.fn(async (doc) => { created.push(doc); return doc }),
  }
  return { client, created }
}

describe('moving the code tabs into Sanity', () => {
  it('copies the six code tabs exactly as the code has them, Espresso as Classic', () => {
    expect(FORMER_CODE_TABS).toEqual(BUILT_IN_CATEGORIES.map(({ id, label, type, order }) => ({ id, label, type, order })))
    expect(FORMER_CODE_TABS.find((t) => t.id === 'espresso')?.label).toBe('Classic')
  })

  it('creates each tab Sanity does not have yet, under a fixed dot-free _id, and no items', async () => {
    const { client, created } = fakeClient(['add-ons', 'matcha-series', 'add-ons-food'])
    const report = await moveCodeTabs(client)
    expect(report).toEqual({ created: ['signature', 'espresso', 'non-coffee', 'meal', 'waffle', 'snack'], alreadyThere: [] })
    expect(created).toContainEqual({ _id: 'menu-category-espresso', _type: 'menuCategory', id: 'espresso', label: 'Classic', type: 'drink', order: 2 })
    expect(created).toHaveLength(6)
    for (const doc of created as { _id: string; _type: string }[]) {
      expect(doc._id).toMatch(/^[a-z0-9-]+$/)
      expect(doc._type).toBe('menuCategory')
    }
    expect(vi.mocked(client.fetch).mock.calls[0][0]).toContain('"menuCategory"')
  })

  it('changes nothing on a second run, and skips a tab id Sanity already has', async () => {
    const again = fakeClient(['signature', 'espresso', 'non-coffee', 'meal', 'waffle', 'snack'])
    expect(await moveCodeTabs(again.client)).toEqual({ created: [], alreadyThere: ['signature', 'espresso', 'non-coffee', 'meal', 'waffle', 'snack'] })
    expect(again.created).toEqual([])

    const partly = fakeClient(['espresso'])
    expect((await moveCodeTabs(partly.client)).alreadyThere).toEqual(['espresso'])
    expect(partly.created).toHaveLength(5)
  })

  it('names each tab document after its id', () => {
    expect(tabDocId('non-coffee')).toBe('menu-category-non-coffee')
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run scripts/move-code-tabs-to-sanity.test.ts`
Expected: FAIL. Either no test file is found (the include doesn't have `scripts/` yet) or `./move-code-tabs-to-sanity` can't be resolved. Add the include first, then it fails on the missing module.

- [ ] **Step 3: Implement `scripts/move-code-tabs-to-sanity.ts`**

- **`FORMER_CODE_TABS`** is a literal copy of `BUILT_IN_CATEGORIES` without `isBuiltIn`. The test above proves the copy matches the code while both exist. The script can't import `lib/menuCategories.ts`, which pulls in the app's Sanity client through `@/` paths.
- **`moveCodeTabs`** does these steps in order:
  1. It reads `*[_type == "menuCategory"].id`.
  2. For each tab in `FORMER_CODE_TABS` order, whose id isn't already there, it calls `createIfNotExists({ _id: tabDocId(id), _type: 'menuCategory', ...tab })`.
  3. Each id goes to `created` or `alreadyThere` in that order.
- **The CLI** runs only when the file is executed directly: `if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)`.
  - It reads `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET` and `SANITY_API_WRITE_TOKEN`, and `NEXT_PUBLIC_SANITY_API_VERSION` (default `'2026-03-09'`).
  - It refuses with "Run with --env-file=.env.local" when one is missing.
  - It builds `createClient({ projectId, dataset, apiVersion, token, useCdn: false })` from `@sanity/client`.
  - It writes one line per tab with `process.stdout.write`: `created espresso (Classic)` or `already there: espresso`.
  - On error it sets exit code 1 and writes the message to stderr.

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `npx vitest run scripts/move-code-tabs-to-sanity.test.ts`, then `npx tsc --noEmit`
Expected: 4 passed; tsc exit 0.

- [ ] **Step 5: No commit** (Global Constraints: one commit, in Task 8).

---

### Task 2: Loyalty texts name tabs as the menu does

**Files:**
- Modify: `lib/loyalty.ts`, `lib/loyalty.test.ts`
- Create: `lib/sales/rewardsRefusal.ts`, `lib/sales/rewardsRefusal.test.ts`
- Modify: `app/api/sales/route.ts`, `app/api/sales/route.test.ts`
- Modify: `app/api/sales/[id]/items/route.ts`, `app/api/sales/[id]/items/route.test.ts`
- Modify: `app/pos/CustomerNameField.tsx`, `app/pos/CustomerNameField.test.tsx`
- Modify: `app/pos/POSClient.tsx` (pass `copy`)

**Interfaces:**
- Produces, in `lib/loyalty.ts` (pure, no Sanity):
  - `export interface LoyaltyCopy { noStampsYet: string; freeDrinkTap: string; freeDrinkAdd: string; tenNeedsItem: string; rewardsNeedItems: string }`
  - `export function loyaltyCopy(labelOf: (categoryId: string) => string | undefined): LoyaltyCopy`. `labelOf` gives the tab's name today, or `undefined` for a tab that's gone.
  - `export const REWARDS_NEED_ITEMS_GENERIC = 'Each loyalty reward needs its own item in the order: one for the free drink and another for the 10% off.'`
  - `export interface LoyaltyPerks { stamps: boolean; freeDrink: boolean; tenOff: boolean }`
  - `export function loyaltyPerksOf(categoryId: string): LoyaltyPerks`. Today's rules: `stamps` means the id is in the current `STAMPS_PER_ITEM`, `freeDrink` means it's in `CLASSIC_DRINK_CATEGORY_IDS`, and `tenOff` means it's in `TEN_OFF_CATEGORY_IDS`.
  - Remove `REWARDS_NEED_ITEMS`.
- Produces, in `lib/sales/rewardsRefusal.ts`: `export async function rewardsRefusal(): Promise<string>`.
- Produces, in `CustomerNameField`: a new required prop `copy: LoyaltyCopy`.

- [ ] **Step 1: Write the failing tests**

Add to `lib/loyalty.test.ts`:

```ts
import { REWARDS_NEED_ITEMS_GENERIC, loyaltyCopy, loyaltyPerksOf } from './loyalty'

const LABELS: Record<string, string> = {
  signature: 'Signature', 'matcha-series': 'Matcha Series', meal: 'Meal',
  espresso: 'Classic', 'non-coffee': 'Non-Coffee', waffle: 'Waffle', snack: 'Snack',
}

describe('loyalty copy', () => {
  it('names the tabs as the menu calls them now', () => {
    expect(loyaltyCopy((id) => LABELS[id])).toEqual({
      noStampsYet: 'No stamps from this order yet: Signature, Matcha Series and Meal items earn 1, Classic, Non-Coffee, Waffle and Snack items ½.',
      freeDrinkTap: 'Free drink ready: tap “Make free” on a Classic or Non-Coffee drink.',
      freeDrinkAdd: 'Free drink ready: add a Classic or Non-Coffee drink to use it.',
      tenNeedsItem: 'The 10% off is for one Classic, Non-Coffee, Waffle or Snack item. Ask the customer to add one to use it.',
      rewardsNeedItems: 'Each loyalty reward needs its own item: a Classic or Non-Coffee drink for the free drink, and a Classic, Non-Coffee, Waffle or Snack item for the 10%.',
    })
  })

  it('says "an" before a name that starts with a vowel', () => {
    expect(loyaltyCopy((id) => ({ ...LABELS, espresso: 'Espresso' })[id]).freeDrinkAdd)
      .toBe('Free drink ready: add an Espresso or Non-Coffee drink to use it.')
  })

  it('leaves out tabs no longer on the menu, and still reads as sentences when a rule has none left', () => {
    const left = (id: string) => (['signature', 'meal', 'waffle', 'snack'].includes(id) ? LABELS[id] : undefined)
    expect(loyaltyCopy(left)).toEqual({
      noStampsYet: 'No stamps from this order yet: Signature and Meal items earn 1, Waffle and Snack items ½.',
      freeDrinkTap: 'Free drink ready, but no tab on the menu takes it.',
      freeDrinkAdd: 'Free drink ready, but no tab on the menu takes it.',
      tenNeedsItem: 'The 10% off is for one Waffle or Snack item. Ask the customer to add one to use it.',
      rewardsNeedItems: REWARDS_NEED_ITEMS_GENERIC,
    })
    expect(loyaltyCopy((id) => (id === 'waffle' ? 'Waffle' : undefined)).noStampsYet).toBe('No stamps from this order yet: Waffle items earn ½.')
    expect(loyaltyCopy(() => undefined).noStampsYet).toBe('No stamps from this order yet.')
    expect(loyaltyCopy(() => undefined).tenNeedsItem).toBe('The 10% off needs an item from a tab that takes it, and none is on the menu.')
  })

  it('says what a tab gives, for the warning before it is deleted', () => {
    expect(loyaltyPerksOf('espresso')).toEqual({ stamps: true, freeDrink: true, tenOff: true })
    expect(loyaltyPerksOf('waffle')).toEqual({ stamps: true, freeDrink: false, tenOff: true })
    expect(loyaltyPerksOf('signature')).toEqual({ stamps: true, freeDrink: false, tenOff: false })
    expect(loyaltyPerksOf('add-ons')).toEqual({ stamps: false, freeDrink: false, tenOff: false })
  })
})
```

Create `lib/sales/rewardsRefusal.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'

const { getResolvedCategories } = vi.hoisted(() => ({ getResolvedCategories: vi.fn() }))
vi.mock('@/lib/menuCategories', () => ({ getResolvedCategories }))

import { REWARDS_NEED_ITEMS_GENERIC } from '@/lib/loyalty'
import { rewardsRefusal } from './rewardsRefusal'

describe('the refusal for rewards with no item of their own', () => {
  it('names the tabs as the menu calls them now', async () => {
    getResolvedCategories.mockResolvedValue([
      { id: 'espresso', label: 'Classic' }, { id: 'non-coffee', label: 'Non-Coffee' },
      { id: 'waffle', label: 'Waffle' }, { id: 'snack', label: 'Snack' },
    ])
    expect(await rewardsRefusal()).toBe('Each loyalty reward needs its own item: a Classic or Non-Coffee drink for the free drink, and a Classic, Non-Coffee, Waffle or Snack item for the 10%.')
  })

  it('falls back to wording without tab names when the menu cannot be read', async () => {
    getResolvedCategories.mockRejectedValue(new Error('Sanity is down'))
    expect(await rewardsRefusal()).toBe(REWARDS_NEED_ITEMS_GENERIC)
  })
})
```

Make these changes to the existing tests:

**`app/api/sales/route.test.ts`:**
- Add `vi.mock('@/lib/sales/rewardsRefusal', () => ({ rewardsRefusal: async () => 'Rewards need items (named by the menu).' }))` next to the other mocks.
- The assertion at the "refuses rewards that have no item of their own to go on" test becomes `.toBe('Rewards need items (named by the menu).')`.

**`app/api/sales/[id]/items/route.test.ts`:** add the same `vi.mock`. Any assertion on the old `REWARDS_NEED_ITEMS` text becomes the mocked string.

**`app/pos/CustomerNameField.test.tsx`:**
- `field()` passes `copy={loyaltyCopy((id) => LABELS[id])}`, with the same `LABELS` as above, and imports `loyaltyCopy`.
- Its expectations become:
  - `'The 10% off is for one Classic, Non-Coffee, Waffle or Snack item. Ask the customer to add one to use it.'`
  - `'add a Classic or Non-Coffee drink'`
  - `'No stamps from this order yet: Signature, Matcha Series and Meal items earn 1, Classic, Non-Coffee, Waffle and Snack items ½.'`

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run lib/loyalty.test.ts lib/sales/rewardsRefusal.test.ts app/pos/CustomerNameField.test.tsx app/api/sales`
Expected: FAIL. `loyaltyCopy`, `loyaltyPerksOf` and `rewardsRefusal` are missing, and the route test gets the old text.

- [ ] **Step 3: Implement**

**`lib/loyalty.ts`**, composing the copy. The test strings depend on these exact rules:

- `names(ids)` is `ids.map(labelOf).filter(Boolean)`.
- `joined(names, word)` returns one of:
  - `''` when there are no names
  - the single name when there is one
  - `` `${all but last joined with ', '} ${word} ${last}` `` otherwise
- `article(phrase)` returns `/^[aeiou]/i.test(phrase) ? 'an ' + phrase : 'a ' + phrase`.
- The lists come from `STAMPS_PER_ITEM` in its insertion order:
  - `WHOLE` holds the ids worth 1: signature, matcha-series, meal.
  - `HALF` holds the ids worth ½: espresso, non-coffee, waffle, snack.
  - `classic = joined(names(CLASSIC_DRINK_CATEGORY_IDS), 'or')`
  - `ten = joined(names(TEN_OFF_CATEGORY_IDS), 'or')`
- **`noStampsYet`**, with `whole = joined(names(WHOLE), 'and')` and `half = joined(names(HALF), 'and')`:
  - both: `` `No stamps from this order yet: ${whole} items earn 1, ${half} items ½.` ``
  - whole only: `` `…: ${whole} items earn 1.` ``
  - half only: `` `…: ${half} items earn ½.` ``
  - neither: `'No stamps from this order yet.'`
- **`freeDrinkTap`** and **`freeDrinkAdd`**: the sentences in the test, using `article(classic)`, or `'Free drink ready, but no tab on the menu takes it.'` when `classic` is empty.
- **`tenNeedsItem`**: the sentence in the test, or `'The 10% off needs an item from a tab that takes it, and none is on the menu.'` when `ten` is empty.
- **`rewardsNeedItems`**: the sentence in the test when both `classic` and `ten` are non-empty, otherwise `REWARDS_NEED_ITEMS_GENERIC`.

**`lib/sales/rewardsRefusal.ts`:**
- It calls `getResolvedCategories()` and returns `loyaltyCopy((id) => tabs.find((t) => t.id === id)?.label).rewardsNeedItems`.
- On any error it returns `REWARDS_NEED_ITEMS_GENERIC`.
- It's only called on the refusal path, so it can never block a sale that would otherwise be saved.

**The routes:**
- `app/api/sales/route.ts`: `error: await rewardsRefusal()` where `REWARDS_NEED_ITEMS` was.
- `app/api/sales/[id]/items/route.ts`: `refuse(400, await rewardsRefusal())`.
- Drop the `REWARDS_NEED_ITEMS` imports.

**`CustomerNameField.tsx`:**
- The props gain `/** The loyalty sentences, naming tabs as the menu does today. */ copy: LoyaltyCopy`.
- The four fixed strings become `copy.noStampsYet`, `copy.freeDrinkTap`, `copy.freeDrinkAdd` and, passed into `TenOff` as `needsItem`, `copy.tenNeedsItem`.
- Doc comments that name "Espresso" say "classic (espresso/non-coffee)" or name no tabs.

**`POSClient.tsx`:**
- `const loyaltyText = useMemo(() => loyaltyCopy((id) => dynamicCategories.find((c) => c.id === id)?.label), [dynamicCategories])`
- Pass `copy={loyaltyText}` to `CustomerNameField`.

- [ ] **Step 4: Run the tests to make sure they pass**

Run: `npx vitest run lib app/api/sales app/pos/CustomerNameField.test.tsx app/pos/POSClient.test.tsx`, then `npx tsc --noEmit`
Expected: all pass; tsc exit 0.

- [ ] **Step 5: No commit.**

---

### Task 3: Sanity is the only menu

**Files:**
- Modify: `lib/menuCategories.ts`, `lib/menuCategories.test.ts` (rewrite)
- Modify: `lib/posMenu.ts`, `lib/posMenu.test.ts`
- Create: `app/menu/publicMenu.ts`, `app/menu/publicMenu.test.ts`
- Modify: `app/menu/page.tsx`
- Modify: `app/pos/POSClient.tsx`, `app/pos/POSClient.test.tsx`, `app/pos/page.test.tsx`
- Modify: `app/pos/ManageMenuModal.tsx` (types only here; Task 6 reworks it)
- Modify: `app/pos/canEditMenu.ts` (comment), `app/pos/canEditMenu.test.ts`
- Modify: `app/api/menu/categories/route.ts` (drop the former-code-id 409)
- Modify: `app/api/menu/settings/route.ts` (drop hide/restore)
- Modify: `scripts/move-code-tabs-to-sanity.test.ts` (pin the literal tabs)
- Modify: `sanity/schemaTypes/menuItem.ts`, `sanity/schemaTypes/menuCategory.ts`
- Delete: `app/pos/menuData.ts`, `app/pos/menuData.test.ts`

**Interfaces:**
- Produces, in `lib/menuCategories.ts`:
  - `export interface ResolvedCategory { id: string; label: string; type: 'drink' | 'food'; order: number; _sanityId: string }`. There's no `isBuiltIn`.
  - `export async function getResolvedCategories({ noStore = true }: { noStore?: boolean } = {}): Promise<ResolvedCategory[]>`
  - `BUILT_IN_CATEGORIES` is deleted.
- Produces, in `lib/posMenu.ts`:
  - `PosMenuItem` is unchanged.
  - `export interface MenuItemDoc extends PosMenuItem { description: string | null; image: { asset: { _ref: string } } | null }`
  - `export interface MenuSettings { categoryOrder: string[] }`
  - `export interface PosMenu { categories: ResolvedCategory[]; items: PosMenuItem[]; categoryOrder: string[] }`
  - `export interface MenuData { categories: ResolvedCategory[]; items: MenuItemDoc[]; categoryOrder: string[] }`
  - `export async function fetchPosMenuItems({ noStore = true } = {}): Promise<MenuItemDoc[]>`
  - `export async function fetchMenuSettings({ noStore = true } = {}): Promise<MenuSettings>`
  - `export async function readMenu({ noStore }: { noStore: boolean }): Promise<MenuData>`, which throws on failure.
  - `export async function loadPosMenu(): Promise<PosMenu | null>`, which is `readMenu({ noStore: true })` behind the existing timeout.
- Produces, in `app/menu/publicMenu.ts`: `export function toPublicMenu(menu: Pick<MenuData, 'categories' | 'items'>): { categories: { id: string; label: string }[]; items: SanityMenuItem[] }`
- Produces, in `ManageMenuModal.tsx`: `export interface DynamicCategory { id: string; label: string; type: 'drink' | 'food'; order: number; _sanityId: string }`

- [ ] **Step 1: Write the failing tests**

Rewrite `lib/menuCategories.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fetch, cdnFetch, withConfig } = vi.hoisted(() => {
  const fetch = vi.fn()
  return { fetch, cdnFetch: vi.fn(), withConfig: vi.fn(() => ({ fetch })) }
})
vi.mock('@/sanity/lib/client', () => ({ client: { fetch: cdnFetch, withConfig } }))

import { getResolvedCategories } from './menuCategories'

const tab = (id: string, label: string, order: number, _id = `menu-category-${id}`) => ({ _id, id, label, type: 'drink', order })

beforeEach(() => fetch.mockReset())

describe('the tabs', () => {
  it('come from Sanity only, in the saved tab order, with any tab missing from it last by its order', async () => {
    fetch
      .mockResolvedValueOnce([tab('signature', 'Signature', 1), tab('espresso', 'Classic', 2), tab('add-ons', 'Add ons', 7, 'RacZ'), tab('add-ons-food', 'ADD ONS FOOD', 9, 'fz5v')])
      .mockResolvedValueOnce({ categoryOrder: ['espresso', 'signature', 'add-ons'] })
    const tabs = await getResolvedCategories()
    expect(tabs.map((t) => t.id)).toEqual(['espresso', 'signature', 'add-ons', 'add-ons-food'])
    expect(tabs[0]).toEqual({ id: 'espresso', label: 'Classic', type: 'drink', order: 2, _sanityId: 'menu-category-espresso' })
  })

  it('has none of its own: with nothing in Sanity there are no tabs', async () => {
    fetch.mockResolvedValueOnce([]).mockResolvedValueOnce(null)
    expect(await getResolvedCategories()).toEqual([])
  })

  it('never reads through the API CDN; past the cache for the POS, page-cached for /menu', async () => {
    fetch.mockResolvedValue([])
    await getResolvedCategories()
    expect(fetch.mock.calls[0][2]).toEqual({ cache: 'no-store' })
    fetch.mockClear()
    await getResolvedCategories({ noStore: false })
    expect(fetch.mock.calls[0][2]).toEqual({})
    expect(withConfig).toHaveBeenCalledWith({ useCdn: false })
    expect(cdnFetch).not.toHaveBeenCalled()
  })
})
```

**`lib/posMenu.test.ts`:**
- Its import becomes `import { loadPosMenu, readMenu, MENU_LOAD_TIMEOUT_MS } from './posMenu'`.
- **Fixtures:**
  - The `categories` fixture loses `isBuiltIn` and gains `_sanityId` (`'menu-category-espresso'`, `'menu-category-signature'`).
  - The `items` fixture gains `description: null, image: null`.
- **Rewritten tests:**
  - The first test expects `{ categories, items, categoryOrder: ['espresso', 'signature'] }` from `answer({ categoryOrder: ['espresso', 'signature'] })`.
  - The missing-settings test checks only `categoryOrder` is `[]`.
  - The `null` test keeps its wording minus "built-in".
- **Added tests:**

```ts
it('asks Sanity for items in the order they were added, past the cache, for the POS', async () => {
  answer(null)
  await loadPosMenu()
  const [query, , options] = sanityFetch.mock.calls.find(([q]) => String(q).includes('"menuItem"'))!
  expect(query).toContain('order(_createdAt asc, _id asc)')
  expect(query).toContain('description')
  expect(query).toContain('image')
  expect(options).toEqual({ cache: 'no-store' })
  expect(getResolvedCategories).toHaveBeenCalledWith({ noStore: true })
})

it('reads the same menu for /menu without opting the page out of its cache', async () => {
  answer(null)
  await readMenu({ noStore: false })
  const [, , options] = sanityFetch.mock.calls.find(([q]) => String(q).includes('"menuItem"'))!
  expect(options).toEqual({})
  expect(getResolvedCategories).toHaveBeenCalledWith({ noStore: false })
})
```

Create `app/menu/publicMenu.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { MenuItemDoc } from '@/lib/posMenu'
import { toPublicMenu } from './publicMenu'

const tab = (id: string, label: string) => ({ id, label, type: 'drink' as const, order: 1, _sanityId: `menu-category-${id}` })
const item = (over: Partial<MenuItemDoc>): MenuItemDoc => ({
  _id: 'x', name: 'X', subtitle: null, category: 'espresso', priceHot: null, priceIce: null, priceFixed: null,
  addonType: null, hiddenFromPos: false, applicableCategories: null, description: null, image: null, ...over,
})
const categories = [tab('signature', 'Signature'), tab('add-ons', 'Add ons'), tab('espresso', 'Classic')]

describe('what /menu shows', () => {
  it('the POS tabs in the POS order and names, without Add ons', () => {
    expect(toPublicMenu({ categories, items: [] }).categories).toEqual([{ id: 'signature', label: 'Signature' }, { id: 'espresso', label: 'Classic' }])
  })

  it('items in the order they were added, Hide from POS ones included, only in tabs it shows', () => {
    const items = [
      item({ _id: 'a', name: 'Americano' }), item({ _id: 's', name: 'Espresso Shot', category: 'add-ons' }),
      item({ _id: 'c', name: 'Caramel', hiddenFromPos: true }), item({ _id: 'g', name: 'Stray', category: 'gone' }),
      item({ _id: 'p', name: 'Spanish' }), item({ _id: 'l', name: 'Cafe Latte' }),
    ]
    expect(toPublicMenu({ categories, items }).items.map((i) => i.name)).toEqual(['Americano', 'Caramel', 'Spanish', 'Cafe Latte'])
  })

  it('prices and Hot/Iced as /menu shows them, and the description falling back to the subtitle', () => {
    const [both, iced, food] = toPublicMenu({ categories, items: [
      item({ priceHot: 120, priceIce: 130, subtitle: 'Espresso · Milk' }),
      item({ priceIce: 130, description: 'Cold and creamy' }),
      item({ priceFixed: 180, category: 'signature' }),
    ] }).items
    expect(both).toMatchObject({ price: 120, priceHot: 120, priceIce: 130, drinkType: 'both', description: 'Espresso · Milk' })
    expect(iced).toMatchObject({ price: 130, priceIce: 130, drinkType: 'iced', description: 'Cold and creamy' })
    expect(iced.priceHot).toBeUndefined()
    expect(food).toMatchObject({ price: 180 })
    expect(food.drinkType).toBeUndefined()
    expect(food.image).toBeUndefined()
  })
})
```

**`app/pos/POSClient.test.tsx`:**
- The `live` fixture's tabs become `{ id: 'signature', label: 'Signature', type: 'drink', order: 1, _sanityId: 'menu-category-signature' }` and `{ id: 'espresso', label: 'Classic', type: 'drink', order: 2, _sanityId: 'menu-category-espresso' }`. Remove `hiddenItemIds`.
- **"already shows the live menu…"** keeps `'Ube Cream Latte'` and the not-`White Mocha Americano`/not-`Cereal Cream Latte` checks. It adds `expect(html).toContain('>Classic</button>')`, keeping `not.toContain('Non-Coffee')`.
- **"shows the built-in menu when the live one could not be read…"** is replaced by:

```ts
it('shows no menu and asks for a reload when the live menu could not be read', () => {
  const html = firstPaint(null)
  expect(html).toContain('Could not load the menu. Reload to try again.')
  expect(html).not.toContain('>Signature</button>')
  expect(html).not.toContain('Showing the built-in menu')
  expect(firstPaint(live)).not.toContain('Could not load')
})
```

- **"opens with menu editing still on…"** also expects `title="Delete item"` (the Sanity item has ✕).
- **The fallback-editing test's** title says "fallback" instead of "built-in fallback".

**`app/pos/page.test.tsx` and `app/pos/canEditMenu.test.ts`:**
- Fixtures drop `hiddenItemIds` and `isBuiltIn`, and tabs gain `_sanityId`.
- The `canEditMenu` comment reads "With no live menu there is nothing saved to edit."

**`scripts/move-code-tabs-to-sanity.test.ts`:**
- Remove the `vi.mock` and the `BUILT_IN_CATEGORIES` import.
- The first test now pins the literal tabs:

```ts
expect(FORMER_CODE_TABS).toEqual([
  { id: 'signature', label: 'Signature', type: 'drink', order: 1 },
  { id: 'espresso', label: 'Classic', type: 'drink', order: 2 },
  { id: 'non-coffee', label: 'Non-Coffee', type: 'drink', order: 3 },
  { id: 'meal', label: 'Meal', type: 'food', order: 4 },
  { id: 'waffle', label: 'Waffle', type: 'food', order: 5 },
  { id: 'snack', label: 'Snack', type: 'food', order: 6 },
])
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run lib app/menu app/pos/POSClient.test.tsx app/pos/page.test.tsx app/pos/canEditMenu.test.ts scripts`
Expected: FAIL. `menuCategories` still merges the code tabs, `toPublicMenu` and `readMenu` are missing, and the POS still shows the code tabs on the fallback.

- [ ] **Step 3: Implement**

**`lib/menuCategories.ts`:**
- Read `*[_type == "menuCategory"] | order(order asc){ _id, id, label, type, order }` and the settings `categoryOrder` through `client.withConfig({ useCdn: false })`, passing `noStore ? { cache: 'no-store' } : {}`.
- Map `_id` to `_sanityId`.
- Sort by position in `categoryOrder`, with missing tabs last. Today's stable sort keeps their `order`.
- Delete `BUILT_IN_CATEGORIES`.

**`lib/posMenu.ts`:**
- The item query is:

```groq
*[_type == "menuItem" && available != false] | order(_createdAt asc, _id asc) {
  _id, name, subtitle, category, priceHot, priceIce, "priceFixed": price, addonType, hiddenFromPos, applicableCategories, description, image
}
```

- `readMenu` runs `getResolvedCategories({ noStore })`, `fetchPosMenuItems({ noStore })` and `fetchMenuSettings({ noStore })` in parallel.
- `loadPosMenu` keeps its timeout, its `console.error` and its `null`. Its message reads "POS menu could not be loaded".

**`app/menu/publicMenu.ts`:**
- **Tabs:** `categories` without `ADDON_CATEGORY_ID`, mapped to `{ id, label }`.
- **Items:** those whose `category` is one of those tabs, in the reader's order, each mapped to a `SanityMenuItem`:
  - `price: priceFixed ?? priceHot ?? priceIce ?? 0`
  - `priceHot` and `priceIce` when not null
  - `description: description ?? subtitle ?? undefined`
  - `subtitle ?? undefined`
  - `image ?? undefined`
  - `drinkType` derived as today's `deriveDrinkType`: `both`, `hot`, `iced` or `undefined`

**`app/menu/page.tsx`:**
- `export const revalidate = 60`, with a comment that POS saves also re-render it at once.
- `const { categories, items } = toPublicMenu(await readMenu({ noStore: false }))`.
- Delete `getSanityItems`, `getHiddenItemIds`, `buildMergedItems`, `deriveDrinkType` and the `MENU`, `client` and `getResolvedCategories` imports. The JSX is unchanged.

**`POSClient.tsx`:**
- Remove the `MENU` import, `hiddenBuiltInIds` and the name-matching rules.
- `mergedMenu` becomes `dynamicCategories.map((cat) => ({ id: cat.id, label: cat.label, items: dynamicItems.filter((i) => i.category === cat.id).map(toMenuItem) }))`. Keep today's field mapping from `PosMenuItem` to `MenuItem`, with `id` and `_sanityId` set from `_id`.
- `categoriesForModal` becomes `dynamicCategories`.
- **The fallback banner** (when `!initialMenu`) reads `Could not load the menu. Reload to try again.`, with the existing Reload button.
- Comments that mention "built-in" are reworded.
- The ✎/✕ comment says every item is saved in Sanity.

**`ManageMenuModal.tsx`:**
- `DynamicCategory` is updated as above.
- The list shows every tab: drop the `!c.isBuiltIn` filter and rename the heading "Categories".

**`app/api/menu/categories/route.ts`:**
- Remove the `BUILT_IN_CATEGORIES` import and its 409.
- The max-order default becomes `?? 0`.
- The response drops `isBuiltIn`.

**`app/api/menu/settings/route.ts`:**
- Remove `HideAction`/`isHideAction` and that branch. A body that isn't a reorder gets 400 `'Invalid request body'`.
- Store `{ _id, _type: 'menuSettings', categoryOrder }`. This clears the unused `hiddenItemIds`, which is fine.

**Studio:**
- `menuItem.category` and `applicableCategories` lose `options.list`.
- The `category` description reads: `The id of a tab on the POS, for example signature or espresso (shown as Classic).`
- `menuCategory.order` drops "Built-in categories use 1–6."

**Delete** `app/pos/menuData.ts` and `app/pos/menuData.test.ts`.

- [ ] **Step 4: Run everything to make sure it passes**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`
Expected: all pass. `grep -rn "menuData\|BUILT_IN\|isBuiltIn\|hiddenItemIds" app lib --include=*.ts --include=*.tsx` finds nothing except in `scripts/`. `sanity/schemaTypes/menuSettings.ts` keeps its field, so stored data stays valid.

- [ ] **Step 5: No commit.**

---

### Task 4: Item and tab-order saves refresh `/menu`

**Files:**
- Modify: `app/api/menu/route.ts` (POST), `app/api/menu/[id]/route.ts` (PATCH, DELETE), `app/api/menu/settings/route.ts` (POST)
- Create: `app/api/menu/route.test.ts`, `app/api/menu/[id]/route.test.ts`, `app/api/menu/settings/route.test.ts`

**Interfaces:**
- Consumes `fetchMenuSettings` and `MENU_SETTINGS_ID` (Task 3).
- Produces no new exports. Each handler calls `revalidatePath('/menu')` from `next/cache` after its write succeeds.

- [ ] **Step 1: Write the failing tests.** Shared mocks for all three files:

```ts
const { requirePosAuth, create, del, commit, createOrReplace, fetch, revalidatePath } = vi.hoisted(() => ({
  requirePosAuth: vi.fn(), create: vi.fn(), del: vi.fn(), commit: vi.fn(), createOrReplace: vi.fn(), fetch: vi.fn(), revalidatePath: vi.fn(),
}))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/sanity/lib/writeClient', () => ({ getWriteClient: () => ({ create, delete: del, createOrReplace, patch: () => ({ set: () => ({ commit }) }) }) }))
vi.mock('@/sanity/lib/client', () => ({ client: { withConfig: () => ({ fetch }) } }))
// beforeEach: vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token'); requirePosAuth.mockResolvedValue(null); reset the rest.
```

**`app/api/menu/route.test.ts`:**
- **"adds an item and refreshes /menu":** POST `{ name: 'Americano', category: 'espresso', priceHot: 120, priceIce: 130 }`, with `create` resolving `{ _id: 'new' }`. Expect status 200, `create` called with `expect.objectContaining({ _type: 'menuItem', name: 'Americano', category: 'espresso', available: true })`, and `revalidatePath` called once with `'/menu'`.
- **"leaves /menu alone when the item is refused or not saved":**
  - POST without any price gives 400.
  - `create` rejecting gives 500.
  - In both cases `revalidatePath` is not called.

**`app/api/menu/[id]/route.test.ts`:** the handlers are called as `PATCH(req, { params: Promise.resolve({ id: 'abc' }) })`.
- **"an edit refreshes /menu":** PATCH body `{ name: 'Americano', category: 'espresso', priceHot: 125 }`; `fetch` resolves `{ _id: 'abc', category: 'espresso' }` and `commit` resolves. Expect 200 and `revalidatePath('/menu')`.
- **"a delete refreshes /menu, and it stays deleted":** `fetch` resolves `{ _id: 'abc' }`. Expect 200, `del` called with `'abc'`, and `revalidatePath('/menu')`.
- **"a missing item changes nothing":** `fetch` resolves `null` for PATCH and DELETE. Expect 404 for each, and `revalidatePath` not called.

**`app/api/menu/settings/route.test.ts`:**
- **"saves the dragged tab order and refreshes /menu":** `fetch` resolves `{ categoryOrder: [] }` for the settings read. POST `{ categoryOrder: ['espresso', 'signature'] }`. Expect `createOrReplace` called with `{ _id: 'menu-settings', _type: 'menuSettings', categoryOrder: ['espresso', 'signature'] }` and `revalidatePath('/menu')`.
- **"no longer hides items by id":** POST `{ itemId: 'cafe-latte', action: 'hide' }`. Expect 400 with error `'Invalid request body'`, and no `createOrReplace` and no `revalidatePath`.

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run app/api/menu`
Expected: FAIL on every `revalidatePath` assertion (it isn't called yet).

- [ ] **Step 3: Implement.** In each handler, call `revalidatePath('/menu')` straight after the Sanity write resolves, before building the 200 reply:
  - `app/api/menu/route.ts` POST
  - `app/api/menu/[id]/route.ts` PATCH and DELETE
  - `app/api/menu/settings/route.ts` POST

- [ ] **Step 4: Run them to make sure they pass**

Run: `npx vitest run app/api/menu` and `npx tsc --noEmit`
Expected: pass; exit 0.

- [ ] **Step 5: No commit.**

---

### Task 5: Tabs: add under any name, rename, delete with their items

**Files:**
- Create: `lib/menuCategoryLabel.ts`
- Modify: `app/api/menu/categories/route.ts` (POST uses the label rule and refreshes `/menu`)
- Modify: `app/api/menu/categories/[id]/route.ts` (new PATCH; DELETE rewritten; `BUILT_IN_IDS` removed)
- Create: `app/api/menu/categories/route.test.ts`, `app/api/menu/categories/[id]/route.test.ts`

**Interfaces:**
- Produces, in `lib/menuCategoryLabel.ts` (pure, also used by the modal in Task 6):
  - `export const MAX_CATEGORY_LABEL = 40`
  - `export function cleanCategoryLabel(value: unknown): string | null`, the trimmed label when it's 1–40 characters, otherwise `null`
- **PATCH `/api/menu/categories/[id]`** (`[id]` is the tab's `_sanityId`) takes body `{ label }` and answers:
  - 200 `{ success: true, category: ResolvedCategory }`
  - 400 `{ success: false, error: 'Name must be 1–40 characters.' }`
  - 404 `'Category not found'`
- **DELETE `/api/menu/categories/[id]`** answers 200 `{ success: true, deletedItems: number }`, or 404, or 500.

- [ ] **Step 1: Write the failing tests**

**Mocks:**
- `fetch` answers by query:
  - `'"menuCategory"'`: the tab doc
  - `'"menuItem"'`: item ids
  - `'"menuSettings"'`: the settings
- The write client is `{ create, mutate, patch }`, where `patch: vi.fn(() => ({ set }))` and `set: vi.fn(() => ({ commit }))`.
- `revalidatePath` and `requirePosAuth` are mocked as in Task 4.
- The tab fixture is `{ _id: 'menu-category-espresso', id: 'espresso', label: 'Espresso', type: 'drink', order: 2 }`.

**`app/api/menu/categories/[id]/route.test.ts`:**

```ts
it('renames a tab: only its name changes, and /menu refreshes', async () => {
  const res = await PATCH(req({ label: '  Classic ' }), params('menu-category-espresso'))
  expect(res.status).toBe(200)
  expect(patch).toHaveBeenCalledWith('menu-category-espresso')
  expect(set).toHaveBeenCalledWith({ label: 'Classic' })
  expect((await res.json()).category).toEqual({ _sanityId: 'menu-category-espresso', id: 'espresso', label: 'Classic', type: 'drink', order: 2 })
  expect(revalidatePath).toHaveBeenCalledWith('/menu')
})

it('refuses a blank name or one over 40 characters, and changes nothing', async () => {
  for (const body of [{ label: '   ' }, { label: 'x'.repeat(41) }, {}]) {
    const res = await PATCH(req(body), params('menu-category-espresso'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Name must be 1–40 characters.')
  }
  expect(patch).not.toHaveBeenCalled()
  expect(revalidatePath).not.toHaveBeenCalled()
})

it('deletes the tab, every item in it and its place in the tab order, in one write', async () => {
  answer({ tab, itemIds: ['a', 'b', 'c'], settings: { categoryOrder: ['signature', 'espresso', 'snack'] } })
  const res = await DELETE(req(), params('menu-category-espresso'))
  expect(await res.json()).toEqual({ success: true, deletedItems: 3 })
  expect(mutate).toHaveBeenCalledTimes(1)
  expect(mutate).toHaveBeenCalledWith([
    { delete: { id: 'menu-category-espresso' } },
    { delete: { id: 'a' } }, { delete: { id: 'b' } }, { delete: { id: 'c' } },
    { patch: { id: 'menu-settings', set: { categoryOrder: ['signature', 'snack'] } } },
  ])
  expect(revalidatePath).toHaveBeenCalledWith('/menu')
})

it('deletes a tab that has no place in the saved order without touching the settings', async () => {
  answer({ tab, itemIds: [], settings: null })
  await DELETE(req(), params('menu-category-espresso'))
  expect(mutate).toHaveBeenCalledWith([{ delete: { id: 'menu-category-espresso' } }])
})

it('changes nothing for a missing tab or a failed write', async () => {
  answer({ tab: null, itemIds: [], settings: null })
  expect((await DELETE(req(), params('nope'))).status).toBe(404)
  expect((await PATCH(req({ label: 'Classic' }), params('nope'))).status).toBe(404)
  answer({ tab, itemIds: ['a'], settings: null })
  mutate.mockRejectedValueOnce(new Error('down'))
  expect((await DELETE(req(), params('menu-category-espresso'))).status).toBe(500)
  expect(revalidatePath).not.toHaveBeenCalled()
})
```

The test file defines these helpers:
- `req(body?)`: a `NextRequest` with a JSON body
- `params(id)`: `{ params: Promise.resolve({ id }) }`
- `answer({ tab, itemIds, settings })`: sets `fetch`'s query-based implementation

**`app/api/menu/categories/route.test.ts`:**
- **"adds a tab under a former code name: re-adding Espresso brings the espresso id back":**
  - The existing-id query gives `[]` and the max-order query gives `[{ order: 9 }]`.
  - POST `{ label: 'Espresso', type: 'drink' }`.
  - Expect `create` called with `{ _type: 'menuCategory', id: 'espresso', label: 'Espresso', type: 'drink', order: 10 }`, and `revalidatePath('/menu')`.
- **"refuses a name already in use, or over 40 characters, without refreshing /menu":** the existing-id query gives `[{ _id: 'x' }]` and the answer is 409; `'x'.repeat(41)` gets 400. `create` and `revalidatePath` aren't called.

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run app/api/menu/categories`
Expected: FAIL. There's no PATCH export, DELETE still refuses tabs with items, and nothing calls `revalidatePath`.

- [ ] **Step 3: Implement**

**`lib/menuCategoryLabel.ts`:** as above.

**POST:**
- The label check uses `cleanCategoryLabel`, keeping its existing error text.
- `revalidatePath('/menu')` after `create`.

**PATCH:**
1. `cleanCategoryLabel(body?.label)`; when it's `null`, answer 400.
2. Read the tab: `*[_type == "menuCategory" && _id == $sanityId][0]{ _id, id, label, type, order }`, `no-store`. Missing gives 404.
3. `patch(_id).set({ label }).commit()`.
4. `revalidatePath('/menu')`.
5. Reply with the tab, with the new label and `_sanityId`.

**DELETE:**
1. Read the tab as above.
2. In parallel, read the items `*[_type == "menuItem" && category == $id]._id` (every item, available or not) and `fetchMenuSettings()`.
3. Make one `getWriteClient().mutate([...])` call, in this order:
   - delete the tab doc
   - delete each item id
   - only when `categoryOrder` includes the id: `{ patch: { id: MENU_SETTINGS_ID, set: { categoryOrder: without the id } } }`
4. `revalidatePath('/menu')`.
5. Reply with `deletedItems`.

Remove `BUILT_IN_IDS` and the "still used by N items" 409.

- [ ] **Step 4: Run them to make sure they pass**

Run: `npx vitest run app/api/menu` and `npx tsc --noEmit`
Expected: pass; exit 0.

- [ ] **Step 5: No commit.**

---

### Task 6: The category manager: Rename and Delete on every tab

**Files:**
- Create: `app/pos/categoryEdits.ts`, `app/pos/categoryEdits.test.ts`
- Modify: `app/pos/ManageMenuModal.tsx`
- Create: `app/pos/ManageMenuModal.test.tsx`
- Modify: `app/pos/POSClient.tsx`

**Interfaces:**
- Consumes `loyaltyPerksOf` (Task 2), `MAX_CATEGORY_LABEL` (Task 5), and `DynamicCategory` and `PosMenuItem` (Task 3).
- Produces, in `app/pos/categoryEdits.ts`:
  - `export function deletePrompt(tab: { id: string; label: string }, itemCount: number): { question: string; loyaltyLine: string | null }`
  - `export interface MenuState { categories: DynamicCategory[]; items: PosMenuItem[]; categoryOrder: string[]; activeCategoryId: string | null }`
  - `export function withoutTab(state: MenuState, tabId: string): MenuState`
- Produces, in `ManageMenuModal.tsx`:
  - The props become `{ categories: DynamicCategory[] /* every tab, tab-bar order */; itemCounts: Readonly<Record<string, number>>; onClose(): void; onCategoryAdded(tab: DynamicCategory): void; onCategoryRenamed(tab: DynamicCategory): void; onCategoryDeleted(tab: DynamicCategory): void }`
  - `export function CategoryRow(props: { tab: DynamicCategory; itemCount: number; mode: 'view' | 'rename' | 'confirm'; busy: boolean; onRename(): void; onDelete(): void; onCancel(): void; onSave(label: string): void; onConfirmDelete(): void })`

- [ ] **Step 1: Write the failing tests**

Create `app/pos/categoryEdits.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { deletePrompt, withoutTab, type MenuState } from './categoryEdits'

describe('deleting a tab', () => {
  it('asks first, with the item count and what the tab gives on loyalty cards', () => {
    expect(deletePrompt({ id: 'espresso', label: 'Classic' }, 3)).toEqual({
      question: 'Delete Classic and its 3 items? This can’t be undone.',
      loyaltyLine: 'Classic gives loyalty stamps, the free drink and 10% off. A tab you add later won’t, even with the same name.',
    })
    expect(deletePrompt({ id: 'waffle', label: 'Waffle' }, 1)).toEqual({
      question: 'Delete Waffle and its 1 item? This can’t be undone.',
      loyaltyLine: 'Waffle gives loyalty stamps and 10% off. A tab you add later won’t, even with the same name.',
    })
    expect(deletePrompt({ id: 'signature', label: 'Signature' }, 0).loyaltyLine)
      .toBe('Signature gives loyalty stamps. A tab you add later won’t, even with the same name.')
    expect(deletePrompt({ id: 'add-ons-food', label: 'ADD ONS FOOD' }, 0)).toEqual({ question: 'Delete ADD ONS FOOD?', loyaltyLine: null })
  })

  const tab = (id: string) => ({ id, label: id, type: 'drink' as const, order: 1, _sanityId: `menu-category-${id}` })
  const item = (id: string, category: string) => ({
    _id: id, name: id, subtitle: null, category, priceHot: null, priceIce: 120, priceFixed: null,
    addonType: null, hiddenFromPos: false, applicableCategories: null,
  })
  const state = (activeCategoryId: string | null): MenuState => ({
    categories: [tab('signature'), tab('espresso'), tab('snack')],
    items: [item('a', 'espresso'), item('b', 'espresso'), item('c', 'snack')],
    categoryOrder: ['signature', 'espresso', 'snack'],
    activeCategoryId,
  })

  it('takes the tab, its items and its place in the order off the POS, and moves an open tab to the first', () => {
    expect(withoutTab(state('espresso'), 'espresso')).toEqual({
      categories: [tab('signature'), tab('snack')],
      items: [item('c', 'snack')],
      categoryOrder: ['signature', 'snack'],
      activeCategoryId: null,
    })
    expect(withoutTab(state('snack'), 'espresso').activeCategoryId).toBe('snack')
  })
})
```

Create `app/pos/ManageMenuModal.test.tsx` (static markup):

```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ManageMenuModal, { CategoryRow } from './ManageMenuModal'

const noop = () => {}
const tab = (id: string, label: string) => ({ id, label, type: 'drink' as const, order: 1, _sanityId: `menu-category-${id}` })
const tabs = [tab('signature', 'Signature'), tab('espresso', 'Classic'), tab('add-ons', 'Add ons')]
const row = (mode: 'view' | 'rename' | 'confirm') => renderToStaticMarkup(
  <CategoryRow tab={tabs[1]} itemCount={3} mode={mode} busy={false} onRename={noop} onDelete={noop} onCancel={noop} onSave={noop} onConfirmDelete={noop} />,
)

describe('the category manager', () => {
  it('lists every tab, Add ons included, each with Rename and Delete, and still adds tabs', () => {
    const html = renderToStaticMarkup(
      <ManageMenuModal categories={tabs} itemCounts={{ espresso: 3 }} onClose={noop} onCategoryAdded={noop} onCategoryRenamed={noop} onCategoryDeleted={noop} />,
    )
    for (const name of ['>Signature<', '>Classic<', '>Add ons<']) expect(html).toContain(name)
    expect(html.match(/>Rename</g)).toHaveLength(3)
    expect(html.match(/>Delete</g)).toHaveLength(3)
    expect(html).toContain('Add Category')
  })

  it('renames in place, up to 40 characters', () => {
    const html = row('rename')
    expect(html).toContain('value="Classic"')
    expect(html).toContain('maxLength="40"')
    expect(html).toContain('>Save<')
    expect(html).toContain('>Cancel<')
  })

  it('asks before deleting, with the item count and the loyalty warning', () => {
    const html = row('confirm')
    expect(html).toContain('Delete Classic and its 3 items? This can’t be undone.')
    expect(html).toContain('Classic gives loyalty stamps, the free drink and 10% off.')
    expect(html).toContain('>Delete<')
    expect(html).toContain('>Cancel<')
  })
})
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run app/pos/categoryEdits.test.ts app/pos/ManageMenuModal.test.tsx`
Expected: FAIL. The module is missing, and the modal has no Rename or `CategoryRow`.

- [ ] **Step 3: Implement**

**`deletePrompt`:**
- `question` is `` `Delete ${label} and its ${n} item${n === 1 ? '' : 's'}? This can’t be undone.` ``, or `` `Delete ${label}?` `` when the tab has no items.
- `loyaltyLine` joins the perks, in the order "loyalty stamps", "the free drink", "10% off", with `', '` and a final `' and '`. It reads `` `${label} gives ${perks}. A tab you add later won’t, even with the same name.` ``, or `null` when the tab has no perks.

**`withoutTab`:**
- It drops the tab, its items and its `categoryOrder` entry.
- `activeCategoryId` becomes `null` only when it was that tab.

**`ManageMenuModal`:**
- **State:** `editing: { id: string; mode: 'rename' | 'confirm' } | null`, `busy` and `error`.
- **Rename** sends PATCH `/api/menu/categories/${tab._sanityId}` with `{ label }`, then `onCategoryRenamed(data.category)` and back to view.
- **Delete** confirms, then sends DELETE to the same URL, then `onCategoryDeleted(tab)`.
- **Errors:** a failure shows the route's `error` in the existing red line (`'Network error. Try again.'` when the request fails). Buttons are disabled while `busy`.

**`CategoryRow`:**
- **view:** the label, the type, and the Rename and Delete buttons.
- **rename:** an input with `defaultValue`/state from the label, `maxLength={MAX_CATEGORY_LABEL}`, and Save (disabled when the trimmed value is empty) and Cancel.
- **confirm:** `deletePrompt` text, with a red Delete and Cancel.

The Add Category form stays.

**`POSClient.tsx`:**
- Pass `categories={sortedMenu.map((t) => dynamicCategories.find((c) => c.id === t.id)).filter((c): c is DynamicCategory => c !== undefined)}`.
- Pass `itemCounts`, a `useMemo` count of `dynamicItems` by `category`.
- Pass `onCategoryRenamed`, which updates that tab's `label` in `dynamicCategories`.
- Pass `onCategoryDeleted`, which applies `withoutTab` to `{ categories: dynamicCategories, items: dynamicItems, categoryOrder, activeCategoryId }` and sets all four.
- Remove the old `handleCategoryDeleted(sanityId)`.

- [ ] **Step 4: Run them to make sure they pass**

Run: `npx vitest run app/pos` and `npx tsc --noEmit`
Expected: pass; exit 0.

- [ ] **Step 5: No commit.**

---

### Task 7: The POS keeps the last menu it loaded

**Files:**
- Create: `app/pos/savedMenu.ts`, `app/pos/savedMenu.test.ts`
- Modify: `app/pos/POSClient.tsx`

**Interfaces:**
- Consumes `PosMenu` (Task 3).
- Produces:
  - `export const SAVED_MENU_KEY = 'unwnd.pos.lastMenu'`
  - `export function saveMenu(menu: PosMenu, storage?: Pick<Storage, 'setItem'>): void`
  - `export function readSavedMenu(storage?: Pick<Storage, 'getItem'>): PosMenu | null`
  - The default storage is `globalThis.localStorage`, read inside the `try`, so a server render or blocked storage never throws.

- [ ] **Step 1: Write the failing test** `app/pos/savedMenu.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import type { PosMenu } from '@/lib/posMenu'
import { SAVED_MENU_KEY, readSavedMenu, saveMenu } from './savedMenu'

function memory() {
  const items = new Map<string, string>()
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) }
}
const menu: PosMenu = {
  categories: [{ id: 'espresso', label: 'Classic', type: 'drink', order: 2, _sanityId: 'menu-category-espresso' }],
  items: [{ _id: 'a', name: 'Americano', subtitle: null, category: 'espresso', priceHot: 120, priceIce: 130, priceFixed: null, addonType: null, hiddenFromPos: false, applicableCategories: null }],
  categoryOrder: ['espresso'],
}

describe('the last menu this tablet loaded', () => {
  it('is kept, to show when the next load fails', () => {
    const storage = memory()
    saveMenu(menu, storage)
    expect(readSavedMenu(storage)).toEqual(menu)
  })

  it('is ignored when missing, corrupt, half-written or of another shape', () => {
    const storage = memory()
    expect(readSavedMenu(storage)).toBeNull()
    for (const text of ['{not json', JSON.stringify({ categories: 'x' }), JSON.stringify({ categories: [], items: [] }), 'null']) {
      storage.setItem(SAVED_MENU_KEY, text)
      expect(readSavedMenu(storage)).toBeNull()
    }
  })

  it('never breaks the POS when storage is refused', () => {
    const refusing = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
    expect(() => saveMenu(menu, refusing)).not.toThrow()
    expect(readSavedMenu(refusing)).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run app/pos/savedMenu.test.ts`
Expected: FAIL, because `./savedMenu` can't be resolved.

- [ ] **Step 3: Implement**

**`savedMenu.ts`:** a menu read back counts only when `categories`, `items` and `categoryOrder` are all arrays.

**`POSClient.tsx`:**
- **Saving:** `useEffect(() => { if (initialMenu) saveMenu({ categories: dynamicCategories, items: dynamicItems, categoryOrder }) }, [initialMenu, dynamicCategories, dynamicItems, categoryOrder])`. This keeps the live menu, with this session's edits, for next time.
- **Fallback state:** `const [showingSavedMenu, setShowingSavedMenu] = useState(false)`.
- **Loading the saved menu:** an effect that, when `!initialMenu`, does `void Promise.resolve().then(() => { const saved = readSavedMenu(); if (saved) { setDynamicCategories(saved.categories); setDynamicItems(saved.items); setCategoryOrder(saved.categoryOrder); setShowingSavedMenu(true) } })`.
- **The banner** reads `showingSavedMenu ? 'Could not load the live menu. Showing the last menu this tablet loaded; prices may be out of date.' : 'Could not load the menu. Reload to try again.'`.
- **Editing stays off** on the saved menu: `canEditMenu(managerUnlocked, initialMenu)` is unchanged.

- [ ] **Step 4: Run everything to make sure it passes**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`
Expected: all pass. Task 3's "shows no menu and asks for a reload" test still passes, since effects don't run in static markup.

- [ ] **Step 5: No commit.**

---

### Task 8: Ship it

**Files:**
- Commit everything from Tasks 1–7, plus `docs/superpowers/specs/2026-10-20-pos-owns-the-menu-design.md` and this plan.

- [ ] **Step 1: Run the full checks**

Run: `npx vitest run`, `npx tsc --noEmit`, `npm run lint`, `npm run build`
Expected:
- every test passes
- tsc and lint exit 0
- the build's route table shows `/menu` as static with a `1m` revalidate, and `/pos` dynamic

- [ ] **Step 2: Review the whole feature.** Dispatch a fresh reviewer (code-reviewer) on the full diff against `ecc312f`, with the spec. Fix CRITICAL and HIGH findings, then re-run Step 1.

- [ ] **Step 3: Run the verification command** (the owner's rule before a commit): build, types, lint, tests, secrets and `console.log` scan.

- [ ] **Step 4: Ask the owner for the go-ahead to move the six tabs into the live menu.** Stop until they say yes.

- [ ] **Step 5: Run the move**

Run: `node --env-file=.env.local scripts/move-code-tabs-to-sanity.ts`
Expected, the first time:

```
created signature (Signature)
created espresso (Classic)
created non-coffee (Non-Coffee)
created meal (Meal)
created waffle (Waffle)
created snack (Snack)
```

- [ ] **Step 6: Read the move back** (public, no token)

Run: `curl -s -G "https://mguahlyz.api.sanity.io/v2026-03-09/data/query/production" --data-urlencode 'query=*[_type=="menuCategory"]|order(order asc){_id,id,label}'`
Expected:
- the six `menu-category-*` docs, with `espresso` labelled `Classic`
- plus `add-ons`, `matcha-series` and `add-ons-food`
- no duplicate `id`

- [ ] **Step 7: Commit once, then push**

```bash
git add -A app lib scripts sanity vitest.config.ts docs/superpowers/specs/2026-10-20-pos-owns-the-menu-design.md docs/superpowers/plans/2026-10-20-pos-owns-the-menu.md
git commit   # "feat(pos): the POS owns the menu: edit, rename and delete everything, /menu follows"
             # Body: "Owner feedback." + what changed, the move, and the Co-Authored-By trailer
git push origin main
```

Expected: `ecc312f..<new> main -> main`.

- [ ] **Step 8: The owner checks on the live POS after Vercel deploys.** Use throwaway names, because the POS writes to the live menu.
  1. Add four test items in a row; reload. They're still in the order added.
  2. Edit one test item's price; refresh `/menu`. The new price shows.
  3. Delete a test item; reload. It stays gone.
  4. Add a test tab, rename it, then delete it. The prompt shows the item count.
  5. Rename and Delete appear on Classic too, with the loyalty warning. Cancel it.

- [ ] **Step 9: Update memory** (`project_pos_owns_the_menu.md`) with the commit hash and that the move ran.
