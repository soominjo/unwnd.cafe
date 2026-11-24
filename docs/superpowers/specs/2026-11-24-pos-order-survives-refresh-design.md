# The POS keeps the order through a refresh — design

Date: 2026-11-24 · Status: approved by the owner ("go") · Size: a small change

## Why

The owner, on /pos: a customer orders a Spanish latte and more, the cashier rings it up, and an accidental refresh wipes the order. The cashier then has to ask the customer for their order again. Today the order exists only in the open page (React state in `POSClient`). A refresh clears it, and so does a trip to Sales, Time clock or Manager. Time clock, Manager and the menu's Reload button already warn "The order in progress will be cleared."

## Goals

- **G1.** A new order on /pos comes back after a refresh, after a browser restart, and after a trip to another page (Sales, Time clock, Manager) on the same tablet.
- **G2.** It goes away only when it is completed (Complete + Print saves it), cleared (Clear), or its last item is removed.
- **G3.** Items being added to a saved order ("Add items" on Sales) come back the same way, but only for that same order.
- **G4.** A refresh in the middle of a save never lets the cashier charge an order twice without warning.

## Non-goals

- Sharing an unfinished order with other phones or tablets.
- Keeping the payment method picked on the review screen. It is picked again, as now.
- Keeping screens open: the review screen, an item's modal, the phone's order drawer.
- Two POS tabs open on one tablet. They share one kept order (see Known limits).
- An idempotency key on `POST /api/sales` (the deferred L2). The warning in G4 covers the refresh case.

## Anti-goals

- An order coming back after it was completed or cleared.
- Lines already saved onto an order coming back as new lines, ready to be saved twice.
- The POS failing to open because of an old or damaged kept order.

## Approaches

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | Keep the order in the tablet's browser storage (`localStorage`), as `savedMenu.ts` already does for the menu | Survives refreshes, restarts and page changes. Only that tablet sees it. |
| B | Tab-only storage (`sessionStorage`) | Lost when the tab or the browser is closed. |
| C | Unfinished orders saved to Sanity | Other devices could see them, but every tap becomes a write, unfinished orders with names land in the public dataset, and it needs the network. Too much for a refresh. |

## Design

- **Two kept orders per tablet** in `localStorage`, in a new module `app/pos/orderDraft.ts`:
  - `unwnd.pos.order`: the new order on screen.
  - `unwnd.pos.addingTo`: the lines being added to one saved order, with that order's id and its name at the time.
  - Each holds the items (with add-ons, notes and discounts), the customer's name, the linked card holder's id, the picked loyalty rewards, dine in / take out, the line suffix, and a `sending` mark.
  - A read checks every field. Anything off, an unknown version included, reads as no kept order. Storage that is refused (a private window) or missing (the server render) never breaks the POS, the same as `savedMenu.ts`.
- **Restore after the first paint** (the server renders an empty cart):
  - Plain /pos, or an `?edit=` order that could not be opened: the new order comes back.
  - `/pos?edit=X` that opened: X's kept lines come back, if the kept lines are for X. The name follows `nameAfterRefresh`, so a name changed on another device wins. The card stays the order's own.
  - If any kept line id is already in X as just loaded, the save went through before the refresh. Those lines are dropped, with a notice: "The new items were saved just before the page reloaded. Print their receipt from Sales."
- **Keep on every change.** The kept order matching the page is rewritten after every change. An empty cart removes it, which covers Complete, Clear and the last item removed. While adding, the kept lines go once the save succeeds.
- **A refresh mid-save of a new order (G4).** While Complete + Print is saving, the kept order is marked `sending`. If the page comes back with that mark, the order returns with a notice: "The page reloaded while this order was being saved, so it may be saved already. Check Sales before charging again." The mark stays until OK is tapped, so a second refresh still warns.
- **After Add items:** when the receipt closes, a new order kept on the tablet comes back, instead of an empty cart. For example, a customer rung up before the cashier went to add a cookie to another customer's order.
- **Leaving no longer warns.** Time clock, Manager and Reload stop asking "The order in progress will be cleared" once the order is kept. They still ask when the tablet refuses storage.
- **Dropping lines:** "Drop them" on the adding banner, and "Make it a new order" after a refused add, remove that order's kept lines.

## Revisions after the code review of 4c81202

- **Leaving Add items asks first.** `leaveWarning` in `navigation.ts` decides it. While items are being added to a saved order, Time clock and Manager ask first: "Leave the POS? The new items stay kept for this order: to finish them, open Add items on it in Sales." The reason: "← POS" opens a new order, so only Add items brings those items back. A kept new order still leaves without asking.
- **Cancel or "Make it a new order" forgets only that order's kept lines** (`forgetKeptLines`). Lines kept for another order stay.
- **"May be saved already" goes with its order.** Once the order's last line is removed, the notice goes (`noticeOnScreen`), so the next customer's order doesn't inherit the warning.
- **Added lines saved with other amounts say so.** Example: a save went through, its reply was lost, the cashier added one more, then the page reloaded. The reload runs the lost-reply check (`savedState`) on the kept lines. Exactly as kept gives "saved just before the page reloaded". Other amounts gives "An earlier save of the new items went through just before the page reloaded, with other amounts. The order shows what was saved: add anything still missing." In both cases the cart comes back empty.
- **What gets kept is one tested function** (`keptOrderOf`).
- **Back shows the order as kept now.** When the browser brings /pos back from its back-forward cache and the tablet keeps orders, the page loads again, with menu editing locked first, as before. Another page may have completed or changed the order meanwhile. Where storage is refused, the old behavior stays: the modals close and the order on screen stays.

## Known limits

- One tablet only. Two POS tabs on the same tablet share the kept new order.
- Lines are kept for one saved order at a time. Adding a line to another saved order replaces them.
- "Make it a new order" (after an add is refused) replaces a new order kept on the tablet. This needs a waiting order plus an order completed elsewhere mid-add, which is rare.
- An order left overnight stays until it is cleared.
- A kept line keeps the price it was rung up at, as the cart does today.

## Left to the builder

- Where the notice sits and its exact styling. It follows `OpenOrderNotice`.
- The test split: unit tests for `orderDraft.ts`, static-markup tests for the notice, and a real-refresh check with Playwright on a scratch copy of the app.
