# Google Review 10% Discount Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the cashier give a 10% "Google Review" discount on one order line or on every eligible line at once, alongside the existing per-line 20% PWD/Senior discount, with the discount shown in the order panel, the review screen and the receipt, and saved with the sale.

**Architecture:** Every order line carries at most one discount kind (`'pwd' | 'review'`). All discount math and state transitions move out of `POSClient.tsx` into a pure, unit-tested module (`app/pos/discounts.ts`); the persisted request body is built by a second pure module (`app/pos/salePayload.ts`). The existing per-line `%` button opens an inline "Discount" row (same mechanic as the Customize and Add-ons rows) offering the two kinds; a footer button applies the review discount to every eligible line in one tap. No Sanity schema or API route changes: the saved `discounts[]` rows keep their `{ lineId, name, amount }` shape.

**Tech Stack:** Next.js 16.2 / React 19.2 / TypeScript 5 (strict), Tailwind 4, Sanity 4. New dev dependency: Vitest (the repo has no test runner today).

**Spec:** No separate spec file. This was designed in chat as a bounded change; the **Design** section below is the binding authority, and the "Decisions" items in it are assumptions made on the owner's behalf that the final message must surface.

## Design

### What exists today (verified in code at commit 38a9835)

- The 20% PWD/Senior discount is already **per line**: `OrderItem.pwdDiscounted`, toggled by the `%` button on each parent line row (`POSClient.tsx` ~L1001-1011, handler `toggleItemPwdDiscount` ~L218).
- PWD amount = `Math.round((item.price + attachedAddonsTotal) * 0.20)` — **one unit** plus that line's add-ons, not the whole quantity (one ID = one person's own order). Lines are split into "PWD Food −20%" (variant `null`) and "PWD Drink −20%" (hot/ice) rows.
- Saved discounts: `discounts: LineDiscount[]` = `{ lineId, name, amount }`, posted to `POST /api/sales`, which uses `_key: d.lineId` — so **one discount row per line** unless the API changes. Names are pre-formatted with an ASCII hyphen (`PWD Food -20% (Name)`) because the ESC/POS encoder has no glyph for the Unicode minus.
- The receipt (`lib/printer/*`) prints whatever `discounts[]` rows were saved, generically. The sales dashboard shows no discount detail.
- The API validator ignores unknown fields on items, so extra client-side fields on `OrderItem` are harmless in the posted body.

### Decisions (rulings made without the owner's answer — surface them)

1. **No stacking.** A line is in exactly one state: none, PWD/Senior 20%, or Google Review 10%. Rationale: PH SC/PWD rules let the customer take the statutory discount *or* a promo, whichever is higher, never both; 20% always beats 10%. Cost if wrong: a `kind[]`/second `_key` per line and an ordering rule would be needed — moderate rework, none of the persisted data would be wrong.
2. **Per-line data, whole-order convenience.** The review discount is stored per line. A footer button "Google Review −10% · all items" sets it on every *eligible* line (parent lines not carrying PWD); tapping it when they all already have it clears it from them. Cost if wrong: if the owner wanted a true order-level 10% (one row, computed on the post-PWD total), the footer button and one function change; the receipt would show one row instead of one per item.
3. **UI lives under the existing `%` button.** Tapping `%` opens an inline "Discount" row below the item list (exactly like Customize) with two chips: "PWD/Senior −20%" and "Google Review −10%". Tapping a chip applies it and closes the row; tapping the chip already active clears the discount. PWD costs one extra tap versus today. Cost if wrong: swap the row for a second per-line button — small.
4. **Review amount covers the whole line:** `Math.round((item.price * item.qty + attachedAddonsTotal) * 0.10)`. Unlike PWD (one unit), a review is a promo on the customer's order, not a per-person statutory discount. Cost if wrong: one line in `lineDiscountAmount`.
5. **Labels.** Chip/badge: `PWD/Senior −20%`, `Google Review −10%`. Breakdown rows: `PWD Food −20% (Name)`, `PWD Drink −20% (Name)`, `Google Review −10% (Name)`. Order-panel line badge: `SC/PWD −20% applied` (unchanged) / `Google Review −10% applied`. Persisted name: same as the row label with an ASCII hyphen, e.g. `Google Review -10% (Spanish Latte)`.
6. **Breakdown rows follow order-line order** (previously all food rows, then all drink rows). Cost if wrong: a sort.
7. **Testing.** Add Vitest. Unit-test the pure modules and static-render the two presentational components with `react-dom/server`. `POSClient.tsx` (uses `useRouter`) is verified by `tsc`, ESLint, the full suite and `next build`, not by a unit test.

### Out of scope

Verifying the review in-app; showing discounts in the sales dashboard; any change to the Sanity schema, the API route, or the printer code.

## Global Constraints

