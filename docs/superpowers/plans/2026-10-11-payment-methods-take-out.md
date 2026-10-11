# Payment methods and take-out — implementation plan

> **For agentic workers:** built inline by the author right after writing (the owner said "start implementation
> now" on 2026-10-11), test-first with superpowers:test-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** every order records Dine in or Take out and how it was paid (Cash, E-wallet or Card, or a split of
two), and Sales gets a Tally tab whose per-method totals always add up to Revenue.

**Architecture:** the sale document gains `orderType` and a keyed `payments[]` array. The POS picks both on
the review screen; the routes validate payments against what is due and keep `paymentAmount`/`change` (what
was handed over) in step. Receipts, the kitchen ticket and Sales read the new fields; orders saved before
this have none and count as "Not recorded", so every total still adds up.

**Tech stack:** Next 16 App Router, React 19, Tailwind 4, Sanity (`ifRevisionId`), Vitest 4 (node env,
static-markup component tests), ESC/POS via `@point-of-sale/receipt-printer-encoder`.

**Spec / prototype (agreed with the owner, v3):** https://claude.ai/artifact/8pyF6Jf8QYr3GBSxtvNpA5

## Owner decisions (2026-10-11)

| Question | Decision |
|---|---|
| Where the method is picked | Review screen, right above Complete + Print. The ₱500/₱1,000/₱2,000 buttons leave the order panel |
| Dine in / Take out | Review screen only, asked as "Dine in or take out?" just above "How are they paying?". Not on the order panel |
| Must a method be picked | Yes: Complete + Print stays off until one is. Cash means the exact amount until an amount is tapped; short cash blocks |
| E-wallet | One button, "E-wallet" (GCash · Maya) |
| Split | Behind "Split payment": first part typed, the rest worked out; two different methods |
| Default type | Dine in; Take out one tap away |
| Take-out fee | None |
| Items added later | Paid then, by any method; each payment counts under its own method. **Replaces** the 2026-10-04 "total due while adding = whole order": while adding, what is due is the new lines only |
| Wrong method | Fixed on Sales (order card or Tally list), no PIN |
| Sizes | Compact controls, no icons on the payment tiles (round 3) |
| Tally | Its own Sales tab between Completed and Top items; tapping a method lists its payments with Edit |

## Global constraints

- Copy style of the POS: plain sentences, `·` separators, no PIN in this flow.
- Amounts are whole pesos in practice (prices are integers, discounts are `Math.round`ed); compare with
  `samePesos` (|a − b| < 0.005) anyway.
- Old orders and old clients keep working: `orderType` and `payments` are optional on every route; a body
  without them is saved as before.
- `payments[]._key` matches `^[A-Za-z0-9_-]+$` (the PATCH route takes it in JSON, never in a path).
- Receipt text stays ASCII for the printer's code page ("E-wallet", "TAKE OUT").
- Payment colours (validated colour-blind-safe): Cash `#008300`, E-wallet `#2a78d6`, Card `#eb6834`,
  Not recorded `#b9beb3`. Text never takes the series colour.

## Data

```ts
// lib/sales/payments.ts
export const PAYMENT_METHODS = ['cash', 'ewallet', 'card'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
export const ORDER_TYPES = ['dine-in', 'take-out'] as const
export type OrderType = (typeof ORDER_TYPES)[number]
export interface PaymentInput { method: PaymentMethod; amount: number; received?: number } // received: cash only, ≥ amount
export interface SalePayment extends PaymentInput { _key: string; addedAt?: string }        // addedAt: paid for items added later
```

Sanity `sale` gains `orderType` (string list) and `payments` (array of new object type `salePayment`).
`paymentAmount` = everything handed over (cash as received, the rest exactly); `change` = `paymentAmount − total`.
A ₱0 order (a free drink only) takes no payment: `payments: []`.

## API

- `POST /api/sales` accepts `orderType?` and `payments?`. Payments must be one, or two by different methods,
  each > 0, together exactly `total`; cash may carry `received ≥ amount`, other methods may not. Bad →
  400 "How it was paid doesn't add up to the total…". Stored with keys `pay-0`, `pay-1`; `paymentAmount`
  and `change` are worked out from them.
- `POST /api/sales/[id]/items` accepts `payments?` for the new lines (due = new lines − their rows).
  Appended with `addedAt` and keys `pay-<addedAt base36>-<n>`; `paymentAmount` grows by what was handed over.
- `PATCH /api/sales/[id]`:
  - `{ paymentKey, method }` changes one payment's method behind `ifRevisionId`, one retry, then 409.
    Unknown key → 409 "This payment changed on another device…".
  - `{ removeLineId }` also shrinks the payments by what came off the total: the removed line's round first,
    then any unrecorded part, then other payments newest first. A cash payment cut to nothing is dropped.
- `GET /api/sales/summary` adds `paymentTally`, `orderTypes`, and with `lines=1` the `paymentLines` list.

