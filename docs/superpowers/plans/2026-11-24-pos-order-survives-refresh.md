# The POS keeps the order through a refresh: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An order rung up on /pos survives a refresh, a browser restart and a trip to another page on the same tablet. It goes only on Complete, Clear or when its last item is removed.

**Architecture:** A new module, `app/pos/orderDraft.ts`, keeps the order in `localStorage` under two keys (a new order, and lines being added to one saved order). It validates whatever it reads back, and decides what a page load brings back. `POSClient` reads the kept order after the first paint, then rewrites it after every change. A small notice covers a reload that cut a save short.

**Tech Stack:** Next 16 (App Router), React 19.2, TypeScript, Vitest 4 (node environment), Playwright 1.63 from the npx cache for the real-refresh check.

**Spec:** `docs/superpowers/specs/2026-11-24-pos-order-survives-refresh-design.md`

## Global Constraints

- Storage keys are exactly `unwnd.pos.order` (new order) and `unwnd.pos.addingTo` (lines being added). Stored value: `JSON.stringify({ v: 1, ...order })`.
- Exact copy:
  - `'The page reloaded while this order was being saved, so it may be saved already. Check Sales before charging again.'`
  - `'The new items were saved just before the page reloaded. Print their receipt from Sales.'`
- Nothing in `orderDraft.ts` throws. Refused or missing storage means keeping returns `false` and reading returns `null`, as in `savedMenu.ts`.
- No new dependencies. Committed tests run in Vitest's node environment (no jsdom).
- State is set in effects only from a microtask (`void Promise.resolve().then(…)`), as the saved-menu effect does. eslint-plugin-react-hooks 7 flags `set-state-in-effect`.
- In running JSX text, write `{' '}` after a closing tag (SWC drops the space).
- Commit only when the owner asks: one commit on `main`, `feat(pos): …`, with a body that starts "Owner feedback." and the Co-Authored-By trailer.

## Review Focus

1. **The server renders an empty cart.** If the keep effect runs before the kept order is read, a reload wipes it. Task 4's check reloads twice in a row.
2. **A reload while Complete + Print is saving.** The order comes back with the "may be saved already" notice, and that notice survives another reload until OK. Task 4, scenario C.
3. **A reload while the receipt of a completed sale is up.** The cart must come back empty. Task 4, scenario B.
4. **A reload while added items are saving, after the server already has them.** Expect the "saved just before the page reloaded" notice and no duplicate lines. Task 2 (unit) and Task 4, scenario D.
5. **A damaged or foreign value under the key.** The POS opens with an empty cart and keeps working. Task 1 (validation table) and Task 4, scenario A's junk seed.

---

### Task 1: Keep, read and forget an order on the tablet

**Files:**
- Create: `app/pos/orderDraft.ts`
- Test: `app/pos/orderDraft.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const KEPT_ORDER_KEY = 'unwnd.pos.order'
  export const KEPT_ADDING_KEY = 'unwnd.pos.addingTo'
  export type KeptKind = 'new' | 'adding'
  export interface KeptOrder {
    items: OrderItem[]
    name: string                                // the customer name field
    cardHolderId: string | null                 // a new order's linked card; null while adding
    rewards: LoyaltyChoice
    orderType: OrderType
    lineSuffix: string
    sending: boolean                            // a save was under way, or a reload cut one short and OK isn't tapped yet
    addingTo: { id: string; name: string } | null  // set on lines being added: the order, and its name when kept
  }
  export const EMPTY_KEPT_ORDER: KeptOrder      // no items, '' name, no card, NO_LOYALTY, 'dine-in', '' suffix, not sending, not adding
  export function keepOrder(order: KeptOrder, storage?: Pick<Storage, 'setItem' | 'removeItem'>): boolean
  export function readKeptOrder(kind: KeptKind, storage?: Pick<Storage, 'getItem'>): KeptOrder | null
  export function forgetKeptOrder(kind: KeptKind, storage?: Pick<Storage, 'removeItem'>): void
  export function parseKeptOrder(value: unknown): KeptOrder | null
  ```
  - `keepOrder` writes under `KEPT_ADDING_KEY` when `addingTo` is set, else `KEPT_ORDER_KEY`.
  - With no items, it removes that key instead.
  - It returns whether storage took the write or the removal.