- Node v24 / npm 11; Next.js 16.2.6; React 19.2.3; TypeScript strict; ESLint via `eslint.config.mjs` (`npm run lint`).
- Money is whole pesos: `Math.round(...)` for discount amounts, `.toFixed(0)` for display, `₱` prefix.
- Unicode minus `−` in on-screen labels; ASCII hyphen `-` in persisted discount names.
- Never mutate order items: every transition returns a new array (`items.map(...)` with object spread).
- POS components start with `'use client'`.
- `OrderItem.pwdDiscounted` is removed in the last task; until then both fields coexist so every commit type-checks.
- No changes under `sanity/`, `app/api/`, or `lib/printer/`.
- Commits: conventional-commit subject, body explaining why, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` (matches this repo's history).

## Review Focus

1. Switching a PWD line to review must *replace*, never stack — pinned in Task 2 (`replaces PWD with review rather than stacking them`).
2. The footer "all items" tap must skip PWD lines and add-on lines both when applying and when clearing — pinned in Task 2 (`toggleReviewForAll` tests).
3. Review uses the whole quantity, PWD one unit, add-ons included in both, half-peso rounds up — pinned in Task 1 (`lineDiscountAmount` tests).
4. Persisted names keep the receipt convention (ASCII hyphen) and there is at most one discount row per `lineId` (the API's `_key`) — pinned in Task 1 (`savedDiscountName`) and Task 5 (`buildSalePayload` uniqueness test).
5. Removing a line (qty to 0) while its Discount row is open must close the row, and Clear must reset it — `POSClient` only, no unit test possible; verified by reading the diff in Task 6 and by the final reviewer.

---

## File Structure

- Create `vitest.config.ts` — test runner config (node environment, automatic JSX).
- Modify `package.json` — `vitest` dev dependency, `"test": "vitest run"` script.
- Modify `app/pos/types.ts` — `LineDiscountKind`, `OrderItem.discount`, `DiscountLine` (Task 1); remove `pwdDiscounted` (Task 6).
- Modify `app/pos/utils.ts` — export `isAddonLine`, use it in the two grouping helpers.
- Create `app/pos/discounts.ts` — rates, labels, amounts, `buildDiscountLines`, `savedDiscountName` (Task 1); transitions `toggleLineDiscount`, `isReviewEligible`, `allEligibleHaveReview`, `toggleReviewForAll` (Task 2).
- Create `app/pos/discounts.test.ts`.
- Create `app/pos/DiscountPickerRow.tsx` + `app/pos/DiscountPickerRow.test.tsx` — the inline two-chip row.
- Modify `app/pos/OrderReviewModal.tsx` + create `app/pos/OrderReviewModal.test.tsx` — consume `DiscountLine[]`, badge by kind.
- Create `app/pos/salePayload.ts` + `app/pos/salePayload.test.ts` — the `POST /api/sales` body.
- Modify `app/pos/POSClient.tsx` — state, handlers, memos, OrderPanel props/UI, footer button, `completeSale`.

---

### Task 1: Test runner, discount amounts and labels

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`
- Modify: `app/pos/types.ts`
- Modify: `app/pos/utils.ts`
- Create: `app/pos/discounts.ts`
- Test: `app/pos/discounts.test.ts`

**Interfaces:**
- Consumes: `OrderItem`, `LineDiscount` from `app/pos/types.ts`.
- Produces:
  - `types.ts`: `type LineDiscountKind = 'pwd' | 'review'`; `OrderItem.discount?: LineDiscountKind`; `interface DiscountLine extends LineDiscount { kind: LineDiscountKind; label: string }`.
  - `utils.ts`: `isAddonLine(item: { lineId: string }): boolean`.
  - `discounts.ts`: `DISCOUNT_RATES: Record<LineDiscountKind, number>`; `DISCOUNT_LABELS: Record<LineDiscountKind, string>`; `attachedAddonsTotal(items: OrderItem[], lineId: string): number`; `lineDiscountAmount(item: OrderItem, addonsTotal: number, kind: LineDiscountKind): number`; `discountRowLabel(kind: LineDiscountKind, item: OrderItem): string`; `buildDiscountLines(items: OrderItem[]): DiscountLine[]`; `totalDiscount(lines: DiscountLine[]): number`; `savedDiscountName(line: DiscountLine): string`.

- [ ] **Step 1: Install Vitest and add the test script**

Run: `npm install --save-dev vitest && npm pkg set scripts.test="vitest run"`
Expected: `package.json` devDependencies contains `"vitest"`, scripts contains `"test": "vitest run"`.

- [ ] **Step 2: Create the runner config**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

// Node environment is enough: the pure modules need no DOM, and the two
// presentational components are checked with react-dom/server static markup.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['app/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
```

- [ ] **Step 3: Add the shared types**

In `app/pos/types.ts`, add above `OrderItem`:
```ts
/** The one discount an order line can carry: statutory PWD/Senior (20%) or the Google Review promo (10%). */
export type LineDiscountKind = 'pwd' | 'review'
```
In `OrderItem`, directly below `pwdDiscounted?: boolean` (keep that field for now — Task 6 removes it):
```ts
  /** Which discount this line carries, if any — at most one, since PWD/Senior and promo discounts never stack. */
  discount?: LineDiscountKind
```
Directly below the `LineDiscount` interface:
```ts
/**
 * A LineDiscount plus what the live UI needs to render it. `name` is the item's
 * name, `label` the row prefix ("PWD Drink −20%", "Google Review −10%").
 */
export interface DiscountLine extends LineDiscount {
  kind: LineDiscountKind
  label: string
}
```

- [ ] **Step 4: Export `isAddonLine` from utils and use it in the grouping helpers**

In `app/pos/utils.ts`, add after the imports:
```ts
// Add-on lines carry the load-bearing 'addon__' lineId prefix (set where the
// order panel attaches an add-on) — the one reliable way to tell an add-on line
// from an orderable menu item, in the live cart and in saved sales alike.
export function isAddonLine(item: { lineId: string }): boolean {
  return item.lineId.startsWith('addon__')
}
```
In `groupOrderItems`, replace the two filters with:
```ts
  const parentItems = items.filter(i => !isAddonLine(i))
  const addonItems  = items.filter(isAddonLine)
```
In `groupSaleItems`, replace `const isAddon = item.lineId.startsWith('addon__')` with `const isAddon = isAddonLine(item)`.

- [ ] **Step 5: Write the failing tests**

`app/pos/discounts.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import type { OrderItem } from './types'
import {
  DISCOUNT_LABELS,
  attachedAddonsTotal,
  lineDiscountAmount,
  discountRowLabel,
  buildDiscountLines,
  totalDiscount,
  savedDiscountName,
} from './discounts'

const item = (over: Partial<OrderItem> & { lineId: string }): OrderItem =>
  ({ name: 'Spanish Latte', variant: 'ice', price: 150, qty: 1, ...over })

const addon = (parentLineId: string, price: number, qty = 1): OrderItem =>
  ({ lineId: `addon__${parentLineId}-${price}`, name: 'Extra Shot', variant: null, price, qty, parentLineId })

describe('attachedAddonsTotal', () => {
  it('sums price × qty of the add-ons attached to the line', () => {
    const items = [item({ lineId: 'a' }), addon('a', 20, 2), addon('b', 15)]
    expect(attachedAddonsTotal(items, 'a')).toBe(40)
  })

  it('is 0 for a line with no add-ons', () => {
    expect(attachedAddonsTotal([item({ lineId: 'a' })], 'a')).toBe(0)
  })
})

