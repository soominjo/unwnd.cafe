# Serve items one by one on Sales — design

Date: 2026-11-24 · Status: approved by the owner ("Go with B") · Size: a project, built by three agents under one master session

## Why

The owner, on /pos/sales › Recent orders: Bea orders a Spanish Latte, an Americano, nachos and fries. The latte, Americano and nachos are ready first and go out; the fries follow later. Staff need to tick items as each one goes to the customer, see what is still owed, and have the order count as **one** order, completed only when all four items are out.

Today an order is pending or completed as a whole: `sale.isCompleted` is set by the Complete button (`PATCH /api/sales/[id]` `{markCompleted:true}`), and nothing records which items went out.

## Goals

- **G1.** Tick any item of an open order as served. Its time is kept.
- **G2.** Ticked items show under Completed right away, under the same order; Recent keeps only what is still to serve.
- **G3.** The order is completed once every item is out: it then shows only under Completed, as one order with all its items.
- **G4.** A wrong tick can be undone (a 5-second Undo, or untick it later).
- **G5.** Two devices ticking the same order at once never lose a tick.

## Non-goals

- Kitchen screens, ready/preparing states, printing a ticket per tick.
- Ticking part of a line (one cup of an Americano ×2).
- Changing revenue, the Tally, Top items, receipts, printing or loyalty.

## Anti-goals

- An order counted or shown as two orders anywhere except the two tabs (KPI "Orders" stays one per sale).
- Deleting an order by accident from the half that is "done".
- An old completed order reopening by itself.

## Approaches

Mockups: https://claude.ai/artifact/DJ5Zu8WyVgwLfnsCo2CVAE (row B is the chosen one).

| | Approach | Trade-off |
|---|---|---|
| A | Tick in place; the order moves to Completed only when the last item is ticked | One card per order; served items stay on the Recent card greyed out |
| **B (chosen)** | A ticked item moves to Completed at once, under the same order | Matches how the owner thinks of it; a partly served order shows in both tabs and both counts |
| C | Pick items, then one Hand over button; served items grouped by time | Safest against mis-taps; an extra tap every time |

## What staff see (option B)

- **Recent orders**: an order shows only its items still to serve, each with a round check button (44 px tap target). Add-ons have no button: they go out with their item. Header badge: `Pending` when nothing is out, else `3 of 4 served` (amber), with a 4 px progress bar under the header. When some items are out, a green strip above the lines reads `✓ 3 items already out, in Completed ›`; tapping it opens the Completed tab. Footer as today: Complete (ticks everything left), Add items, Print, Delete.
- **Completed**: an order shows its items that went out, with a filled check and `Served 7:46 PM` (no time on orders completed before this feature). Tapping a filled check unticks it, and the item goes back to Recent. If some items are still to serve, an amber dashed strip under the lines reads `1 still to serve: Classic Fries · In Recent ›`, and the badge reads `3 of 4 served`; otherwise `✓ Done`. Footer: Print, Delete.
- **Undo**: after every tick, untick or Complete, a dark bar under the tabs shows for 5 s: `Classic Fries moved to Completed`, `Classic Fries moved back to Recent`, or `Bea’s order is complete`, with **Undo**, which reverses it.
- **Counts**: the Recent badge counts orders not completed; the Completed badge counts orders completed or with any item out. A partly served order is in both. The list label on Completed reads `1 completed · 1 partly served`. On long periods (week/month/year) the line reads `N pending · N completed`, where completed means fully completed.
- **Delete** on a partly served order says it deletes the whole order (`Delete the whole order (4 items)?`). **Delete all** on Completed deletes only fully completed orders, and its confirmation counts only those.
- Ticking updates the card at once, with no grey loading flash (today every Sales action reloads the list behind a skeleton).

## Data

- `saleItem.servedAt` (datetime, optional, read-only in Studio): when the line went out. Only top-level lines carry it; an add-on (lineId starting `addon__`) follows its item.
- `sale.isCompleted` keeps its meaning and its queries: true once every top-level line has a `servedAt`. The server keeps that rule on every write.
- Orders completed before this feature have `isCompleted: true` and no times: every line counts as served.
- The shared rules live in **`lib/sales/served.ts`** (done, 17 tests): `topLevelLines`, `splitServed` (served / toServe, plus `servedLines` / `toServeLines` with add-ons), `allLinesServed`, `missingLineIds`, `serveLines`, `unserveLines`, `afterServing`, `afterUnserving`. Use them on both sides; don't re-implement them.
- Types (done): `SaleItem.servedAt?: string`; `SalesSummary.partlyServedCount?: number` (absent = 0).

## API contract

```
PATCH /api/sales/{id}
{ "serveLineIds":   ["classic-fries"] }  → 200 { "success": true, "isCompleted": true,  "servedAt": "2026-11-24T11:53:00.000Z" }
{ "unserveLineIds": ["classic-fries"] }  → 200 { "success": true, "isCompleted": false, "servedAt": null }
400 bad body · 401 not signed in · 404 order gone · 409 changed on another device · 422 unreadable order · 500
```

- Exactly one of the two keys; 1–102 ids, each passing `isValidId` and at most 100 characters.
- An id that is not a top-level line of the order (`missingLineIds`) → 409 `This order changed on another device. Refresh, then try again.`
- serve → `afterServing(doc, ids, now)`; unserve → `afterUnserving(doc, ids, doc._updatedAt ?? now)`. Write `{ items, isCompleted }` behind `ifRevisionId(doc._rev)`, re-read and retry on a 409, up to 3 attempts, then 409. Nothing changed → no write, answer with the current state.
- `{markCompleted:true}` now also stamps every unserved line (`afterServing` with all top-level ids), behind the revision check with retries. Its reply stays `{ success: true }`.
- `{removeLineId}` (✕): when the order was not completed and every remaining line is served, it becomes completed. Removing never un-completes an order.
- `GET /api/sales?status=completed` → `isCompleted == true || count(items[defined(servedAt)]) > 0`. `status=pending` stays `isCompleted != true`.
- Summary: `pendingCount` = not completed; `completedCount` = completed or any item out; `partlyServedCount` = not completed and any item out.