- [ ] **Step 1: Write the failing tests** in `orderDraft.test.ts`, with an in-memory `Map`-backed storage stub and a throwing stub.
  ```ts
  it('keeps a new order and reads it back as it was')          // round trip equals the input, incl. discounts {pwd:'solo'}, note, parentLineId, categoryId
  it('keeps lines being added under their own key')             // keepOrder({..., addingTo:{id:'s1',name:'Ana'}}) → readKeptOrder('adding') is it, readKeptOrder('new') is null
  it('removes the kept order once the cart is empty')            // keep 1 item, then keep items [] → readKeptOrder('new') null, returns true
  it('says false when the tablet refuses storage, and reads nothing') // throwing stub: keepOrder → false, readKeptOrder → null, forgetKeptOrder doesn't throw
  it('forgets one kind without touching the other')
  it.each([
    ['not JSON', '{'], ['another version', {v:2}], ['no items', {items:[]}],
    ['a negative price', {price:-1}], ['a zero quantity', {qty:0}], ['a part quantity', {qty:1.5}],
    ['an unknown variant', {variant:'warm'}], ['no line id', {lineId:''}], ['an unknown discount', {discounts:{pwd:'half'}}],
    ['an unknown order type', {orderType:'delivery'}], ['rewards missing', {rewards:undefined}], ['adding to no order', {addingTo:{id:'',name:''}}],
  ])('reads nothing from a kept order with %s', ...)          // each case patched into a valid stored value
  it('drops fields it does not know')                            // stored item with extra: 'x' → parsed item has no 'extra'
  ```
- [ ] **Step 2: Run** `npx vitest run app/pos/orderDraft.test.ts`. Expected: FAIL, because `./orderDraft` doesn't exist yet.
- [ ] **Step 3: Implement** `orderDraft.ts`.
  - `parseKeptOrder` builds a fresh object field by field: no spreads of parsed input. Use `isOrderType` from `@/lib/sales/payments`.
  - Allow at most 200 items.
  - Discounts: keys ⊂ `pwd|review`, values ∈ `all|solo`.
  - `readKeptOrder` is `parseKeptOrder(JSON.parse(text))` inside try/catch.
- [ ] **Step 4: Run** the same command. Expected: PASS.

### Task 2: Decide what a page load brings back

**Files:**
- Modify: `app/pos/orderDraft.ts`
- Test: `app/pos/orderDraft.test.ts`

**Interfaces:**
- Consumes: `KeptOrder` (Task 1); `OpenOrder` and `nameAfterRefresh` from `./addToOrder`.
- Produces:
  ```ts
  export type FoundOrder = { kind: 'none' } | { kind: 'order'; order: KeptOrder } | { kind: 'already-added' }
  export function findKeptOrder(openOrder: OpenOrder | null, kept: KeptOrder | null): FoundOrder
  ```

- [ ] **Step 1: Write the failing tests:**
  ```ts
  it('brings a new order back as kept, sending mark included')   // (null, keptNew{sending:true}) → {kind:'order', order: keptNew}
  it('brings no adding lines back on a new order, and no new order while adding') // (null, keptAdding) and (openOrder, keptNew) → none
  it('brings lines back only for the order they were kept for')  // openOrder.id 's1' vs addingTo.id 's2' → none
  it('brings lines back without the sending mark: the order itself says whether they were saved') // → order.sending false
  it('reports lines the order already holds as added, not as new lines') // openOrder.items has lineId 'latte__ice__a1b2c' → {kind:'already-added'}
  it('takes a name changed on another device, else keeps the one typed') // addingTo.name 'Ana', typed 'Ana B', fresh 'Ana' → 'Ana B'; fresh 'Bea' → 'Bea'
  ```
- [ ] **Step 2: Run** `npx vitest run app/pos/orderDraft.test.ts`. Expected: the new tests FAIL (`findKeptOrder` is not exported).
- [ ] **Step 3: Implement `findKeptOrder`.**
  - The kind of page (new order or adding) must match the kept order's kind. While adding, the ids must match too.
  - If any kept line id is among `openOrder.items` line ids, return `already-added`.
  - Otherwise return the order with `sending: false` and `name: nameAfterRefresh(kept.addingTo.name, kept.name, openOrder.name)`.
