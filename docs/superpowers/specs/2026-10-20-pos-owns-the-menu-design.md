# The POS owns the menu — design

Date: 2026-10-20 · Status: awaiting the owner's approval · Revised after the builder check and after commits `1a1c79f` and `888a809`

## Why

The owner runs the café's menu from the POS in manager mode (Manager page → Edit the menu, behind the manager PIN). Two things get in the way:

1. **Some things can't be deleted, or come back after a delete.** Part of the menu is written in code: items in `app/pos/menuData.ts` (`MENU`) and 6 tabs in `lib/menuCategories.ts` (`BUILT_IN_CATEGORIES`). The POS and `/menu` merge that code menu with Sanity by item name. A code item has no ✎/✕ because it has no Sanity record. Deleting a Sanity copy that stands in for a code item brings the code item back. Code tabs can't be deleted (the API answers 403) and no tab can be renamed.
2. **`/menu` lags the POS.** It re-renders at most once an hour (`revalidate = 3600`), reads through Sanity's API CDN, and has its own merge logic (`buildMergedItems` in `app/menu/page.tsx`) that can drift from the POS's.

In the owner's words: manager mode is "the most highest role". Anything deleted there stays deleted, whatever created it (code, Sanity Studio or localhost). "The /pos should be higher; the menu page should follow it."

## Goals

- **G1.** In manager mode, every item and every tab the POS shows can be edited and deleted. A delete is permanent: nothing reappears on the POS or `/menu`, including after later deploys.
- **G2.** Tabs can be renamed in manager mode, and the names the cashier sees everywhere follow the rename.
- **G3.** `/menu` shows what the POS has: the same tabs in the same order under the same names, and the same items with the same names, subtitles and prices. A POS save shows on `/menu` the next time anyone opens or refreshes it, within a few seconds.
- **G4.** One source of truth: the Sanity documents `menuItem`, `menuCategory` and `menuSettings`. No menu stays in code.
- **G5.** Within a tab, items stay in the order they were added, oldest first, on the POS and on `/menu`, through reloads and deploys.
  - The owner's example: add Americano, then Caramel, then Spanish, then Cafe Latte. They show in exactly that order, every time.
  - Editing an item keeps its place.

## Non-goals