## Work split

The master session (`unwnd-cafe-3b`) owns this spec, `lib/sales/served.ts` + its test, and `app/pos/types.ts`. It reviews, integrates and commits. Each agent edits **only** its own files.

### Agent 1 · Database: Sanity schema and the read queries

Files: `sanity/schemaTypes/saleItem.ts`, `app/api/sales/route.ts` (the GET handler; POST only through a test), `app/api/sales/route.test.ts`, `app/api/sales/summary/route.ts`, `app/api/sales/summary/route.test.ts`.

1. Schema: add `servedAt` to saleItem: `type: 'datetime'`, `readOnly: true`, title `Went out to the customer`, description `When this item was ticked as served on Sales. Empty while it is still to serve, and on add-ons: they go out with their item.`
2. `GET /api/sales`: the `completed` filter above, in both the page query and the count query. Tests for both filters.
3. Summary: project what the counts need (for example `"servedCount": count(items[defined(servedAt)])`), compute the three counts above, return `partlyServedCount`. Tests, including a partly served order counted in both and an old completed order with no times.
4. Check that `POST /api/sales` drops a client-sent `servedAt` on items (`toSaleItemDoc` builds explicit fields). Add a test. If code must change outside your files, ask the master.

### Agent 2 · Backend: the writes

Files: `app/api/sales/[id]/route.ts`, `app/api/sales/[id]/route.test.ts`, `app/api/sales/[id]/items/route.ts`, `app/api/sales/[id]/items/route.test.ts`, `lib/testing/fakeSanityClient.ts` (only if needed).

1. The serve and unserve bodies, exactly as in the API contract, with tests: serve some, serve the last (completes), already served (no write), unserve (reopens), unserve on an old completed order (other lines keep a time), unknown or add-on id (409), bad bodies (400), a revision clash that succeeds on retry, gone order (404).
2. `markCompleted` stamps the times, behind the revision check. Tests.
3. ✕ completes an order whose remaining lines are all served, and never un-completes one. Tests.
4. Add items keeps the existing lines' `servedAt` (it spreads stored items, so no change is expected). Add a regression test; a completed order still refuses.

### Agent 3 · Frontend: the Sales screen

Files: everything under `app/pos/sales/` (`OrderCard.tsx`, `OrdersView.tsx`, `SalesClient.tsx`, `ViewTabs.tsx`, `ui.tsx`, `icons.tsx`, their tests, and new files such as `sendServe.ts`, `sendServe.test.ts`, `UndoToast.tsx`).

1. OrderCard in both modes, as in "What staff see", using `splitServed`. Rounds (the "Added 7:52 PM" groups) still group whatever lines the card shows.
2. SalesClient: serve, unserve and Complete through a new `sendServe` (modelled on `sendRename`). Update the order on screen at once with `afterServing` / `afterUnserving`, then refresh quietly (no skeleton). On failure, restore the order and show the error banner. One request at a time per order, so fast taps don't race.
3. The Undo bar, the strips that switch tabs, the Delete wording, Delete all on Completed, the list label, and the long-period count in ViewTabs.
4. Tests: OrderCard static markup for a partly served order in both modes, an old completed order, and an add-on following its item; `sendServe.test.ts`; ViewTabs for the long-period count.
5. Keep the existing look and components (ActionButton, Badge, QtyBadge); match the mockup's row B. No overflow at 360 px.

## Team rules

- **No git writes**: no commit, add, stash, checkout, restore, reset, pull or push. Read-only git (status, diff, log) is fine.
- **Only your files.** A change needed elsewhere (`types.ts`, `served.ts`, another agent's file): message the master and wait.
- Another session (`refresh`) is editing `app/pos/POSClient.tsx`, `app/pos/navigation.ts`, `app/pos/orderDraft.ts` and `app/pos/KeptOrderNotice.tsx`. Don't touch, format or stage them.
- The owner's `next dev` runs on port 3000, and the `refresh` session's scratch app uses port 3123. Don't start another dev server in this folder, don't log in to either, don't install packages.
- Run vitest from `C:\unwnd.cafe\unwnd` with a **capital C**. From a lower-case `c:\` working directory every test file fails with "Cannot read properties of undefined (reading 'config')" or "no tests".
- TDD: a failing test first, then the code. Run your own tests (`npx vitest run <your files>`). Other agents' files may be half-done: tsc errors outside your files aren't yours, so list them in your report.
- Report to `unwnd-cafe-3b` with SendMessage when you start, when blocked, and when done. The done report lists files changed, tests run with their pass count, and anything left open.

## Calls made by the master (from the options message; the owner didn't object)

1. One tick covers the whole line (Americano ×2 is both cups).
2. Add-ons go out with their item.
3. Complete stays and ticks everything left.
4. A ticked item can be unticked; unticking in Completed sends it back to Recent.
5. Each tick keeps its time.
6. Items added later with Add items start unticked.
7. Old completed orders show as fully served.
8. Revenue, Tally, receipts and printing don't change.
9. Two devices ticking at once never lose a tick (revision checks with retries, one request at a time per order).
10. No loading flash after a tick.