- [ ] **Step 4: Run** the same command. Expected: PASS.

### Task 3: The notice after a reload cut a save short

**Files:**
- Create: `app/pos/KeptOrderNotice.tsx`
- Test: `app/pos/KeptOrderNotice.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type KeptNotice = 'maybe-saved' | 'already-added'
  export function KeptOrderNotice(props: { notice: KeptNotice; onDismiss: () => void }): JSX.Element
  ```
  It is styled like `OpenOrderNotice` (amber bar, `role="status"`, one "OK" button, `type="button"`).

- [ ] **Step 1: Write the failing tests** with `renderToStaticMarkup`, and by calling the hook-free component as a function to reach the button's `onClick`:
  ```ts
  it('says a reloaded save may have gone through, and to check Sales first') // markup contains the exact maybe-saved copy
  it('says added items were saved, and where to print their receipt')        // exact already-added copy
  it('goes away on OK')                                                      // onClick → onDismiss called once
  ```
- [ ] **Step 2: Run** `npx vitest run app/pos/KeptOrderNotice.test.tsx`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** with the copy from Global Constraints.
- [ ] **Step 4: Run** the same command. Expected: PASS.

### Task 4: POSClient keeps and restores the order

**Files:**
- Modify: `app/pos/POSClient.tsx`: new state and refs near the other `useState`s; effects after the saved-menu effects; `clearOrder`, `makeNewOrder`, `closeReceipt`, the header's Time clock and Manager buttons, the Reload button, `AddingBanner`'s `onCancel`, and the notice under the adding banner.
- Modify: `app/pos/navigation.ts`, doc comment only. Its second parameter is now "items leaving would lose" (0 when the order is kept).
- Verify with: `<scratch>/keep-check/keep-check.cjs` (Playwright, not committed).

**Interfaces:**
- Consumes: everything Task 1 and Task 2 produce; `KeptOrderNotice` and `KeptNotice` (Task 3).

**Wiring (the decisions; the code follows from them):**
- State `keptNotice: KeptNotice | null`. Refs:
  - `keptLooked`: the kept order was looked for, so changes may be kept from now on.
  - `orderKept`: the last keep succeeded.
- `bringBack(order: KeptOrder)` sets the cart to the kept order: items, notes, loyaltyPicked, orderType, lineSuffix, and `keptNotice` (`'maybe-saved'` when `order.sending`, else `null`). It sets the card only when `addingTo` is null. It is a `useCallback` with no deps, since it uses setters only.
- **Restore effect** (deps `[initialOpenOrder, bringBack]`):
  - In a microtask, guarded by a `current` flag and `keptLooked`, call `findKeptOrder(initialOpenOrder, readKeptOrder(initialOpenOrder ? 'adding' : 'new'))`.
  - `order`: call `bringBack`.
  - `already-added`: call `forgetKeptOrder('adding')` and `setKeptNotice('already-added')`.
  - Set `keptLooked.current = true` last, in the same microtask.
- **Keep effect** (deps: every field below): if `keptLooked.current`, set `orderKept.current = keepOrder({...})` with these fields:
  - `items`: `[]` when `openOrder && newOrderAfterReceipt`, because those lines are saved; otherwise `orderItems`.
  - `name`: `notes`.
  - `cardHolderId`: `openOrder ? null : linkedHolderId`.
  - `rewards`: `loyaltyPicked`.
  - `orderType`, `lineSuffix`.
  - `sending`: `saving || keptNotice === 'maybe-saved'`.
  - `addingTo`: `openOrder ? { id: openOrder.id, name: openOrder.name } : null`.
- `clearOrder` also sets `keptNotice` to null. `makeNewOrder` calls `forgetKeptOrder('adding')`. `AddingBanner`'s `onCancel` calls `forgetKeptOrder('adding')` before `leaveFor('/pos/sales')`.
- `closeReceipt`, after Add items: replace the hand reset of items, orderType, notes and card with `unlinkCardHolder()` then `bringBack(readKeptOrder('new') ?? EMPTY_KEPT_ORDER)`. Keep the rest: pay, error, selection, modal, replaceState, refetch.
- Time clock and Manager: `openPosPage(path, orderKept.current ? 0 : itemCount)`. Reload: skip the confirm when `orderKept.current`.
- Render `{keptNotice && <KeptOrderNotice notice={keptNotice} onDismiss={() => setKeptNotice(null)} />}` right after the `OpenOrderNotice` line.

