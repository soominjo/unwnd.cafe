# Loyalty card holders — implementation plan

**Goal:** a stamp card for customers the owner has handed a physical loyalty card. Card holders
are linked to an order at checkout by name or card number; their items earn stamps (see
Stamps); stamp 6 gives 10% off one Espresso, Non-Coffee, Waffle or Snack item, stamp 11 a free
classic drink.

**Prototype (agreed with the owner, 2026-10-02):** https://claude.ai/artifact/ELvuNn8UWJizGkjCjxkX6a

## Owner decisions

| Question | Decision |
|---|---|
| Who collects stamps | Only card holders, added from the Loyalty button in the /pos header when a card is handed out |
| Linking at checkout | Staff type the name (any capitals) or card number; card holders appear as suggestions; a tap links the order. Only a linked order shows the stamp bar |
| Other names | Typed as today, saved as the order's name, no stamps, no bar |
| Stamp UI | A compact 11-step progress bar, 10% marked at 6, FREE at 11 |
| Stamps | From Oct 5, 2026, 12:00 AM Manila (owner, 2026-10-04): 1 per Signature, Matcha Series or Meal item; ½ per Espresso, Non-Coffee, Waffle or Snack item, so two make a stamp; none for add-ons. Orders before then keep the first rules (1 per Signature or Matcha Series drink, nothing else), so no card changed; items added to an older order later count by the new rules. Cards show halves ("6½ of 11") |
| When a reward can be used | On the order that earns it (the cart's stamps count straight away) |
| 10% off | One unit of one Espresso, Non-Coffee, Waffle or Snack item (Waffle and Snack added 2026-10-04), which staff pick after tapping "Use 10% off"; add-ons on it are paid. With none in the order, staff are told to ask the customer to add one. Still one 10% per order, so no Google Review on that order (changed on 2026-10-02 from every item) |
| Free drink | One unit of any Espresso or Non-Coffee drink, hot or iced; add-ons on it are paid |
| Unused 10% | Never expires |
| Same names | Each card gets a number (No. 1, 2, 3…), shown in suggestions; write it on the card |
| Give a card | No PIN: any signed-in POS can give one, for less hassle at the counter (changed from the manager PIN on 2026-10-02) |
| Remove a card | No PIN either: any signed-in POS can remove one after confirming what the card loses (changed from the manager PIN on 2026-10-03) |

## Data

- New Sanity type `loyaltyMember`: `name`, `cardNumber` (next free number, unique). Joined date
  is `_createdAt`. Removing a card holder deletes the document; their past orders keep the name.
- Card numbers come from the counter document `loyalty-card-counter` (atomic increment), so a
  removed card's number is never given out again. The number is read-only in Studio.
- Names are 2–60 characters: letters (any script), numbers, spaces and `. , ' ’ & ( ) -`. They
  print on receipts, and the printer can read other symbols as commands.
- `sale` gains `loyaltyMemberId` (string) and `loyaltyRewards` (`'ten' | 'free'`, each at most
  once). No customer contact details are stored (the dataset is public).
- Stamps are never stored: a card holder's card is counted from their linked sales
  (`items[].categoryId × qty`) and the rewards those sales used. Deleting an order or a line
  takes its stamps back.

## Rules module (`lib/loyalty.ts`, shared by server and POS)

- `stampsIn(lines, orderedAt?)`: each line counts by the rules of `line.addedAt ?? orderedAt`
  (no date: the order on screen, the new rules); `STAMP_RULES_FROM` is the switch-over.
  `cardState({ earned, usedTen, usedFree })`, `cardTotals(sales)` (each sale by its `_createdAt`).
  `formatStamps` and `stampCount` write halves as ½.
- Every 11 stamps fill a card; each card unlocks one 10% at stamp 6 and one free drink at 11.
  Ready = unlocked − used.
- `matchCardHolders(holders, query)`: by name prefix (case and spacing ignored) or card number.
- `isClassicDrinkLine(line)`: an Espresso or Non-Coffee line that is not an add-on; the free
  drink goes on one of these. `isTenOffLine(line)`: one the 10% can go on (also Waffle and Snack).
  `rewardsFitOrder(lines, rewards)`: a classic unit for the free drink, another eligible unit for
  the 10%.

## Discounts (`app/pos/discounts.ts`)

- `buildDiscountLines(items, loyalty)` takes `{ tenLineId, freeLineId }`, each naming the line
  its reward is on: a classic drink for the free one, also a Waffle or Snack for the 10%.
- Free drink: one unit of that line's price, row "Loyalty free drink". Other discounts on that
  line are worked out on the units still paid.
- Loyalty 10%: one `loyalty` row, 10% of one unit of its line's price (add-ons paid). It needs a
  unit not already free: a single drink cannot be both. Putting it on takes Google Review off
  every line, and the Google Review chips are locked while it is on.

## API

- `POST /api/sales` accepts `loyaltyMemberId` and `loyaltyRewards`. Each reward needs its own
  unit in the order (`rewardsFitOrder`, else 400). It checks that the card holder
  exists and that each reward is really ready (counting this order's stamps). A card removed, or
  a reward already used on another device, gets a 409 with `code: 'loyalty-card-changed'`. The
  check and the save are not one transaction, so two sales sent at the same instant could both
  pass.
- `GET /api/loyalty/members`: card holders with their cards.
- `POST /api/loyalty/members` `{ name }`: gives a card; it needs only the POS session.
- `DELETE /api/loyalty/members/[id]` (no body): removes a card; it needs only the POS session.
  A signed-out POS gets a 401.
- Each change is logged with the card's id.

## Screens

- `/pos`: card holders load with the menu on the server. Under Customer name: suggestions, the
  linked holder, "Not them? Unlink", the stamp bar, "Use 10% off" and "Make free" on eligible
  lines. The review screen shows the customer their stamps.
  - Names are suggested from two typed characters; a card number at any length.
  - "Use 10% off" puts the 10% straight on the order's only eligible item, or lists them to pick
    one ("Cafe Latte · Hot", "Classic Waffle"). With none, it says to ask the customer to add
    one; an item added then shows up to pick. Once on, the button names the item, and a tap takes
    it off.
  - A reward turns itself off once it stops applying (a stamp drink or the free line taken off),
    and needs a new tap to come back. The rules are in `app/pos/loyaltyOrder.ts`.
  - Line badges are read from the discount rows, so they always match the breakdown.
  - When a sale comes back `loyalty-card-changed`, the POS reads the cards again and keeps the
    order on screen with the updated total. The cards are also read again after each receipt
    sale, which picks up cards given on another device.
- `/pos` header › Loyalty (between Manager and Sales): a panel over the order on screen, so the
  cart stays. Every card holder with card number, bar and ready rewards; "Give a card" and
  Remove, neither with a PIN. Remove asks first, naming the stamps and rewards the card loses.
  It reads the cards again when it opens, and a card given there is suggested in Customer name
  at once. It is not on the Sales page.

## Order of work (each step test-first)

1. `lib/loyalty.ts` rules and tests.
2. Discounts: loyalty 10% and free drink rows, tests.
3. Sale payload + `POST /api/sales` validation + Sanity schema.
4. Card-holder API and store (removing a card first took the manager PIN; dropped on 2026-10-03).
5. POS: name field, bar, rewards, review screen.
6. Loyalty panel, opened from the POS header.
