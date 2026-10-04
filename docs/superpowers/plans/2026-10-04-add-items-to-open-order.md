# Add items to an open order — implementation plan

> **For agentic workers:** built inline with superpowers:executing-plans, test-first (superpowers:test-driven-development). Steps use `- [ ]` checkboxes.

**Goal:** a customer's follow-up order goes onto their pending sale, so Sales keeps one record per
transaction instead of two.

**Architecture:** append-only. "Add items" on a pending order opens `/pos?edit=<id>`; the saved
lines show locked, new lines are a normal cart, and saving posts only the new lines to
`POST /api/sales/[id]/items`, which appends them (stamped `addedAt`) and works the money out
on the server. The POS sends the order revision it opened, so a stale, repeated or
other-device save is refused instead of applied twice. New orders, Sales totals, Top Items,
Top Names, stamps and receipts keep their code paths.

**Tech stack:** Next 16 App Router, React 19, Sanity (`ifRevisionId`), Vitest 4 (node env;
jsdom click-throughs run from the scratchpad).

**Prototype (agreed with the owner, 2026-10-04):** https://claude.ai/artifact/TcXu5bazUYK4DkLNgBRxif

## Owner decisions

| Question | Decision |
|---|---|
| Saved items on the POS | Locked, shown greyed above the new lines. ✕ on Sales removes one, as today |
| Which orders | Pending only. A save is refused if the order was completed or deleted meanwhile |
| Duplicates | None: the same sale is updated, so Orders does not change |
| Staff ticket after adding | Only the latest added items, with a switch for the whole order |
| Total due while adding | The whole order, with "added now" beside it |
| Name and card | Added, changed or cleared while adding, on the review screen, or on the Sales card (second round); an order on a loyalty card keeps the holder's name. No card linking while adding |
| Printing (second round) | One Print button per Sales card opens a sheet: Staff ticket, Receipt or Both. Both is one job with a tear line between: the printer has no cutter, so the cashier tears by hand |
| Checkout (third round) | Both prints the receipt on top and the staff ticket below. The review screen has one button, Complete + Print (Save + Print when adding); its preview prints the receipt or both, and ✕ there skips printing. The POS stays where it is for the next customer |
| Button | "Add items" |
| ✕ on Sales (bug found on the way) | Drops only that line's discount rows and loyalty reward; total = subtotal − the rows left |

## Global constraints

- Copy style of the POS: plain sentences, `·` separators, no PIN anywhere in this flow.
- `POST /api/sales` behaviour is unchanged; shared checks move to `lib/sales/validateSaleInput.ts`.
- New props and options default to today's behaviour; every existing test keeps passing unedited
  except where its file is extended.
- Line ids stay `^[a-zA-Z0-9_-]+$` (the ✕ route checks this). Lines added later end in
  `__a` + 4 base-36 characters, picked once per adding session.
- An order holds at most 50 lines in all (`MAX_ITEMS`).

## Data

- `saleItem.addedAt` (datetime, server time of the save). Lines from the first checkout have none.
- Nothing else changes in the schema. `Sale` (app/pos/types.ts) gains the fields Sanity already
  returns: `_rev`, `loyaltyMemberId`, `loyaltyRewards`, and `addedAt` on items.

## API

- `POST /api/sales/[id]/items` `{ rev, items, discounts?, paymentAmount?, notes?, loyaltyRewards? }`
  - 400: invalid body, a new line id equal to a saved one, more than 50 lines in all (or 102
    discount rows), a line's rows coming to more than it and its add-ons cost, a total over
    ₱1,000,000, rewards on an order with no card, a reward this order already used, rewards
    without their own classic unit. 422: the stored order's lines or total can't be read.
  - 404 `order-gone`: not a sale. 409 `order-completed` and 409 `order-changed`, both with the order
    as it now is in `data`, so a POS whose earlier save went through can see its lines on it;
    409 `loyalty-card-changed`; 503 card unreadable.
  - Saves with `ifRevisionId(rev)`: `items` and `discounts` appended, `subtotal` = all lines,
    `total` = saved total + new lines − their rows, `paymentAmount` (absent = exact), `change`,
    `notes` as sent (empty unsets it) unless the order is on a loyalty card, `loyaltyRewards`
  extended. Replies `{ success, data: sale }`.
- `PATCH /api/sales/[id]` `{ removeLineId }`: also drops that line's discount rows (and rows left by
  lines removed before; a legacy `order:` row stays) and the reward of a loyalty row among them;
  subtotal, total and change from what is left. It writes whole arrays behind `ifRevisionId`, and
  deletes a last-line order only at the revision read, so a save landing in between (Add items)
  is never written over; one retry, then 409.
- `PATCH /api/sales/[id]` `{ notes }`: names the order, trimmed and up to 100 characters; empty
  clears it. 404 when not a sale; 400 for an order on a loyalty card.

## Screens

- Sales › Recent orders: **Add items** between Complete and Print (full page load). Lines
  added later sit under "+ Added 2:31 PM", one group per save, add-ons nested within their
  group; the header shows the latest. **Print** opens one sheet: Staff ticket (the latest added
  group, with a "Whole order" switch), Receipt (always the whole order), or Both in one print:
  the receipt on top, a tear line, then the staff ticket. Its PDF is always the customer's receipt ("Download receipt PDF"),
  as at checkout: a PDF is for emailing the customer. The name in the header (or
  "No name") is a button to add, change or clear it, on Recent and Completed alike; a card
  holder's order shows the name fixed.