- [ ] **Step 1: Write the real-refresh check** (`keep-check.cjs`) against a scratch copy of the app. The setup follows the "Preferred since 2026-10-23" Playwright notes:
  - robocopy the repo, junction `node_modules`, then run `next dev --webpack -p 3123` with a test `POS_PIN`, dummy tokens and the two public Sanity values.
  - Set the `pos_auth` cookie.
  - With `context.route('**/api/**')`:
    - Answer GET `/api/timeclock`, `/api/loyalty/members` and `/api/sales*` with fixtures.
    - Answer POST `/api/sales` with `{success:true}`, or hold it unanswered in scenario C.
    - Answer POST `/api/sales/fixture-order/items` with the fixture sale plus the posted lines, or hold it in scenario D.
  - In the scratch copy only, make `lib/sales/loadOpenSale.ts` return `{ order: openOrderFromSale(JSON.parse(readFileSync(process.env.KEEP_FIXTURE))) }` for the id `fixture-order`.

  Scenarios, each starting from a cleared `localStorage`, at 393×852 (isMobile, hasTouch) and again at 1280×800:
  - **A.**
    1. Seed `unwnd.pos.order` with junk, reload: the menu shows and the cart is empty.
    2. Add a hot drink twice and an iced drink, an add-on with a note, and a customer name.
    3. Reload twice: the same lines, quantities, note and name are back.
    4. Clear, then reload: the cart is empty.
  - **B.** Add an item, then Charge, Cash, Complete + Print (POST answered). The receipt shows. Reload: the cart is empty.
  - **C.** As B, but the POST is held.
    1. Reload: the item is back, with the maybe-saved notice.
    2. Reload again: the notice is still there.
    3. OK, then reload: no notice, and the item is still there.
  - **D.** Open `/pos?edit=fixture-order` and add a line.
    1. Reload: the line is back under "Adding now".
    2. Review, then Save + Print with the POST held. Write the fixture with that line saved.
    3. Reload: the already-added notice shows, and the cart is empty.
  - **E.** Ring up order A, then open `/pos?edit=fixture-order` and add a line. Save + Print (answered), then close the receipt: A's lines are back.
  - **F.** With items in the cart, tap Time clock: no dialog opens and the page changes. Go back to /pos: the items are back.
  - **G.** Open `/pos?edit=fixture-order`, add a line, then tap Cancel and Drop them. Open it again: the cart is empty. Back on /pos, remove a new order's last line with −, then reload: the cart is empty.

  Each scenario writes a screenshot; look at every one, the notice at 393 px especially.
- [ ] **Step 2: Run it against the code before wiring.** Expected: A fails at "reload: the same lines are back".
- [ ] **Step 3: Wire POSClient** as above.
- [ ] **Step 4: Run** `npx vitest run`, `npx tsc --noEmit` and `npx eslint app/pos`. Expected: all pass, with no new lint errors.
- [ ] **Step 5: Run the check again.** Expected: every scenario passes, and the screenshots show the notice on one line group with nothing clipped.

### Task 5: Review and hand-over

- [ ] **Step 1:** Dispatch a fresh code reviewer on the diff, with this plan and the spec. Fix what it finds that is real.
- [ ] **Step 2:** Full checks again: `npx vitest run`, `npx tsc --noEmit`, `npx eslint app/pos`, and `npx next build --webpack` with the public Sanity env (memory: Turbopack builds fail in a junctioned snapshot; the build here is in the real repo, so plain `npx next build` is fine if the owner's dev server isn't holding `.next`, else skip and say so).
- [ ] **Step 3:** Report to the owner. When they say commit:
  ```bash
  git add app/pos/orderDraft.ts app/pos/orderDraft.test.ts app/pos/KeptOrderNotice.tsx app/pos/KeptOrderNotice.test.tsx app/pos/POSClient.tsx app/pos/navigation.ts docs/superpowers/specs/2026-11-24-pos-order-survives-refresh-design.md docs/superpowers/plans/2026-11-24-pos-order-survives-refresh.md
  git commit   # feat(pos): an order on the POS survives a refresh
  git push origin main
  ```