describe('lineDiscountAmount', () => {
  it('PWD takes 20% of one unit plus add-ons, ignoring extra quantity', () => {
    // (150 + 20) × 0.20 = 34 — the second latte stays full price
    expect(lineDiscountAmount(item({ lineId: 'a', price: 150, qty: 2 }), 20, 'pwd')).toBe(34)
  })

  it('review takes 10% of the whole line plus add-ons', () => {
    // (150 × 2 + 20) × 0.10 = 32
    expect(lineDiscountAmount(item({ lineId: 'a', price: 150, qty: 2 }), 20, 'review')).toBe(32)
  })

  it('rounds half a peso up', () => {
    // 125 × 0.10 = 12.5 → 13
    expect(lineDiscountAmount(item({ lineId: 'a', price: 125, qty: 1 }), 0, 'review')).toBe(13)
  })
})

describe('discountRowLabel', () => {
  it('splits PWD into Food (no variant) and Drink (hot/ice)', () => {
    expect(discountRowLabel('pwd', item({ lineId: 'a', variant: null }))).toBe('PWD Food −20%')
    expect(discountRowLabel('pwd', item({ lineId: 'a', variant: 'hot' }))).toBe('PWD Drink −20%')
  })

  it('uses one label for the review promo whatever the item', () => {
    expect(discountRowLabel('review', item({ lineId: 'a', variant: null }))).toBe('Google Review −10%')
    expect(discountRowLabel('review', item({ lineId: 'a', variant: 'ice' }))).toBe(DISCOUNT_LABELS.review)
  })
})

describe('buildDiscountLines', () => {
  it('returns one row per discounted line, in order-line order, with add-ons included', () => {
    const items = [
      item({ lineId: 'a', name: 'Latte', variant: 'hot', price: 150, qty: 2, discount: 'review' }),
      addon('a', 20),
      item({ lineId: 'b', name: 'Croissant', variant: null, price: 100, qty: 1 }),
      item({ lineId: 'c', name: 'Mocha', variant: 'ice', price: 170, qty: 1, discount: 'pwd' }),
    ]
    expect(buildDiscountLines(items)).toEqual([
      { lineId: 'a', name: 'Latte', amount: 32, kind: 'review', label: 'Google Review −10%' },
      { lineId: 'c', name: 'Mocha', amount: 34, kind: 'pwd', label: 'PWD Drink −20%' },
    ])
  })

  it('never gives an add-on line a row of its own, even if flagged', () => {
    const items = [item({ lineId: 'a' }), { ...addon('a', 20), discount: 'review' as const }]
    expect(buildDiscountLines(items)).toEqual([])
  })

  it('is empty when nothing is discounted', () => {
    expect(buildDiscountLines([item({ lineId: 'a' })])).toEqual([])
  })
})

describe('totalDiscount', () => {
  it('sums the row amounts', () => {
    expect(totalDiscount([
      { lineId: 'a', name: 'Latte', amount: 32, kind: 'review', label: 'Google Review −10%' },
      { lineId: 'c', name: 'Mocha', amount: 34, kind: 'pwd', label: 'PWD Drink −20%' },
    ])).toBe(66)
  })
})

describe('savedDiscountName', () => {
  it('keeps the receipt convention: ASCII hyphen, item name in parentheses', () => {
    expect(savedDiscountName({ lineId: 'a', name: 'Spanish Latte', amount: 32, kind: 'review', label: 'Google Review −10%' }))
      .toBe('Google Review -10% (Spanish Latte)')
    expect(savedDiscountName({ lineId: 'c', name: 'Mocha', amount: 34, kind: 'pwd', label: 'PWD Drink −20%' }))
      .toBe('PWD Drink -20% (Mocha)')
  })
})
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npm test -- app/pos/discounts.test.ts`
Expected: FAIL — the suite cannot load `./discounts` (module not found), 0 passing.

- [ ] **Step 7: Implement `discounts.ts`**

`app/pos/discounts.ts`:
```ts
import type { DiscountLine, LineDiscountKind, OrderItem } from './types'
import { isAddonLine } from './utils'

// Discount rules for one order line. A line carries at most one discount: the
// statutory PWD/Senior discount and a promo never stack (the customer gets the
// higher one, and 20% always beats 10%), so "switch" is the only transition.

export const DISCOUNT_RATES: Record<LineDiscountKind, number> = {
  pwd: 0.20,
  review: 0.10,
}

/** Chip / badge label for each kind. Unicode minus — on-screen only, never persisted. */
export const DISCOUNT_LABELS: Record<LineDiscountKind, string> = {
  pwd: 'PWD/Senior −20%',
  review: 'Google Review −10%',
}

/** Sum of the add-ons attached to a line (price × qty each). */
export function attachedAddonsTotal(items: OrderItem[], lineId: string): number {
  return items
    .filter(i => i.parentLineId === lineId)
    .reduce((sum, i) => sum + i.price * i.qty, 0)
}

// PWD/Senior: 20% off ONE unit plus its add-ons — one ID covers one person's own
// order, so extra quantity on the same line stays full price. Google Review: a
// promo on the customer's order, so 10% off the whole line. Whole pesos, .5 up.
export function lineDiscountAmount(item: OrderItem, addonsTotal: number, kind: LineDiscountKind): number {
  const base = kind === 'pwd' ? item.price + addonsTotal : item.price * item.qty + addonsTotal
  return Math.round(base * DISCOUNT_RATES[kind])
}

// Breakdown-row label. PWD keeps its Food/Drink split (the name the receipt has
// always printed); the review promo is one label whatever the item.
export function discountRowLabel(kind: LineDiscountKind, item: OrderItem): string {
  if (kind === 'review') return DISCOUNT_LABELS.review
  return item.variant === null ? 'PWD Food −20%' : 'PWD Drink −20%'
}

/** One row per discounted order line, in order-line order. Add-on lines never carry a discount of their own. */
export function buildDiscountLines(items: OrderItem[]): DiscountLine[] {
  return items.flatMap((item): DiscountLine[] => {
    const kind = item.discount
    if (!kind || isAddonLine(item)) return []
    return [{
      lineId: item.lineId,
      name: item.name,
      amount: lineDiscountAmount(item, attachedAddonsTotal(items, item.lineId), kind),
      kind,
      label: discountRowLabel(kind, item),
    }]
  })
}

export function totalDiscount(lines: DiscountLine[]): number {
  return lines.reduce((sum, d) => sum + d.amount, 0)
}