- `/pos?edit=<id>`: the order loads on the server with the menu. A completed, deleted or
  unreadable order opens a normal POS with a notice saying why.
  - A banner under the header names the order, with Cancel (back to Sales; asks first when new
    items are in the cart).
  - The order panel lists the new lines first, then "Already ordered" (locked lines and saved
    discount rows): with a linked card's panel open the list has little room, and the new lines
    are what the cashier is working on. The saved name fills the plain name field (no card
    suggestions), where it can be changed or cleared; a card holder's order shows it fixed.
  - A linked card shows its bar with the added drinks' stamps. 10% off only when the order has
    not used it and has no Google Review row; the free drink only when the order has not used
    it; Google Review chips are locked when the order used the loyalty 10%.
  - Totals: Already ordered, Adding now, Total due. Payment applies to Total due. Charge reads
    "Review · ₱…".
  - Review: "Already ordered" then "Adding now"; Total due for the whole order and "added now";
    one button, "🖨 Save + Print". The name can be added ("+ Add name") or edited there too,
    except on a card holder's order.
  - After saving, a preview shows the whole order's receipt: "Print receipt" prints it, "Print
    both" prints it with the added items' staff ticket below, and ✕ skips printing. Either way a
    new order starts in place (no page load, which could cut short the print handed to RawBT).
  - A lost reply: on the next try the server answers with the order; lines and rows exactly as
    sent mean saved; at other amounts, the order shows what was saved and the cart empties.
  - Refusals: completed or deleted → "Make it a new order" keeps the cart and name; changed →
    the saved part refreshes, check and save again; card changed → as at checkout.

## Review focus

1. A lost reply or a double tap on Save: the second save must be refused (`order-changed`), never
   append twice. Pinned in Task 4 (rev mismatch, commit conflict) and Task 7 (POS shows the refresh).
2. A name sent for an order on a loyalty card must not rename it; an empty one clears the name.
   Pinned in Task 4 and the PATCH route's name tests.
3. A standalone add-on added while adding must get a unique line id and stay in its own group on
   Sales. Pinned in Tasks 5 and 8.
4. A sale saved before `subtotal` existed: the new subtotal comes from the lines. Pinned in Task 4.
5. More than 50 lines in all: refused with a message the cashier understands. Pinned in Task 4.

## Order of work (each step test-first; run `npx vitest run`, tsc and eslint after each)

- [x] 1. Characterization tests for `app/api/sales/[id]/route.ts` (DELETE, complete, ✕), green on
  today's code. Then a jsdom click-through of today's checkout, kept in the scratchpad and re-run
  after every later step.
- [x] 2. ✕ fix in the PATCH route, with its tests.
- [x] 3. Move the sale-input checks to `lib/sales/validateSaleInput.ts` (pure move, tests green).
- [x] 4. `POST /api/sales/[id]/items`, `saleItem.addedAt`, `Sale` type fields.
- [x] 5. `app/pos/addToOrder.ts` (open order, line suffix, payload, totals), `app/pos/postAddItems.ts`,
  `lib/sales/loadOpenSale.ts`.
- [x] 6. Loyalty while adding: `resolveLoyaltyOrder` `orderUsed`, Google Review lock in the item modal.
- [x] 7. POS adding mode: `app/pos/page.tsx`, `POSClient.tsx` (state in `addToOrder.ts`, saved lines
  in `SavedOrderLines.tsx`), `OrderReviewModal.tsx`.
- [x] 8. Sales card: Add items, added groups; staff ticket of the latest group with a whole-order switch.
- [x] 9. Full verification, static screenshots of the new screens, code review, docs and memory.
- [x] 10. Second round (owner, 2026-10-04): one Print sheet on Sales; Complete + Print and Save +
  Print print both tickets with a tear line (`{ kind: 'tear' }` in all three renderers); the
  name editable on the review screen, on the Sales card and while adding.
  - After its code and security reviews: every receipt text prints as text (cp437 keeps glyphs
    such as ← and ↔ in its ESC and GS slots, so they print as ?); the PDF is the customer's
    receipt; a name changed or cleared on another device is taken on a refresh, and one typed
    here is kept when the other device left the name alone (`nameAfterRefresh`); the Sales rename
    goes through `sendRename`; PATCH answers 400 to a body that is not an object.
  - Left for the owner: an order whose loyalty card was removed keeps the card holder's name
    locked, since its `loyaltyMemberId` stays on the sale.
- [x] 11. Third round (owner, 2026-10-04): Both prints the receipt first (`receiptThenStaff`); the
  review screen's one button, Complete + Print or Save + Print, saves and opens a preview with
  "Print receipt" and "Print both" (`SalePrints`, `ReceiptPreviewModal` `prints`), where ✕ skips
  printing; "Order Complete ✓" and "Save to order ✓" are gone, so the POS no longer opens
  Sales after a sale.
  - After its code review: Sales is linked from the POS header at every screen width (it was on
    wide screens only); the preview after a sale says it is saved, and closes only with ✕, never
    on a tap beside it or while a print is being prepared; a sale clears an old `?edit=` from the
    address and the notice that came with it.
  - Left for the owner: the POS reads the menu once per page load, and staying on the POS means a
    price changed in Studio reaches it on the next reload.