## File map

| File | Responsibility |
|---|---|
| `lib/sales/payments.ts` (new) | Contract: types, labels, `parsePayments`, `handedOver`, `toSalePaymentDocs`, `samePesos` |
| `lib/sales/paymentChanges.ts` (new) | Server edits: `shrinkPayments`, `changePaymentMethod` |
| `lib/sales/paymentTally.ts` (new) | Sales maths: `tallyPayments`, `countOrderTypes`, `paymentLines`, `wholeShares` |
| `app/pos/review/payState.ts` (new) | POS state: `PayState`, `NO_PAYMENT`, `checkPay`, `cashSuggestions`, `startSplit`, `endSplit` |
| `app/pos/review/OrderTypeToggle.tsx`, `PaymentPicker.tsx`, `CashAmounts.tsx`, `SplitPayment.tsx`, `PaymentReadout.tsx` (new) | Review-screen controls |
| `app/pos/OrderReviewModal.tsx` | Footer: due + readout left; type, method, Complete right |
| `app/pos/POSClient.tsx` | `orderType` + `pay` state; order panel loses the payment presets |
| `app/pos/salePayload.ts`, `app/pos/addToOrder.ts`, `lib/sales/addItems.ts` | Bodies carry `orderType`/`payments` |
| `app/api/sales/route.ts`, `app/api/sales/[id]/items/route.ts`, `app/api/sales/[id]/route.ts`, `app/api/sales/summary/route.ts` | Validate, store, edit, sum |
| `lib/printer/receiptDocument.ts`, `receiptFromSale.ts`, `encodeReceipt.ts`, `buildReceiptPdf.ts`, `app/pos/ReceiptPreview.tsx` | Order row, payment rows, `banner` block on the kitchen ticket |
| `sanity/schemaTypes/salePayment.ts` (new), `sale.ts`, `index.ts` | Studio schema |
| `app/pos/types.ts` | `Sale.orderType`, `Sale.payments`, summary fields |
| `app/pos/sales/ViewTabs.tsx`, `SalesClient.tsx`, `TallyView.tsx`, `PaymentTallyCard.tsx`, `PaymentLinesList.tsx`, `OrderTypeCard.tsx`, `MethodFix.tsx`, `OrderPayments.tsx`, `sendMethodChange.ts`, `paymentColors.ts`, `OrderCard.tsx`, `OrdersView.tsx` | Tally tab, order card badges, fixing a method |

## Review focus

1. A ₱0 order (only a loyalty free drink): no payment is asked for, Complete + Print is on, the save has `payments: []`.
2. Removing a line on Sales after payment: payments shrink so the tally still adds up (round-matched, then unrecorded, then newest).
3. Adding items to an order saved before this feature: the old part counts as Not recorded, the new payment under its method.
4. An old POS tab (no `orderType`/`payments` in its body) still saves, as before.
5. Two devices fixing the same payment: the second write is behind the revision and retries once against fresh data.

---

### Task 1: Payment contract

**Files:** create `lib/sales/payments.ts`, `lib/sales/payments.test.ts`

- [ ] Tests: `parsePayments` takes one exact payment, a split of two methods, cash with `received`, `[]` for ₱0 due;
  refuses: wrong sum, two of one method, three payments, `received` on e-wallet, `received < amount`, 0/negative
  amounts, unknown method, non-array; `handedOver` (cash as received); `toSalePaymentDocs` keys (`pay-0`;
  `pay-<base36>-0` with addedAt) and `_type`; `isOrderType`.
- [ ] Run, see them fail; implement; run green.

### Task 2: POS pay state

**Files:** create `app/pos/review/payState.ts`, `app/pos/review/payState.test.ts`

- [ ] Tests: `checkPay` → info "Choose how they're paying first." with nothing picked; cash exact (change 0);
  cash ₱500 on ₱420 (change 80, received 500); ₱400 on ₱420 → error, `short: 20`; e-wallet/card exact; split
  valid (₱200 + rest), same methods → error, no amount → info, first part ≥ due → error; due 0 → ok, no payments.
  `cashSuggestions(420)` = [450, 500, 1000, 2000], `(100)` = [200, 500, 1000, 2000], `(1240)` = [1250, 1300, 2000].
- [ ] Implement; green.

### Task 3: Schema and types

**Files:** `sanity/schemaTypes/salePayment.ts` (new), `sale.ts`, `index.ts`, `app/pos/types.ts`

- [ ] `salePayment` object (method list, amount, received, addedAt read-only); `sale.orderType` (radio list) and
  `sale.payments`. `Sale` gains `orderType?`, `payments?`; `SalesSummary` gains `paymentTally`, `orderTypes`,
  `paymentLines?`. `tsc --noEmit` clean.

### Task 4: Saving a new order

**Files:** `app/pos/salePayload.ts` (+test), `app/api/sales/route.ts` (+test)