// The persisted name — exactly what the receipt prints and what sales history
// reprints. ASCII hyphen: the thermal encoder has no glyph for the on-screen minus.
export function savedDiscountName(line: DiscountLine): string {
  return `${line.label.replace('−', '-')} (${line.name})`
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test -- app/pos/discounts.test.ts`
Expected: PASS, 12 tests, 0 failures. Also run `npx tsc --noEmit` — Expected: no output, exit 0.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts app/pos/types.ts app/pos/utils.ts app/pos/discounts.ts app/pos/discounts.test.ts
git commit -m "feat(pos): discount rules module with PWD and Google Review amounts

Pulls the per-line discount math out of POSClient into a pure, tested
module ahead of adding the 10% Google Review promo. A line can carry one
discount kind ('pwd' | 'review'); PWD keeps its one-unit-plus-add-ons
base and Food/Drink row labels, review takes 10% of the whole line.
savedDiscountName keeps the ASCII-hyphen receipt convention.

Adds Vitest as the repo's first test runner (node env, static markup
for components) and exports isAddonLine from utils so the 'addon__'
prefix check lives in one place.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Line discount transitions (toggle, eligibility, review-all)

**Files:**
- Modify: `app/pos/discounts.ts`
- Test: `app/pos/discounts.test.ts`

**Interfaces:**
- Consumes: `OrderItem`, `LineDiscountKind` from `types.ts`; `isAddonLine` from `utils.ts`.
- Produces (`discounts.ts`): `toggleLineDiscount(items: OrderItem[], lineId: string, kind: LineDiscountKind): OrderItem[]`; `isReviewEligible(item: OrderItem): boolean`; `allEligibleHaveReview(items: OrderItem[]): boolean`; `toggleReviewForAll(items: OrderItem[]): OrderItem[]`.

- [ ] **Step 1: Write the failing tests**

Append to `app/pos/discounts.test.ts` (extend the import from `./discounts` with `toggleLineDiscount, isReviewEligible, allEligibleHaveReview, toggleReviewForAll`):
```ts
describe('toggleLineDiscount', () => {
  const items = [item({ lineId: 'a' }), item({ lineId: 'b', discount: 'pwd' })]

  it('puts the kind on a line that had none, without touching the original array', () => {
    const next = toggleLineDiscount(items, 'a', 'review')
    expect(next[0].discount).toBe('review')
    expect(items[0].discount).toBeUndefined()
    expect(next).not.toBe(items)
  })

  it('clears the discount when the line already has that kind', () => {
    expect(toggleLineDiscount(items, 'b', 'pwd')[1].discount).toBeUndefined()
  })

  it('replaces PWD with review rather than stacking them', () => {
    expect(toggleLineDiscount(items, 'b', 'review')[1].discount).toBe('review')
  })

  it('leaves every other line as it was', () => {
    expect(toggleLineDiscount(items, 'a', 'review')[1]).toBe(items[1])
  })
})

describe('isReviewEligible', () => {
  it('accepts an orderable line with no discount or with the review discount', () => {
    expect(isReviewEligible(item({ lineId: 'a' }))).toBe(true)
    expect(isReviewEligible(item({ lineId: 'a', discount: 'review' }))).toBe(true)
  })

  it('rejects a PWD line and any add-on line', () => {
    expect(isReviewEligible(item({ lineId: 'a', discount: 'pwd' }))).toBe(false)
    expect(isReviewEligible(addon('a', 20))).toBe(false)
  })
})

describe('allEligibleHaveReview', () => {
  it('is false with no eligible lines at all', () => {
    expect(allEligibleHaveReview([])).toBe(false)
    expect(allEligibleHaveReview([item({ lineId: 'a', discount: 'pwd' })])).toBe(false)
  })

  it('is true only when every eligible line has the review discount', () => {
    expect(allEligibleHaveReview([
      item({ lineId: 'a', discount: 'review' }),
      item({ lineId: 'b', discount: 'pwd' }),
      addon('a', 20),
    ])).toBe(true)
    expect(allEligibleHaveReview([item({ lineId: 'a', discount: 'review' }), item({ lineId: 'b' })])).toBe(false)
  })
})

describe('toggleReviewForAll', () => {
  const items = [
    item({ lineId: 'a' }),
    item({ lineId: 'b', discount: 'pwd' }),
    addon('a', 20),
    item({ lineId: 'c', discount: 'review' }),
  ]

  it('gives every eligible line the review discount and leaves PWD and add-on lines alone', () => {
    expect(toggleReviewForAll(items).map(i => i.discount)).toEqual(['review', 'pwd', undefined, 'review'])
  })

  it('clears the review discount from all of them once they all have it, keeping PWD lines', () => {
    const allOn = toggleReviewForAll(items)
    expect(toggleReviewForAll(allOn).map(i => i.discount)).toEqual([undefined, 'pwd', undefined, undefined])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- app/pos/discounts.test.ts`
Expected: FAIL — the new `describe` blocks fail with `toggleLineDiscount is not a function` (and the same for the other three); the 12 Task 1 tests still pass.

- [ ] **Step 3: Implement the transitions**

Append to `app/pos/discounts.ts`:
```ts
/** Picking the kind a line already has clears it; any other kind replaces it. Returns a new array. */
export function toggleLineDiscount(items: OrderItem[], lineId: string, kind: LineDiscountKind): OrderItem[] {
  return items.map(i =>
    i.lineId === lineId ? { ...i, discount: i.discount === kind ? undefined : kind } : i
  )
}

// A line can take the review promo when it's an orderable item (not an add-on)
// that isn't already carrying the PWD/Senior discount.
export function isReviewEligible(item: OrderItem): boolean {
  return !isAddonLine(item) && item.discount !== 'pwd'
}

/** True when there is at least one eligible line and every one of them has the review discount. */
export function allEligibleHaveReview(items: OrderItem[]): boolean {
  const eligible = items.filter(isReviewEligible)
  return eligible.length > 0 && eligible.every(i => i.discount === 'review')
}

// Footer "all items" tap: review discount on every eligible line, or — when they
// all already have it — off all of them. PWD lines and add-ons are left alone.
export function toggleReviewForAll(items: OrderItem[]): OrderItem[] {
  const next: LineDiscountKind | undefined = allEligibleHaveReview(items) ? undefined : 'review'
  return items.map(i => (isReviewEligible(i) ? { ...i, discount: next } : i))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- app/pos/discounts.test.ts`
Expected: PASS, 22 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add app/pos/discounts.ts app/pos/discounts.test.ts
git commit -m "feat(pos): per-line discount transitions and review-for-all toggle

toggleLineDiscount switches or clears a single line's discount (picking
PWD on a review line replaces it — the two never stack). isReviewEligible
/ allEligibleHaveReview / toggleReviewForAll back the footer shortcut
that puts the Google Review 10% on every line that can take it, or off
again once they all have it, without touching PWD lines or add-ons.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: DiscountPickerRow component

**Files:**
- Create: `app/pos/DiscountPickerRow.tsx`
- Test: `app/pos/DiscountPickerRow.test.tsx`

**Interfaces:**
- Consumes: `LineDiscountKind` from `types.ts`; `DISCOUNT_LABELS` from `discounts.ts`.
- Produces: default export `DiscountPickerRow({ itemName: string; current: LineDiscountKind | undefined; onPick: (kind: LineDiscountKind) => void })`. Chips render `aria-pressed` reflecting `current`.

- [ ] **Step 1: Write the failing test**

`app/pos/DiscountPickerRow.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import DiscountPickerRow from './DiscountPickerRow'

describe('DiscountPickerRow', () => {
  it('offers both discounts for the named item, none pressed when the line has no discount', () => {
    const html = renderToStaticMarkup(<DiscountPickerRow itemName="Spanish Latte" current={undefined} onPick={() => {}} />)
    expect(html).toContain('PWD/Senior −20%')
    expect(html).toContain('Google Review −10%')
    expect(html).toContain('→ Spanish Latte')
    expect(html).not.toContain('aria-pressed="true"')
  })

  it('marks the discount the line already carries as pressed', () => {
    const html = renderToStaticMarkup(<DiscountPickerRow itemName="Spanish Latte" current="review" onPick={() => {}} />)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Google Review −10%/)
    expect(html).toMatch(/aria-pressed="false"[^>]*>PWD\/Senior −20%/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- app/pos/DiscountPickerRow.test.tsx`
Expected: FAIL — cannot load `./DiscountPickerRow` (module not found).

- [ ] **Step 3: Implement the component**

`app/pos/DiscountPickerRow.tsx`:
```tsx
'use client'

import type { LineDiscountKind } from './types'
import { DISCOUNT_LABELS } from './discounts'

const KINDS: LineDiscountKind[] = ['pwd', 'review']

interface DiscountPickerRowProps {
  itemName: string
  /** The discount the line carries right now, if any. */
  current: LineDiscountKind | undefined
  /** Tapping the chip already active clears the discount; the parent closes the row after any tap. */
  onPick: (kind: LineDiscountKind) => void
}

// Inline "attached to the selected item" picker for the one discount a line can
// carry — same mechanic and look as the Customize row: whichever item's "%" was
// tapped is what a chip applies to, rendered in normal flow inside the panel.
export default function DiscountPickerRow({ itemName, current, onPick }: DiscountPickerRowProps) {
  return (
    <div className="px-6 py-2 border-t border-foreground/10 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-[0.25em] text-foreground/45 font-semibold">Discount</p>
        <p className="text-[10px] text-emerald-600 font-semibold truncate max-w-[55%] text-right">→ {itemName}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {KINDS.map(kind => {
          const active = current === kind
          return (
            <button
              key={kind}
              onClick={() => onPick(kind)}
              aria-pressed={active}
              className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-full border transition-colors ${
                active
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'border-foreground/15 text-foreground/65 hover:border-emerald-400 hover:text-emerald-600'
              }`}
            >
              {DISCOUNT_LABELS[kind]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- app/pos/DiscountPickerRow.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add app/pos/DiscountPickerRow.tsx app/pos/DiscountPickerRow.test.tsx
git commit -m "feat(pos): inline Discount picker row (PWD/Senior or Google Review)

Two-chip row rendered below the item list, same mechanic as the
Customize row: opens for whichever line's % was tapped, one tap picks
(or un-picks) the single discount that line carries. aria-pressed
carries the active state for both assistive tech and the static tests.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: OrderReviewModal consumes DiscountLine[]

**Files:**
- Modify: `app/pos/OrderReviewModal.tsx` (props L6-20, badge L97-99, breakdown L154-165)
- Test: `app/pos/OrderReviewModal.test.tsx`

**Interfaces:**
- Consumes: `DiscountLine`, `OrderItem` from `types.ts`; `DISCOUNT_LABELS` from `discounts.ts`.
- Produces: props `discountLines: DiscountLine[]` **replace** `foodDiscountLines` and `drinkDiscountLines`; everything else unchanged. Task 6 passes the new prop.

- [ ] **Step 1: Write the failing test**

`app/pos/OrderReviewModal.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import OrderReviewModal from './OrderReviewModal'
import type { OrderItem, DiscountLine } from './types'

const items: OrderItem[] = [
  { lineId: 'a', name: 'Spanish Latte', variant: 'ice', price: 150, qty: 2, discount: 'review' },
  { lineId: 'b', name: 'Croissant', variant: null, price: 100, qty: 1, discount: 'pwd' },
]

const discountLines: DiscountLine[] = [
  { lineId: 'a', name: 'Spanish Latte', amount: 30, kind: 'review', label: 'Google Review −10%' },
  { lineId: 'b', name: 'Croissant', amount: 20, kind: 'pwd', label: 'PWD Food −20%' },
]

const base = {
  orderItems: items,
  itemCount: 3,
  total: 400,
  grandTotal: 350,
  discountLines,
  discountAmount: 50,
  payment: 500,
  notes: 'Ana',
  isSubmitting: false,
  submitError: null,
  onCancel: () => {},
  onComplete: () => {},
}

describe('OrderReviewModal', () => {
  it('lists one breakdown row per discounted line under the subtotal', () => {
    const html = renderToStaticMarkup(<OrderReviewModal {...base} />)
    expect(html).toContain('Subtotal')
    expect(html).toContain('Google Review −10% (Spanish Latte)')
    expect(html).toContain('−₱30')
    expect(html).toContain('PWD Food −20% (Croissant)')
    expect(html).toContain('−₱20')
  })

  it('badges each discounted item with its discount', () => {
    const html = renderToStaticMarkup(<OrderReviewModal {...base} />)
    expect(html).toContain('Google Review −10%</span>')
    expect(html).toContain('PWD/Senior −20%</span>')
  })

  it('hides the breakdown when nothing is discounted', () => {
    const plain = items.map(i => ({ ...i, discount: undefined }))
    const html = renderToStaticMarkup(
      <OrderReviewModal {...base} orderItems={plain} discountLines={[]} discountAmount={0} />
    )
    expect(html).not.toContain('Subtotal')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- app/pos/OrderReviewModal.test.tsx`
Expected: FAIL — the first test cannot find `Google Review −10% (Spanish Latte)` (the component still reads `foodDiscountLines`/`drinkDiscountLines`, which are undefined, so it throws on `.map` or renders no rows); the third test passes already.

- [ ] **Step 3: Update the component**

In `app/pos/OrderReviewModal.tsx`:

Imports (L3-4) become:
```tsx
import { variantClass, groupOrderItems } from './utils'
import { DISCOUNT_LABELS } from './discounts'
import type { OrderItem, DiscountLine } from './types'
```
Props interface: replace
```tsx
  foodDiscountLines: LineDiscount[]
  drinkDiscountLines: LineDiscount[]
```
with
```tsx
  discountLines: DiscountLine[]
```
and in the destructured parameters replace `foodDiscountLines, drinkDiscountLines,` with `discountLines,`.

Badge (the `item.pwdDiscounted && (...)` block) becomes:
```tsx
                        {item.discount && (
                          <span className="text-xs text-emerald-600 font-semibold tracking-wide">{DISCOUNT_LABELS[item.discount]}</span>
                        )}
```
Breakdown: replace both `foodDiscountLines.map(...)` and `drinkDiscountLines.map(...)` blocks with one:
```tsx
              {discountLines.map(d => (
                <div key={d.lineId} className="flex justify-between text-xs text-emerald-600 font-semibold gap-2">
                  <span className="uppercase tracking-widest truncate">{d.label} ({d.name})</span>
                  <span className="tabular-nums shrink-0">−₱{d.amount}</span>
                </div>
              ))}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- app/pos/OrderReviewModal.test.tsx`
Expected: PASS, 3 tests. (`npx tsc --noEmit` will now report errors in `POSClient.tsx` where it still passes the old props — expected until Task 6; do not fix them here.)

- [ ] **Step 5: Commit**

```bash
git add app/pos/OrderReviewModal.tsx app/pos/OrderReviewModal.test.tsx
git commit -m "refactor(pos): review screen renders generic DiscountLine rows

Replaces the food/drink PWD-only props with one discountLines list
carrying each row's label and kind, so the Google Review 10% shows up
in the customer-facing review screen exactly like PWD rows do. Item
badges now come from DISCOUNT_LABELS by kind. POSClient is wired to the
new prop in the next commit.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Sale payload builder

**Files:**
- Create: `app/pos/salePayload.ts`
- Test: `app/pos/salePayload.test.ts`

**Interfaces:**
- Consumes: `DiscountLine`, `LineDiscount`, `OrderItem` from `types.ts`; `savedDiscountName` from `discounts.ts`.
- Produces: `buildSalePayload(args: { items: OrderItem[]; discountLines: DiscountLine[]; subtotal: number; grandTotal: number; payment: number | null; notes: string }): SalePayload` where `SalePayload = { total: number; paymentAmount: number; items: OrderItem[]; subtotal: number; discounts?: LineDiscount[]; notes?: string }` — the exact body `POST /api/sales` validates today.

- [ ] **Step 1: Write the failing tests**

`app/pos/salePayload.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import type { OrderItem, DiscountLine } from './types'
import { buildSalePayload } from './salePayload'

const items: OrderItem[] = [
  { lineId: 'a', name: 'Spanish Latte', variant: 'ice', price: 150, qty: 2, discount: 'review' },
  { lineId: 'b', name: 'Croissant', variant: null, price: 100, qty: 1, discount: 'pwd' },
]

const discountLines: DiscountLine[] = [
  { lineId: 'a', name: 'Spanish Latte', amount: 30, kind: 'review', label: 'Google Review −10%' },
  { lineId: 'b', name: 'Croissant', amount: 20, kind: 'pwd', label: 'PWD Food −20%' },
]

const args = { items, discountLines, subtotal: 400, grandTotal: 350, payment: 500, notes: ' Ana ' }

describe('buildSalePayload', () => {
  it('posts the discounted total, the pre-discount subtotal and the items as-is', () => {
    const body = buildSalePayload(args)
    expect(body.total).toBe(350)
    expect(body.subtotal).toBe(400)
    expect(body.paymentAmount).toBe(500)
    expect(body.items).toBe(items)
  })

  it('pre-formats each discount with its persisted (receipt) name, one row per line', () => {
    const body = buildSalePayload(args)
    expect(body.discounts).toEqual([
      { lineId: 'a', name: 'Google Review -10% (Spanish Latte)', amount: 30 },
      { lineId: 'b', name: 'PWD Food -20% (Croissant)', amount: 20 },
    ])
    expect(new Set(body.discounts!.map(d => d.lineId)).size).toBe(body.discounts!.length)
  })

  it('omits discounts entirely when there are none', () => {
    expect('discounts' in buildSalePayload({ ...args, discountLines: [] })).toBe(false)
  })

  it('treats a missing payment as paying the exact total', () => {
    expect(buildSalePayload({ ...args, payment: null }).paymentAmount).toBe(350)
  })

  it('trims the customer name and omits it when blank', () => {
    expect(buildSalePayload(args).notes).toBe('Ana')
    expect('notes' in buildSalePayload({ ...args, notes: '   ' })).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- app/pos/salePayload.test.ts`
Expected: FAIL — cannot load `./salePayload` (module not found).

- [ ] **Step 3: Implement the builder**

`app/pos/salePayload.ts`:
```ts
import type { DiscountLine, LineDiscount, OrderItem } from './types'
import { savedDiscountName } from './discounts'

/** The body `POST /api/sales` accepts — mirrors `SaleInput` in app/api/sales/route.ts. */
export interface SalePayload {
  total: number
  paymentAmount: number
  items: OrderItem[]
  subtotal: number
  discounts?: LineDiscount[]
  notes?: string
}

interface SalePayloadArgs {
  items: OrderItem[]
  discountLines: DiscountLine[]
  /** Pre-discount total. */
  subtotal: number
  /** What the customer owes after discounts. */
  grandTotal: number
  /** null when the cashier never entered a payment — treated as paying the exact total. */
  payment: number | null
  /** The customer-name field; the POS stores it as the sale's notes. */
  notes: string
}

// Discount names are pre-formatted here so the persisted record and any later
// reprint from sales history show the identical label. The API ignores the
// client-only `discount` field on each item.
export function buildSalePayload({ items, discountLines, subtotal, grandTotal, payment, notes }: SalePayloadArgs): SalePayload {
  const discounts: LineDiscount[] = discountLines.map(d => ({ lineId: d.lineId, name: savedDiscountName(d), amount: d.amount }))
  const trimmedNotes = notes.trim()
  return {
    total: grandTotal,
    paymentAmount: payment ?? grandTotal,
    items,
    subtotal,
    ...(discounts.length > 0 ? { discounts } : {}),
    ...(trimmedNotes ? { notes: trimmedNotes } : {}),
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- app/pos/salePayload.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add app/pos/salePayload.ts app/pos/salePayload.test.ts
git commit -m "feat(pos): buildSalePayload assembles the POST /api/sales body

Moves the checkout request assembly out of completeSale so the money
fields that get persisted (total, subtotal, one pre-named discount row
per line, payment fallback, trimmed customer name) are unit-tested.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Wire POSClient (state, handlers, order panel, footer, checkout)

**Files:**
- Modify: `app/pos/POSClient.tsx` (imports L7-14; state L47; memos L114-140; `adjustQty` L188-201; handlers L216-220; `clearOrder` L226-237; `completeSale` L244-262; OrderPanel call sites L600-627 and L659-686; OrderReviewModal call site L713-726; comment L445-446; `OrderPanel` signature L874-925; row L946, L967-971, L1001-1011; rows-below-list L1092-1110; footer L1146-1168)
- Modify: `app/pos/types.ts` (remove `pwdDiscounted`)

**Interfaces:**
- Consumes: everything produced by Tasks 1-5.
- Produces: nothing downstream; this is the integration.

No unit test covers `POSClient.tsx` (it needs the app router). Verification is `npx tsc --noEmit`, `npm run lint`, `npm test`, and `npm run build`. Read every changed block against the design's behaviour list before committing.

- [ ] **Step 1: Imports**

Replace L7-8 with:
```tsx
import { variantClass, groupOrderItems } from './utils'
import type { MenuItem, MenuCategory, OrderItem, Variant, Addon, DiscountLine, LineDiscountKind } from './types'
```
After `import CustomizeDrinkRow from './CustomizeDrinkRow'` add:
```tsx
import DiscountPickerRow from './DiscountPickerRow'
import {
  buildDiscountLines,
  totalDiscount,
  toggleLineDiscount,
  toggleReviewForAll,
  allEligibleHaveReview,
  isReviewEligible,
} from './discounts'
import { buildSalePayload } from './salePayload'
```

- [ ] **Step 2: State**

After the `addonsLineId` state line add:
```tsx
  // Same idea for the Discount row (PWD/Senior −20% or Google Review −10%) — hidden until the "%" button is tapped.
  const [discountLineId, setDiscountLineId]     = useState<string | null>(null)
```

- [ ] **Step 3: Memos**

Replace everything from the `// Every PWD/Senior-discounted line ...` comment through the `grandTotal` memo (L114-140) with:
```tsx
  // One row per discounted line (a line carries at most one kind) — a single transaction
  // can bundle several customers' orders, each with its own PWD/Senior ID or Google review.
  const discountLines    = useMemo(() => buildDiscountLines(orderItems), [orderItems])
  const discountAmount   = useMemo(() => totalDiscount(discountLines), [discountLines])
  const grandTotal       = useMemo(() => total - discountAmount, [total, discountAmount])
  const reviewAllEnabled = useMemo(() => orderItems.some(isReviewEligible), [orderItems])
  const reviewAllActive  = useMemo(() => allEligibleHaveReview(orderItems), [orderItems])
```

- [ ] **Step 4: Line removal closes the Discount row**

In `adjustQty`, after `if (willRemove && addonsLineId === lineId) setAddonsLineId(null)` add:
```tsx
    if (willRemove && discountLineId === lineId) setDiscountLineId(null)
```

- [ ] **Step 5: Handlers**

Replace the `toggleItemPwdDiscount` function and its comment (L216-220) with:
```tsx
  // Tapping a line's "%" opens/closes its Discount row — same mechanic as Customize and Add-ons.
  function toggleDiscountPicker(lineId: string) {
    setSelectedLineId(lineId)
    setDiscountLineId(prev => (prev === lineId ? null : lineId))
  }

  // A line carries at most one discount (PWD/Senior and the review promo never stack):
  // picking the kind it already has clears it. One tap and the row closes.
  function pickItemDiscount(lineId: string, kind: LineDiscountKind) {
    setOrderItems(prev => toggleLineDiscount(prev, lineId, kind))
    setDiscountLineId(null)
  }

  // Footer shortcut: the review promo on every line that can take it, or off again if they all have it.
  function toggleReviewDiscountForAll() {
    setOrderItems(prev => toggleReviewForAll(prev))
  }
```
In `clearOrder`, after `setAddonsLineId(null)` add `setDiscountLineId(null)`.

- [ ] **Step 6: Checkout body**

In `completeSale`, delete the `// Pre-formatted so ...` comment and the `const discountLines: LineDiscount[] = [...]` block, and replace the `body: JSON.stringify({ ... })` argument with:
```tsx
        body: JSON.stringify(buildSalePayload({ items: orderItems, discountLines, subtotal: total, grandTotal, payment, notes })),
```

- [ ] **Step 7: Call sites**

In **both** `<OrderPanel ... />` usages (desktop aside and mobile drawer), replace
```tsx
            foodDiscountLines={foodDiscountLines}
            drinkDiscountLines={drinkDiscountLines}
```
with
```tsx
            discountLines={discountLines}
```
after `addonsLineId={addonsLineId}` add
```tsx
            discountLineId={discountLineId}
            reviewAllEnabled={reviewAllEnabled}
            reviewAllActive={reviewAllActive}
```
and replace `onToggleItemDiscount={toggleItemPwdDiscount}` with
```tsx
            onToggleDiscountPicker={toggleDiscountPicker}
            onPickDiscount={pickItemDiscount}
            onToggleReviewAll={toggleReviewDiscountForAll}
```
In the `<OrderReviewModal ... />` usage replace the two `foodDiscountLines`/`drinkDiscountLines` props with `discountLines={discountLines}`.

Update the comment near L445-446 to read:
```tsx
  // The 'addon__' id prefix is load-bearing: order-line detection elsewhere
  // (utils.ts isAddonLine — used by groupOrderItems and discounts.ts) matches it.
```

- [ ] **Step 8: OrderPanel signature**

In the `OrderPanel` destructuring replace `foodDiscountLines, drinkDiscountLines,` with `discountLines,`; after `addonsLineId,` add `discountLineId, reviewAllEnabled, reviewAllActive,`; replace `onToggleItemDiscount,` with `onToggleDiscountPicker, onPickDiscount, onToggleReviewAll,`.

In the props type replace
```tsx
  foodDiscountLines: LineDiscount[]
  drinkDiscountLines: LineDiscount[]
```
with `discountLines: DiscountLine[]`; after `addonsLineId: string | null` add
```tsx
  discountLineId: string | null
  reviewAllEnabled: boolean
  reviewAllActive: boolean
```
and replace `onToggleItemDiscount: (lineId: string) => void` with
```tsx
  onToggleDiscountPicker: (lineId: string) => void
  onPickDiscount: (lineId: string, kind: LineDiscountKind) => void
  onToggleReviewAll: () => void
```

- [ ] **Step 9: Line row**

`const hasDiscount  = !!item.pwdDiscounted` becomes `const hasDiscount  = item.discount !== undefined`.

The badge block becomes:
```tsx
                        {item.discount && (
                          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5 tracking-wide">
                            {item.discount === 'pwd' ? 'SC/PWD −20% applied' : 'Google Review −10% applied'}
                          </p>
                        )}
```
The `%` button becomes:
```tsx
                        <button
                          onClick={e => { e.stopPropagation(); onToggleDiscountPicker(item.lineId) }}
                          title="Discount (PWD/Senior 20% or Google Review 10%)"
                          className={`w-8 h-8 flex items-center justify-center text-[10px] font-bold rounded-full border transition-colors ${
                            hasDiscount
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-emerald-50 border-emerald-300 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-500'
                          } ${discountLineId === item.lineId ? 'ring-2 ring-emerald-300 ring-offset-1' : ''}`}
                        >
                          %
                        </button>
```

- [ ] **Step 10: Discount row below the list**

Directly after the `<CustomizeDrinkRow ... />` block (before the `{/* Customer name ... */}` block) add:
```tsx
      {/* Discount — hidden until a line's "%" is tapped; PWD/Senior or Google Review, one per line */}
      {discountLineId && items.find(i => i.lineId === discountLineId) && (
        <DiscountPickerRow
          key={discountLineId}
          itemName={items.find(i => i.lineId === discountLineId)!.name}
          current={items.find(i => i.lineId === discountLineId)!.discount}
          onPick={kind => onPickDiscount(discountLineId, kind)}
        />
      )}
```

- [ ] **Step 11: Footer — review-all button and single breakdown map**

Replace the `{/* Discount breakdown ... */}` block (from its comment through its closing `)}`) with:
```tsx
        {/* Google Review promo shortcut — one tap puts the 10% on every line that can take it
            (PWD/Senior lines never stack); tap again to take it off all of them. */}
        <button
          onClick={onToggleReviewAll}
          disabled={!reviewAllEnabled}
          aria-pressed={reviewAllActive}
          className={`w-full py-2 text-[10px] font-bold uppercase tracking-widest rounded-sm border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            reviewAllActive
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-500'
          }`}
        >
          ⭐ Google Review −10% · {reviewAllActive ? 'applied to all items' : 'all items'}
        </button>

        {/* Discount breakdown — one row per discounted line, visible whenever any line is discounted */}
        {discountLines.length > 0 && (
          <div className="space-y-1 px-0.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase tracking-widest text-foreground/50 font-semibold">Subtotal</span>
              <span className="text-xs tabular-nums text-foreground/50">₱{total.toFixed(0)}</span>
            </div>
            {discountLines.map(d => (
              <div key={d.lineId} className="flex justify-between items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-emerald-600 font-semibold truncate">{d.label} ({d.name})</span>
                <span className="text-xs tabular-nums text-emerald-600 font-bold shrink-0">−₱{d.amount}</span>
              </div>
            ))}
          </div>
        )}
```

- [ ] **Step 12: Remove the old field**

In `app/pos/types.ts` delete the line `pwdDiscounted?: boolean`.

- [ ] **Step 13: Verify**

Run: `npx tsc --noEmit`
Expected: no output, exit 0 (no remaining `pwdDiscounted`, `foodDiscountLines`, `drinkDiscountLines`, `toggleItemPwdDiscount` or `LineDiscount` references in `POSClient.tsx` — confirm with `grep -n "pwdDiscounted\|foodDiscountLines\|drinkDiscountLines\|toggleItemPwdDiscount" app/pos/*.tsx app/pos/*.ts`, Expected: no matches).

Run: `npm run lint`
Expected: no errors (warnings only if pre-existing).

Run: `npm test`
Expected: PASS — 4 files, 32 tests.

Run: `npm run build`
Expected: "Compiled successfully" and the route table; if it fails only on a missing Sanity env var, record that and rely on `tsc` + lint.

- [ ] **Step 14: Commit**

```bash
git add app/pos/POSClient.tsx app/pos/types.ts
git commit -m "feat(pos): Google Review 10% discount per line or on all items

The order panel's % button now opens an inline Discount row offering
PWD/Senior −20% or Google Review −10% for that line (one or the other —
the statutory discount and a promo never stack, and 20% beats 10%). A
footer button applies the review promo to every line that can take it
in one tap, or clears it again, leaving PWD lines alone. Breakdown rows,
the review screen and the receipt all show 'Google Review -10% (Item)'
next to the existing PWD rows; the saved sale keeps the same
discounts[] shape, so no schema, API or printer change.

Discount math and transitions live in app/pos/discounts.ts, the checkout
body in app/pos/salePayload.ts, both unit-tested; pwdDiscounted is gone.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