- Live updates to a `/menu` page someone already has open. A refresh shows the change.
- Changing a tab's type (drink/food) or its id from the POS. Rename changes the visible name only.
- Undo or restore after a delete.
- Any change to how an item's ✕ behaves: it deletes at once, as today.
- Other POS tablets picking up edits without a reload (same as today).
- Changing which tabs the loyalty rules apply to. They stay keyed on tab ids, as in `lib/loyalty.ts`.
- Reordering items by hand, for example by dragging. Items keep the order they were added in (G5).
- The public-site redesign (a separate project awaiting the owner's approval).

## Anti-goals

These would be failures even if everything else works:

- A deleted item or tab reappearing anywhere. This includes something the move itself creates.
- Undoing a rename. Espresso must stay "Classic".
- Past sales, Sales history or loyalty stamps changing because of this work.
- The POS losing its tabs during the switch, for example because the new code shipped before the data move.
- Items moving around within a tab on their own, after a reload, a deploy or someone else's edit.
- `/menu` and the POS disagreeing, apart from two deliberate differences:
  - Add ons are never on `/menu`.
  - "Hide from POS" items are on `/menu` but not on the POS order grid.

## Current state

The owner is editing the live menu while this is written. Read the live dataset when planning and when running the move; don't rely on the counts here. Read 2026-10-20 at about 14:00 Manila.

**Dataset.** Localhost and the live site both use Sanity project `mguahlyz`, dataset `production`. There is no seed script; "seeded" means the code menu.

**Code tabs** (`BUILT_IN_CATEGORIES`, live since `888a809`):

| id | label | type | order |
|---|---|---|---|
| `signature` | Signature | drink | 1 |
| `espresso` | **Classic** (renamed at the owner's request) | drink | 2 |
| `non-coffee` | Non-Coffee | drink | 3 |
| `meal` | Meal | food | 4 |
| `waffle` | Waffle | food | 5 |
| `snack` | Snack | food | 6 |

**Sanity tabs:** `add-ons`, `matcha-series` and `add-ons-food`. `menuSettings.categoryOrder` includes `add-ons-food` now, and the owner keeps reordering it.

**Items in code:** none since `ecc312f`. `MENU` keeps the six tabs with empty item lists.
- **Removed on 2026-10-20 at the owner's request:** Amber Cream Latte, Cafe Latte, Spanish Latte, Mocha Latte, White Chocolate Mocha, Chocolate Milk and Strawberry Milk.
- **Removed in `ecc312f`:** Cereal Cream Latte and White Mocha Americano.
  - The owner renamed the saved one to "Cereal Cream Latte⭐", and the unstarred code copy came back beside it. The name-based stand-in rule hides a code item only behind a saved one with the exact same name.
  - White Mocha Americano went too, since it would have done the same once starred.

**Items in Sanity:** about 34. None are in Classic (`espresso`) or Non-Coffee, so both tabs are empty. No item names a tab that doesn't exist.

**`hiddenItemIds`** lists only ids that are no longer in code.

**Code that uses the code menu:**
- `app/pos/POSClient.tsx`: the merge, plus the fallback when Sanity can't be read.
- `app/menu/page.tsx`: its own merge.
- `lib/menuCategories.ts`: `getResolvedCategories`. Also used by the POS category API and by Sales summary for its category filter chips.
- `app/api/menu/categories/route.ts`: refuses code tab ids with a 409.
- `app/api/menu/categories/[id]/route.ts`: `BUILT_IN_IDS`, and refuses a tab that still has items.
- Tests that render the code menu.

**Loyalty** (`lib/loyalty.ts`) keys on tab ids:
- One stamp per item: `signature`, `matcha-series`, `meal`.
- Half a stamp: `espresso`, `non-coffee`, `waffle`, `snack`.
- 10% off: `espresso`, `non-coffee`, `waffle`, `snack`.
- The stamp-11 **free drink** goes only on an item from `espresso` or `non-coffee` (`CLASSIC_DRINK_CATEGORY_IDS`). Both tabs are empty today, so no drink can be the free drink until the owner adds some. The owner is told this separately; this design doesn't change the rule.

The staff hints in `app/pos/CustomerNameField.tsx` and the `REWARDS_NEED_ITEMS` message in `lib/loyalty.ts` name tabs in fixed text ("Espresso, Non-Coffee, Waffle or Snack"). They already disagree with the "Classic" the POS shows.

Each sale line stores its own `categoryId`, `name` and `price`. Sales "Top items" groups lines by name and variant, not by item id.

**Item order today:**
- The POS's item query (`fetchPosMenuItems` in `lib/posMenu.ts`) has no `order()`, so Sanity returns items by `_id`, which is random.
- A newly added item is appended at the end of its tab on screen. After the next reload it jumps to wherever its random `_id` sorts. This is the "sequence changed suddenly" the owner reported.
- `/menu` sorts by name (`order(category asc, name asc)`).

**Add-ons:** only the `add-ons` tab's items attach to other items (`ADDON_CATEGORY_ID`), filtered by each add-on's `applicableCategories` (tab ids). `/menu` hides that one tab only.

## Design

### 1. Move the code tabs into Sanity once, before the new code ships

A script in the repo (for example `scripts/move-code-tabs-to-sanity.mjs`) does the move. It runs with `node --env-file=.env.local` and only with the owner's go-ahead, because it writes to the live menu. It uses `createIfNotExists` with fixed `_id`s, so a second run changes nothing. It prints what it created and what was already there.

**What it creates:** 6 `menuCategory` docs, one for each tab in `BUILT_IN_CATEGORIES`.
- Copy `id`, `label`, `type` and `order` from the code at run time, not from this document. The `espresso` tab must arrive as "Classic".
- Use `_id`s such as `menu-category-espresso`. The `_id`s must not contain a dot, because dotted ids are not publicly readable.

**What it does not create:** any item. There are no code items left, and every former code item was deleted by the owner and must not come back.

**Why it's safe before the deploy.** The live code ignores Sanity tabs whose id matches a code tab, so the POS and `/menu` look exactly the same between the move and the deploy.

**Rollout order:**
1. Run the move.
2. Read back the six docs.
3. Push the code. Vercel deploys it.

Shipping the code without the move would leave the POS without its six original tabs (an anti-goal).

### 2. Sanity is the only menu

- Delete `app/pos/menuData.ts` and `BUILT_IN_CATEGORIES`. The POS and `/menu` read tabs from `menuCategory` and items from `menuItem`, nothing else.
- **Tab order:** `menuSettings.categoryOrder` first. Tabs missing from it follow, by `order`. This is the same rule as today.
- **Drop the merge-only rules:** the name-based stand-in rule and the "Sanity item with a code name in the wrong tab" rule both go.
- **Items:** both sides read `available != false`. Today `/menu` reads `available == true`. An item whose tab doesn't exist shows nowhere.
- **`hiddenItemIds`:** no code reads it any more. The settings route's `hide`/`restore` action has no caller and is removed. Whether to clear the stored list is the builder's call; it's harmless either way.

### 3. One menu reader for both pages

- **The reader.** One server function returns the ordered tabs and the items. Both `/pos` and `/menu` use it, so they can't drift apart. Both read Sanity directly, not through the API CDN.
- **On `/pos`:**
  - Reads stay `no-store` behind the existing 3-second timeout, as today.
  - "Hide from POS" items stay hidden from ordering, shown dimmed with a badge in manager mode, as today.
- **On `/menu`:**
  - Drops the `add-ons` tab and tabs with no items, and includes "Hide from POS" items.
  - Hot/Iced comes from which prices exist, and the description falls back to the subtitle, as today.
- **Item order within a tab (G5):** the order items were added, oldest first, on both pages. The reader sorts by `_createdAt` ascending, then `_id` to break ties, for example `order(_createdAt asc, _id asc)`.
  - `_createdAt` never changes on edit, so editing keeps an item's place.
  - A newly added item shows last in its tab straight away (the POS already appends it) and stays last after a reload.
  - Existing items settle once into the order they were created in when this ships. That replaces both today's random POS order and `/menu`'s alphabetical order.

### 4. Editing in manager mode

**Items.** Every item card shows ✎ and ✕ in manager mode, since every item is now a Sanity doc. The add, edit and delete flows are otherwise unchanged.

**Tabs.** The dashed "+" at the end of the tab bar opens the category manager. It lists every tab, Add ons included, each with **Rename** and **Delete**. **Add Category** stays as it is.

**Rename:**
- The name is edited in place, with Save and Cancel.
- The name must be 1–40 characters, the same rule as adding a tab.
- Only `label` changes. The id stays, so these keep pointing at the tab:
  - its items
  - its loyalty rules
  - the Sales filter
  - add-ons' "Show for categories"
- The tab bar, `/menu`, Sales and the loyalty hints show the new name (section 7).

**Delete:**
- It asks first, naming the tab and its item count, for example "Delete Classic and its 3 items? This can't be undone." An empty tab asks "Delete Classic?".
- **When the tab carries a loyalty rule** (its id is in `lib/loyalty.ts`), the prompt adds one line saying so. For example: "Classic gives loyalty stamps and the free drink. A tab you add later won't, even with the same name." (my call; the wording is the builder's).
- One Sanity transaction deletes:
  - the tab doc
  - every item whose `category` is that id
  - that id in `categoryOrder`
- If the deleted tab is open on the POS, the POS moves to the first tab.
- **Deleting Add ons:** it is allowed. Add-ons then can't be attached until a tab with id `add-ons` exists again. Adding a tab named "Add ons" creates that id.

**Adding a tab** turns its name into an id ("Classic" → `classic`). Former code ids are no longer refused (today they get a 409), so re-adding "Espresso" creates `espresso` and its loyalty rules apply again. Re-adding "Classic" creates `classic`, which has no loyalty rule. The delete prompt above is what warns the owner.

### 5. `/menu` follows the POS

- **After every successful POS menu write,** its API route calls `revalidatePath('/menu')`. That covers:
  - item add, edit and delete
  - tab add, rename and delete
  - tab reorder
- **Fresh on the next visit:** `/menu` reads Sanity without the CDN, so the next visit renders from fresh data. The requirement: a refresh a few seconds after a POS save shows the change. If Next would serve one stale view first, the builder uses an immediate-expiry variant instead.
- **Backstop for Studio edits:** `/menu` also re-renders at most every 60 seconds (my call). Edits made in Sanity Studio, which don't go through these routes, still reach `/menu`.

### 6. When the POS can't read the menu

- **After each successful load,** the POS saves the menu on that tablet (`localStorage`).
- **If a load fails,** it shows that saved menu with an amber warning and the existing Reload button. The warning reads: "Could not load the live menu. Showing the last menu this tablet loaded; prices may be out of date."
- **If the tablet has no saved menu,** the grid is empty with a warning to reload.
- **Menu editing stays off** while a saved menu is showing, as with today's code-menu fallback.
- **Storage that fails or is blocked** must not break the POS: wrap every read and write.

### 7. Tab names in loyalty text, Sales and Studio

- **The staff hints in `CustomerNameField.tsx`** name tabs by their current labels, read from the menu the POS already has, instead of fixed text (my call). For example: "add a Classic or Non-Coffee drink". Which tabs each hint lists still comes from the loyalty rules in `lib/loyalty.ts`.
- **The `REWARDS_NEED_ITEMS` refusal from the sales route** does the same, from the shared reader. If the menu can't be read there, it falls back to generic wording without tab names; it must never block a sale it would otherwise accept.
- **Sales:** nothing changes for past sales, because lines carry their own names, prices and tab ids.
  - A deleted tab no longer gets a filter chip on Sales "Top items". Its past lines still count under All.
- **Studio:** the `menuItem.category` dropdown lists the six former code tabs. Making it match the real tabs, or making it a free text field, is the builder's call.

## Testing

**Vitest**, using the fake Sanity client already in `lib/testing/fakeSanityClient.ts`:
- **The shared reader:**
  - tab ordering, with tabs missing from `categoryOrder` placed last
  - items in the order they were added, the same on `/pos` and `/menu`
  - a just-added item last in its tab before and after a reload
- **Category rename (PATCH):** label validation; the id is unchanged.
- **Category delete:**
  - deletes the tab, its items and its `categoryOrder` entry in one transaction
  - the prompt counts the items
  - the loyalty line appears only for tabs with a rule
- **Category POST:** accepts former code ids.
- **`revalidatePath('/menu')`:** every menu write route calls it on success and never on failure.
- **POS render:** ✎/✕ on every item in manager mode; the category manager lists every tab with Rename and Delete; the saved-menu fallback.
- **Loyalty hints and the rewards refusal:** they use the current tab labels; the refusal falls back to generic text when the menu can't be read.
- **`/menu`:** built from the shared reader, without Add ons or empty tabs, with "Hide from POS" items.
- **The move script:**
  - it creates exactly the six tabs with their labels from the code (Classic for `espresso`) and no items
  - a second run changes nothing

**Manual check on localhost** after the move: localhost writes to the live dataset, so use a throwaway item and tab and delete them afterwards.

## Decisions

**The owner's:**
- Manager mode can delete anything, permanently, whatever created it.
- Tabs can be renamed.
- `/menu` must follow POS edits "real time". The owner left the exact speed open.
- These are deleted:
  - the four Espresso items
  - Chocolate Milk and Strawberry Milk (shipped in `888a809`)
- Espresso is shown as Classic (shipped in `888a809`).
- The owner approved the playback, including these guesses:
  - deleting a tab deletes its items after a warning with the count
  - "Hide from POS" items stay on `/menu`
- Items keep the order they were added in (added to the plan by the owner after the first review). Since `/menu` follows the POS, it uses that order too.

**Mine:**
- Move the code menu into Sanity, rather than keep it and record deletes and renames as overrides. Overrides would keep two sources and the merge rules that caused this bug. After `888a809`, the move is just the six tabs.
- Rename changes the label only; ids stay.
- `/menu` updates on the next open or refresh, within seconds, not live in open tabs.
- A 60-second backstop for Studio edits.
- Show the last menu the tablet loaded, instead of a menu in code.
- Add ons stay off `/menu`.
- Loyalty hints and the rewards refusal follow tab names.
- The delete prompt warns when a tab carries a loyalty rule.

## Left to the builder

- Where the shared reader lives and what things are named.
- The look of Rename and Delete in the category manager, matching the modal's current style.
- The exact wording of the loyalty line in the delete prompt.
- The exact `revalidatePath` freshness behaviour, as long as the G3 requirement holds.
- Whether to clear `hiddenItemIds` and how to treat the Studio dropdown.

## Noticed, not in scope

- **The "ADD ONS FOOD" tab** (`add-ons-food`) is an ordinary tab. On the POS its items (Bacon, Egg, Rice and so on) sell as standalone items. Only items in the `add-ons` tab attach to another item; with type Food they attach to food. Under G3 it also shows on `/menu` as a public "ADD ONS FOOD" tab.
- **No free drink right now.** Classic and Non-Coffee are empty, so no drink can be the stamp-11 free drink until the owner adds drinks to them, or asks for the rule to change (a separate request).
