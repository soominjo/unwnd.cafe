# Loyalty card holders — implementation plan

**Goal:** a stamp card for customers the owner has handed a physical loyalty card. Card holders
are linked to an order at checkout by name or card number; Signature and Matcha Series drinks
earn stamps; stamp 6 gives 10% off one classic drink, stamp 11 a free classic drink.

**Prototype (agreed with the owner, 2026-10-02):** https://claude.ai/artifact/ELvuNn8UWJizGkjCjxkX6a

## Owner decisions

| Question | Decision |
|---|---|
| Who collects stamps | Only card holders, added from the Loyalty button in the /pos header when a card is handed out |
| Linking at checkout | Staff type the name (any capitals) or card number; card holders appear as suggestions; a tap links the order. Only a linked order shows the stamp bar |
| Other names | Typed as today, saved as the order's name, no stamps, no bar |
| Stamp UI | A compact 11-step progress bar, 10% marked at 6, FREE at 11 |
| Stamps | 1 per Signature (`signature`) or Matcha Series (`matcha-series`) drink, hot or iced; nothing for Espresso, Non-Coffee, food or add-ons |
| When a reward can be used | On the order that earns it (the cart's stamps count straight away) |
| 10% off | One unit of one classic (Espresso or Non-Coffee) drink, which staff pick after tapping "Use 10% off"; add-ons on it are paid. With no classic drink in the order, staff are told to ask the customer to add one. Still one 10% per order, so no Google Review on that order (changed on 2026-10-02 from every item) |
| Free drink | One unit of any Espresso or Non-Coffee drink, hot or iced; add-ons on it are paid |
| Unused 10% | Never expires |
| Same names | Each card gets a number (No. 1, 2, 3…), shown in suggestions; write it on the card |
| Give a card | No PIN: any signed-in POS can give one, for less hassle at the counter (changed from the manager PIN on 2026-10-02) |
| Remove a card | Manager PIN (the POS PIN), checked by the server |

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

- `stampsIn(lines)`, `cardState({ earned, usedTen, usedFree })`, `cardTotals(sales)`.
- Every 11 stamps fill a card; each card unlocks one 10% at stamp 6 and one free drink at 11.
  Ready = unlocked − used.
- `matchCardHolders(holders, query)`: by name prefix (case and spacing ignored) or card number.
- `isClassicDrinkLine(line)`: an Espresso or Non-Coffee line that is not an add-on; both rewards
  go on one of these. `classicUnitsIn(lines)` counts them, one per unit.

## Discounts (`app/pos/discounts.ts`)

- `buildDiscountLines(items, loyalty)` takes `{ tenLineId, freeLineId }`, each naming the classic
  drink line its reward is on.
- Free drink: one unit of that line's price, row "Loyalty free drink". Other discounts on that
  line are worked out on the units still paid.
- Loyalty 10%: one `loyalty` row, 10% of one unit of its line's price (add-ons paid). It needs a
  unit not already free: a single drink cannot be both. Putting it on takes Google Review off
  every line, and the Google Review chips are locked while it is on.

## API

- `POST /api/sales` accepts `loyaltyMemberId` and `loyaltyRewards`. Each reward needs its own
  classic drink unit in the order (else 400). It checks that the card holder
  exists and that each reward is really ready (counting this order's stamps). A card removed, or
  a reward already used on another device, gets a 409 with `code: 'loyalty-card-changed'`. The
  check and the save are not one transaction, so two sales sent at the same instant could both
  pass.
- `GET /api/loyalty/members`: card holders with their cards.
- `POST /api/loyalty/members` `{ name }`: gives a card; it needs only the POS session.
- `DELETE /api/loyalty/members/[id]` `{ pin }`: the server checks the manager PIN against
  `POS_PIN` (timing-safe) before removing anything. A wrong PIN is a 403, so the POS can tell it
  from a signed-out session (401).
- Each change and each wrong PIN is logged with the card's id, never the PIN.

## Screens

- `/pos`: card holders load with the menu on the server. Under Customer name: suggestions, the
  linked holder, "Not them? Unlink", the stamp bar, "Use 10% off" and "Make free" on eligible
  lines. The review screen shows the customer their stamps.
  - Names are suggested from two typed characters; a card number at any length.
  - "Use 10% off" puts the 10% straight on the order's only classic drink, or lists them to pick
    one ("Cafe Latte · Hot"). With none, it says to ask the customer to add one; a classic drink
    added then shows up to pick. Once on, the button names the drink, and a tap takes it off.
  - A reward turns itself off once it stops applying (a stamp drink or the free line taken off),
    and needs a new tap to come back. The rules are in `app/pos/loyaltyOrder.ts`.
  - Line badges are read from the discount rows, so they always match the breakdown.
  - When a sale comes back `loyalty-card-changed`, the POS reads the cards again and keeps the
    order on screen with the updated total. The cards are also read again after each receipt
    sale, which picks up cards given on another device.
- `/pos` header › Loyalty (between Manager and Sales): a panel over the order on screen, so the
  cart stays. Every card holder with card number, bar and ready rewards; "Give a card" (no PIN)
  and Remove (manager PIN). It reads the cards again when it opens, and a card given there is
  suggested in Customer name at once. It is not on the Sales page.

## Order of work (each step test-first)

1. `lib/loyalty.ts` rules and tests.
2. Discounts: loyalty 10% and free drink rows, tests.
3. Sale payload + `POST /api/sales` validation + Sanity schema.
4. Manager-PIN check helper, card-holder API and store.
5. POS: name field, bar, rewards, review screen.
6. Loyalty panel, opened from the POS header.