- [ ] Payload tests: carries `orderType` and `payments`; `paymentAmount` = handed over; ₱0 → `payments: []`, paymentAmount 0.
- [ ] Route tests: stores `orderType`, keyed `payments`, worked-out `paymentAmount`/`change`; 400 on payments that
  don't add up or a bad `orderType`; a body without them saves as before.
- [ ] Implement; green.

### Task 5: Receipts and the kitchen ticket

**Files:** `lib/printer/receiptDocument.ts`, `receiptFromSale.ts` (+test), `encodeReceipt.ts` (+test),
`buildReceiptPdf.ts`, `app/pos/ReceiptPreview.tsx`

- [ ] Tests: customer receipt has `Order: Take out`; rows per payment, then Change only with cash; a payment
  per round shows its time; an order whose payments don't cover it prints Payment/Change as before; kitchen
  ticket opens with `{kind:'banner', text:'TAKE OUT', inverted:true}` (DINE IN not inverted), and none for an old
  order; ESC/POS banner sends GS B 1 … GS B 0.
- [ ] Implement the `banner` block in all three renderers (exhaustive switch); green.

### Task 6: Review screen controls

**Files:** `app/pos/review/*.tsx` (+tests), `app/pos/OrderReviewModal.tsx` (+test)

- [ ] Tests (static markup): type toggle shows Dine in pressed; three tiles without icons; cash amounts and Other;
  split editor with "worked out"; readout (change, short, paid by, split); Complete disabled until a method,
  hint text; adding mode shows "Due now" for the new lines and the saved order's payments.
- [ ] Implement; green.

### Task 7: POS wiring

**Files:** `app/pos/POSClient.tsx`, `app/pos/addToOrder.ts` (+test), `lib/sales/addItems.ts`

- [ ] Tests: `buildAddItemsBody` sends `payments` for the new lines and no `paymentAmount`; `openOrderFromSale`
  keeps `orderType` and `payments`.
- [ ] POSClient: `orderType`/`pay` state reset on clear and after a save; order panel without presets, with the
  note; due while adding = new lines; review props. POSClient tests still green.

### Task 8: Paying for items added later

**Files:** `app/api/sales/[id]/items/route.ts` (+test)

- [ ] Tests: appends payments with `addedAt`; `paymentAmount` grows by what was handed over; payments that don't add
  up to the new lines → 400; a body without payments works as before.
- [ ] Implement; green.

### Task 9: Fixing a method, and removing a line after payment

**Files:** `lib/sales/paymentChanges.ts` (+test), `app/api/sales/[id]/route.ts` (+test)

- [ ] Tests: `shrinkPayments` order (round, unrecorded, newest), cash cut keeps `received`, dropped cash hands
  back its received; `changePaymentMethod` (to cash → received = amount, from cash drops received, unknown key
  null); PATCH `{paymentKey, method}` writes payments/paymentAmount/change, 409 on unknown key, 400 on bad
  method; removing a line shrinks payments.
- [ ] Implement; green.

### Task 10: Tally maths and the summary route

**Files:** `lib/sales/paymentTally.ts` (+test), `app/api/sales/summary/route.ts`

- [ ] Tests: per-method sums and once-per-order counts; Not recorded for old and partly paid orders; type counts;
  lines newest first with `paidAt` and `partOfMore`; `wholeShares` sums to 100.
- [ ] Summary returns `paymentTally`, `orderTypes`, and `paymentLines` with `lines=1`; green.

### Task 11: Sales Tally tab

**Files:** `app/pos/sales/ViewTabs.tsx` (+test), `TallyView.tsx`, `PaymentTallyCard.tsx`, `PaymentLinesList.tsx`,
`OrderTypeCard.tsx`, `MethodFix.tsx`, `sendMethodChange.ts` (+test), `paymentColors.ts`, `SalesClient.tsx`

- [ ] Tests: tabs Recent orders · Completed · Tally · Top items · Top names (long periods: Tally · Top items ·
  Top names); tally markup (rows, "Adds up to", Not recorded only when present); lines list with Edit;
  `sendMethodChange` replies (ok, 404 gone, 409, network).
- [ ] Implement; green.

### Task 12: Order card

**Files:** `app/pos/sales/OrderPayments.tsx` (+test), `OrderCard.tsx`, `OrdersView.tsx`, `SalesClient.tsx`

- [ ] Tests: Take out badge, payment badges (time on a multi-round order), fix row; old orders show neither.
- [ ] Implement; green.

### Task 13: Verify

- [ ] `npx vitest run`, `npx tsc --noEmit -p tsconfig.json`, `npm run lint`.
- [ ] Static render screenshots of the review screen (cash, split, take out) and the Tally tab (ui-visual-check technique).
- [ ] Code review (code-reviewer agent) and a security pass on the new PATCH/POST inputs; fix findings.
