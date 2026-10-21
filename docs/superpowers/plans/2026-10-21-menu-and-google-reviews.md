# Menu and Google Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the redesign prototype's photo menu and its Google reviews section on the live site.

**Architecture:** `/menu` keeps its server read (`readMenu` → `toPublicMenu`, re-rendered by every POS menu save) and gets a new client view:
- every category on one page;
- category chips that stay on screen and follow the scroll;
- a photo card or a plain card per item;
- a native `<dialog>` item sheet;
- a tray bar at the bottom of the screen.

Photos come straight from Sanity's image CDN through a `next/image` loader, with Sanity's `lqip` as the blurred preview. The home page reads one new Studio document, "Google reviews" (rating, count, chosen reviews), at most once a minute. It shows a rating pill in the hero and a "kind words." section between About and Find us. Neither appears until the owner publishes that document.

**Tech Stack:** Next.js 16.2.6 (App Router), React 19.2.3, TypeScript strict, Tailwind 4.2.1, Sanity 4.22.0 (Studio at `/studio`, `next-sanity` client), zustand cart store, Vitest 4 (node environment, `react-dom/server` static markup).

**Spec:** There is no separate spec file. The visual reference is the prototype at https://claude.ai/artifact/833UhfBmqsG9RLU3LPDjvH: its Menu page, its "kind words." section and its Plan tab. Where they differ, the Design section below wins. On 2026-10-21 the owner said "proceed with the plan applying the menu and google review first": leave out "life at unwnd." and "in motion.", and set the Japanese-theme image idea aside for now.

## Design

### What exists today (checked at `280e6c3`)

- **`/menu` today** (`app/menu/page.tsx`, static, `revalidate = 60`, refreshed by `revalidatePath('/menu')` on POS saves):
  - It reads `readMenu({ noStore: false })` → `toPublicMenu`.
  - It shows one category at a time, in a box with its own scroll.
  - Its tabs stick at 57 px, under the 77 px fixed Nav.
  - Adding an item opens the tray.
  - Lighthouse (mobile): performance 95, accessibility 93 (colour contrast, heading order).
- **The menu right now:** 40 items in 8 tabs: Signature, Classic, Matcha Series, Non-Coffee, Waffle, Starters, Meal, Add on food. No item has a photo. Some names end in "⭐". The "Add on food" tab (id `add-ons-food`) shows on `/menu` today, because only `add-ons` is hidden.
- **The home page** (`app/page.tsx`) is fully static. Lighthouse (mobile): performance 81, accessibility 96 (contrast in the footer).
- **The Google link:** `UNWND_SHOP.reviewUrl` in `lib/printer/shopDetails.ts`, the café's Google Maps link that the receipt prints as a QR code.
- **Sanity image field:** `menuItem.image` (with hotspot) already exists. `lib/posMenu.ts` already reads `image`, and the POS never shows it.

### Decisions made for the owner (surface them in the final message)

1. **Prototype picks for the open questions:**
   - wordmark stays lowercase, as today, in the existing `font-logo`;
   - menu cards in a grid: 2 across on phones, 3 from 640 px, 4 from 1024 px;
   - adding updates a bar at the bottom instead of opening the tray.
2. **Photo or plain card, per category.** A category shows photo cards once any of its items has a photo; there, an item still without one shows a quiet tile with "unwnd." in it. A category with no photos shows plain text cards. Today every category is plain.
3. **Every item opens the item sheet,** with or without a photo. It shows the full description and the ingredients ("What's in it", as today), plus Hot/Iced and "Add to tray · ₱price · Iced".
4. **One Studio page holds the reviews.** "Google reviews" is a single document (id `google-reviews`) with:
   - the Google rating, prefilled 5;
   - the number of reviews, prefilled 34 (the owner's 5 Oct figures);
   - the reviews to show (words, first name, month, stars), dragged into order.

   The site shows only what is published.
5. **The section and pill hide themselves.** The section appears once a rating or a review is published. The score shows only with a rating, and the cards only with reviews. The hero pill shows only with a rating.
6. **Both buttons open the café's Google Maps page** ("Read them on Google ↗" and "Leave a review ↗"), the same link as the receipt QR.
7. **The home page re-reads Sanity at most once a minute** (`revalidate = 60`), so a Studio publish shows within about a minute.
8. **Photos skip Vercel's image optimiser.** They are sized and converted by Sanity's CDN: a square crop around the hotspot, `auto=format`, quality 70.
9. **Out of scope:**
   - Nav and Footer: no "Reviews" link, since the section can be hidden;
   - the "Add on food" tab;
   - the "⭐" in names.

   Report the tab and the stars to the owner.

### Out of scope

- "life at unwnd." (highlights) and "in motion." (clips);
- Japanese-theme images;
- the open-now line;
- the tap-to-load map;
- brand font changes;
- the Tray panel's own look;
- any POS change.

## Global Constraints

- No new runtime dependencies; `lib/posMenu.ts` queries unchanged (the POS loads nothing new).
- New tokens in `app/globals.css`, in `:root` and mapped in `@theme inline` as `--color-*`:

  | Token | Value | Use |
  |---|---|---|
  | `--paper` | `#F4F1E8` | cards and sheets |
  | `--ink-2` | `#405446` | secondary text |
  | `--hair` | `rgba(0, 45, 6, .13)` | hairline borders |
  | `--hair-2` | `rgba(0, 45, 6, .28)` | stronger hairlines |
  | `--gold` | `#B8892C` | review stars |
  | `--photo` | `#DCD3C3` | photo placeholder |
  | `--added` | `#4E9F57` | the + button just after adding |
  | `--nav-h` | `77px` | the fixed Nav's measured height |

- Small informative text on `/menu` uses `text-ink-2`, never `text-muted` (sage fails contrast on cream). Eyebrows elsewhere keep `text-muted`, as the rest of the home page does.
- Prices are whole pesos, written "₱" + `toLocaleString('en-PH')` → "₱1,200".
- Motion only under `motion-safe:`; smooth scrolling only when `prefers-reduced-motion` is off.
- Review words are the owner's, typed in Studio; no code or seed data invents any.
- External links: `target="_blank" rel="noopener noreferrer"`.
- Commits:
  - one per feature at the end: Google reviews, then the menu;
  - conventional subject, body starting "Owner feedback.", trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  - commit and push only when the owner says so (a push to `main` deploys the live site).

## Review Focus

1. **Half-filled Studio document:** rating only, reviews only, a blank review, stars outside 1–5, quotation marks typed around the words. The section shows what makes sense and never breaks. Pinned in Task 1 (`toShownReviews` tests) and Task 2 (`ReviewsSection` tests).
2. **Sanity unreachable when a page regenerates:** the home page renders without the reviews, and the menu renders without blurred previews. Pinned in Task 1 (`loadGoogleReviews` error test) and Task 4 (`fetchPhotoPreviews` error test).
3. **A category part-way through getting photos:** even rows, with the placeholder tile where a photo is missing. Pinned in Task 3 (`withPhotos`) and Task 5 (`MenuCard` placeholder test).
4. **Hot-only, iced-only and food items:** the right default, label and price on the card and in the sheet. Pinned in Task 3 (`defaultTemp`, `priceFor`, `tempNote`) and Task 5 (`ItemSheet` food test).
5. **Long names in the 2-across phone grid** (e.g. "Sirloin Beef Tapa and Egg Rice Meal"): they wrap inside the card without widening the page. Checked in Task 7's 390 px screenshots and click-through (no horizontal scroll).

---

## File Structure

**Create:**

| File | What it holds |
|---|---|
| `sanity/singletons.ts` | `GOOGLE_REVIEWS_ID`, `SINGLETON_TYPES` (no imports, so Studio files and the app both use it) |
| `sanity/schemaTypes/googleReviews.ts` | the Studio "Google reviews" document |
| `lib/googleReviews.ts` (+ `.test.ts`) | types, the show rules, the reader |
| `components/reviews/Stars.tsx` | a row of five stars |
| `components/reviews/RatingPill.tsx` (+ test) | the hero pill |
| `components/reviews/ReviewsSection.tsx` (+ test) | "kind words." |
| `app/menu/menuView.ts` (+ test) | pure view rules: sections, temps, prices, labels |
| `app/menu/menuPhoto.ts` (+ test) | the Sanity `next/image` loader |
| `app/menu/photoPreviews.ts` (+ test) | the `lqip` read for `/menu` |
| `app/menu/TempToggle.tsx` | Hot/Iced switch or "Iced only" / "Hot only" note |
| `app/menu/MenuCard.tsx` (+ test) | one item card |
| `app/menu/CategoryChips.tsx` (+ test) | sticky category chips |
| `app/menu/TrayBar.tsx` (+ test) | the bottom tray bar |
| `app/menu/ItemSheet.tsx` (+ test) | the item `<dialog>` |
| `app/menu/MenuClient.test.tsx` | tests for the menu view |
| `app/menu/page.test.tsx` | tests for the `/menu` page |
| `app/page.test.tsx` | tests for the home page |

**Modify:**

| File | Change |
|---|---|
| `sanity/schemaTypes/index.ts` | register `googleReviews` |
| `sanity/structure.ts` | the "Google reviews" item |
| `sanity.config.ts` | the singleton's create menus and actions |
| `app/globals.css` | tokens and keyframes |
| `vitest.config.ts` | include `components/**/*.test.{ts,tsx}` |
| `app/page.tsx` | the reviews |
| `types/sanity.ts` | `lqip` |
| `app/menu/publicMenu.ts` (+ test) | the previews |
| `app/menu/MenuClient.tsx` | rewritten |
| `app/menu/page.tsx` | the new header and layout |

---

### Task 1: Google reviews in Studio, and the reader

**Files:**
- Create: `sanity/singletons.ts`, `sanity/schemaTypes/googleReviews.ts`, `lib/googleReviews.ts`, `lib/googleReviews.test.ts`
- Modify: `sanity/schemaTypes/index.ts`, `sanity/structure.ts`, `sanity.config.ts`

**Interfaces:**
- Produces:
  - `GOOGLE_REVIEWS_ID = 'google-reviews'` and `SINGLETON_TYPES: ReadonlySet<string>` (= `{'googleReviews'}`) from `@/sanity/singletons`.
  - From `@/lib/googleReviews`: `interface ShownReview { key: string; quote: string; name: string; month: string | null; stars: number }`
  - `interface ShownReviews { rating: number | null; count: number | null; reviews: ShownReview[] }`
  - `formatReviewMonth(date: string | null | undefined): string | null`
  - `toShownReviews(doc: GoogleReviewsDoc | null): ShownReviews | null`
  - `loadGoogleReviews(): Promise<ShownReviews | null>`

- [ ] **Step 1: Write the failing tests** in `lib/googleReviews.test.ts`. Mock with `vi.mock('@/sanity/lib/client', () => ({ client: { fetch } }))`, where `fetch = vi.fn()`.

```ts
it('turns a Studio date into month and year', () => {
  expect(formatReviewMonth('2026-10-05')).toBe('October 2026')
  expect(formatReviewMonth('2026-01-31')).toBe('January 2026')
})
it('gives no month for a missing or broken date', () => {
  for (const d of [null, undefined, '', '2026-13-01', 'soon']) expect(formatReviewMonth(d)).toBeNull()
})
it('keeps the rating to one decimal, with the count', () => {
  expect(toShownReviews({ rating: 4.86, reviewCount: 34, reviews: [] })).toEqual({ rating: 4.9, count: 34, reviews: [] })
})
it('drops a rating outside 1–5 and a count below 1', () => {
  expect(toShownReviews({ rating: 7, reviewCount: 0, reviews: [review] })).toMatchObject({ rating: null, count: null })
})
it('skips reviews without words or a name, trims, and strips quotation marks typed around the words', () => {
  const shown = toShownReviews({ reviews: [
    { _key: 'a', quote: '  “Great coffee!”  ', name: ' Ana ', date: '2026-10-05', stars: 5 },
    { _key: 'b', quote: '', name: 'Ben' }, { _key: 'c', quote: 'Nice', name: '  ' },
  ] })
  expect(shown?.reviews).toEqual([{ key: 'a', quote: 'Great coffee!', name: 'Ana', month: 'October 2026', stars: 5 }])
})
it('shows 5 stars unless the review has a whole number from 1 to 5', () => {
  // stars null → 5, 9 → 5, 4.5 → 5, 3 → 3
})
it('gives nothing to show without a rating or a review', () => {
  expect(toShownReviews(null)).toBeNull()
  expect(toShownReviews({})).toBeNull()
  expect(toShownReviews({ reviewCount: 34 })).toBeNull()
})
it('shows the section for a rating alone', () => {
  expect(toShownReviews({ rating: 5 })).toEqual({ rating: 5, count: null, reviews: [] })
})
it('reads the published Google reviews document by its id', async () => {
  fetch.mockResolvedValue({ rating: 5, reviewCount: 34, reviews: [] })
  expect(await loadGoogleReviews()).toEqual({ rating: 5, count: 34, reviews: [] })
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('_id == $id'), { id: 'google-reviews' })
})
it('gives nothing and logs when Sanity cannot be read, so the home page still renders', async () => {
  fetch.mockRejectedValue(new Error('offline'))
  expect(await loadGoogleReviews()).toBeNull()
  expect(consoleError).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run `npx vitest run lib/googleReviews.test.ts`.** Expected: FAIL, because the module does not exist yet.

- [ ] **Step 3: Implement `lib/googleReviews.ts`.**
  - `GoogleReviewsDoc` is `{ rating?, reviewCount?, reviews?: { _key, quote?, name?, date?, stars? }[] }`, with every value `| null`.
  - Query: `*[_id == $id][0]{ rating, reviewCount, reviews[]{ _key, quote, name, date, stars } }` through `client` (the CDN, which serves published documents only). On error, `console.error('Google reviews could not be loaded', error)` and return null.
  - Month: build it from the date parts with `Date.UTC`, then `Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })`. Reject a month outside 1–12.
  - Strip quotation marks with `/^["“”]+|["“”]+$/g` after trimming.
  - Count: a whole number ≥ 1, otherwise null.

- [ ] **Step 4: Run the test again.** Expected: PASS.

- [ ] **Step 5: Add the Studio document.**
  - In `sanity/singletons.ts`, set `GOOGLE_REVIEWS_ID = 'google-reviews'` and `SINGLETON_TYPES = new Set(['googleReviews'])`.
  - Create `sanity/schemaTypes/googleReviews.ts` (`name: 'googleReviews'`, title "Google reviews"), with these fields:

    | Field | Type | Title | Rules |
    |---|---|---|---|
    | `rating` | number | "Google rating" | min 1, max 5, precision 1, `initialValue: 5` |
    | `reviewCount` | number | "Number of reviews" | integer, min 0, `initialValue: 34` |
    | `reviews` | array of `googleReview` objects | "Reviews to show" | — |

    Each `googleReview` object has:

    | Field | Type | Title | Rules |
    |---|---|---|---|
    | `quote` | text, 3 rows | "Review" | required, max 400 |
    | `name` | string | "Reviewer's first name" | required, max 40 |
    | `date` | date, `dateFormat: 'MMMM YYYY'` | "Month of the review" | — |
    | `stars` | number | "Stars" | integer 1–5, `initialValue: 5` |

  - Field descriptions in plain words:
    - rating: "As Google Maps shows it, for example 4.9."
    - count: "Check Google Maps before publishing."
    - reviews: "Copy reviews you like from Google Maps, word for word. Drag to change the order."
  - Array preview: title `name`, subtitle `quote`. Document preview: "Google reviews".
  - Register the document in `sanity/schemaTypes/index.ts`.

- [ ] **Step 6: Make it one fixed page in Studio.**
  - `sanity/structure.ts`: a first list item "Google reviews" → `S.document().schemaType('googleReviews').documentId(GOOGLE_REVIEWS_ID)`, then `S.divider()`, then `S.documentTypeListItems()` without `SINGLETON_TYPES`.
  - `sanity.config.ts`, under `document`:
    - `newDocumentOptions` drops the singleton templates when `creationContext.type === 'global'`;
    - `actions` keeps only `publish`, `discardChanges` and `restore` for singleton types.
  - Use relative imports, as the Studio files do today.

- [ ] **Step 7: Run `npx tsc --noEmit -p tsconfig.json`.** Expected: no errors.

### Task 2: Hero rating pill and the "kind words." section

**Files:**
- Create: `components/reviews/Stars.tsx`, `components/reviews/RatingPill.tsx`, `components/reviews/RatingPill.test.tsx`, `components/reviews/ReviewsSection.tsx`, `components/reviews/ReviewsSection.test.tsx`, `app/page.test.tsx`
- Modify: `app/globals.css`, `vitest.config.ts`, `app/page.tsx`

**Interfaces:**
- Consumes: `ShownReviews` and `loadGoogleReviews` (Task 1), `UNWND_SHOP.reviewUrl`.
- Produces:
  - `Stars({ filled, label, className }: { filled: number; label?: string; className?: string })`: Math.round(filled) gold stars, then the rest at 25% opacity. With a `label`, it is `role="img"` with that `aria-label`; otherwise it is `aria-hidden`.
  - `RatingPill({ rating, count }: { rating: number; count: number | null })`
  - `ReviewsSection({ reviews, reviewUrl }: { reviews: ShownReviews; reviewUrl: string })`
  - The colour tokens and `--nav-h` from Global Constraints. Keyframes `sheet-up` (`from { transform: translateY(40px) }`) and `tray-pulse` (`40% { transform: scale(1.03) }`) in `app/globals.css`, for Task 5.

- [ ] **Step 1: Write the failing tests.**
  - Add `'components/**/*.test.{ts,tsx}'` to `vitest.config.ts`'s `include`.
  - Compare text with the tags stripped: `const text = (html: string) => html.replace(/<[^>]+>/g, '')`.

```tsx
// RatingPill.test.tsx
it('links to the reviews with the rating and the count', () => {
  const html = renderToStaticMarkup(<RatingPill rating={5} count={34} />)
  expect(html).toContain('href="#reviews"')
  expect(text(html)).toContain('5.0 on Google · 34 reviews')
})
it('says "1 review", and leaves the count out when it is unknown', () => {
  expect(text(renderToStaticMarkup(<RatingPill rating={4.9} count={1} />))).toContain('4.9 on Google · 1 review')
  expect(text(renderToStaticMarkup(<RatingPill rating={4.9} count={null} />))).not.toContain('·')
})

// ReviewsSection.test.tsx
const data = { rating: 5, count: 34, reviews: [
  { key: 'a', quote: 'Great coffee!', name: 'Ana', month: 'October 2026', stars: 5 },
  { key: 'b', quote: 'Lovely garden.', name: 'Ben', month: null, stars: 4 },
] }
const URL = 'https://maps.app.goo.gl/x'
it('shows the heading, the score and the count', () => {
  // id="reviews"; text has 'kind words.', '5.0', '34 reviews on Google'
})
it('shows each review in quotation marks with the name and month', () => {
  // text has '“Great coffee!”', 'Ana · October 2026'; 'Ben' without 'Ben ·'; html has 'aria-label="4 out of 5 stars"'
})
it('opens the café on Google Maps from both buttons, in a new tab', () => {
  // exactly 2 × `href="${URL}"`, each with target="_blank" rel="noopener noreferrer"; text has 'Read them on Google', 'Leave a review'
})
it('leaves out the score without a rating, and the cards without reviews', () => {
  // rating null, count null → no 'reviews on Google'; reviews [] → no '<figure'
})
it('offers swiping only when there is more than one review', () => {
  // one review → no 'Swipe for more'; two → 'Swipe for more'
})

// app/page.test.tsx — vi.mock('@/lib/googleReviews', () => ({ loadGoogleReviews })), then render await HomePage()
it('shows the pill and the section when reviews are published', () => {})   // 'href="#reviews"', 'id="reviews"'
it('shows neither when nothing is published', () => {})                     // loadGoogleReviews → null: no '#reviews', no 'kind words.'
```

- [ ] **Step 2: Run `npx vitest run components app/page.test.tsx`.** Expected: FAIL, because the modules do not exist yet.

- [ ] **Step 3: Implement.** Follow the prototype's look:
  - **Pill:** above the hero wordmark, delay 0.
    - Container: `rounded-full`, `border-cream/30`, `bg-cream/15`, `backdrop-blur`, text 12.5 px, stars `#E9C46A`.
    - Text: `<b>{rating.toFixed(1)}</b> on Google · N reviews`.
  - **Section:** `id="reviews"` with `scroll-mt-20`. It opens with the site's hairline (`border-t border-border mx-8 md:mx-16`), as Contact does.
    - Eyebrow "Google reviews" in `text-muted`.
    - h2 "kind words.", styled like "find us." (`font-serif lowercase tracking-tighter leading-none`, `clamp(2.5rem, 7vw, 5.5rem)`).
    - Score: Cormorant 64 px number, gold stars labelled "Rated 5.0 out of 5", and "34 reviews on Google" (or "on Google" without a count).
    - Sub-line: "What guests say after a night at <font-logo>unwnd.</font-logo>", plus "Swipe for more →" (`lg:hidden`) when there are 2 or more reviews.
  - **Rail** (a `ul` of `figure`s):
    - Phones: a horizontal snap scroll, cards 84% wide, `px-8 scroll-px-8`.
    - `sm`: cards 44% wide.
    - `lg`: 3 columns with no scroll.
    - Card: `bg-paper border-hair rounded-[14px]`; stars labelled "N out of 5 stars"; Cormorant italic 1.32rem quote in “ ”; figcaption "Name · Month" in `text-ink-2`.
  - **Buttons:** square, 46 px tall, 11.5 px uppercase with 0.2em tracking.
    - Dark: "Read them on Google ↗". Outline: "Leave a review ↗".
    - Each ends with `<span className="sr-only"> (opens Google Maps)</span>`.
  - **`app/page.tsx`:**
    - `export const revalidate = 60`;
    - `async`, with `const reviews = await loadGoogleReviews()`;
    - the pill when `reviews?.rating != null`;
    - the section between the About and Contact sections, when `reviews` is not null.

- [ ] **Step 4: Run the tests again.** Expected: PASS.

### Task 3: Menu view rules

**Files:**
- Create: `app/menu/menuView.ts`, `app/menu/menuView.test.ts`

**Interfaces:**
- Consumes: `SanityMenuItem` (`types/sanity.ts`; `drinkType` is `'both' | 'hot' | 'iced' | undefined`, from `toPublicMenu`).
- Produces:
  - `type Temp = 'Hot' | 'Iced'`
  - `interface MenuSection { id: string; label: string; items: SanityMenuItem[]; withPhotos: boolean }`
  - `menuSections(items: readonly SanityMenuItem[], categories: readonly { id: string; label: string }[]): MenuSection[]`
  - `defaultTemp(item): Temp | null`
  - `priceFor(item, temp: Temp | null): number`
  - `tempNote(item): string | null`
  - `formatPeso(amount: number): string`
  - `countLabel(n: number, word: string): string`

- [ ] **Step 1: Write the failing tests.**

```ts
it('lays the tabs out in the POS order, keeps item order, and leaves empty tabs out', () => {
  // categories [signature, espresso, waffle]; items [s1(signature), w1(waffle), s2(signature)]
  // → [{ id:'signature', items:[s1,s2] }, { id:'waffle', items:[w1] }]
})
it('shows photos in a tab as soon as one of its items has one', () => {
  // signature: one item with image → withPhotos true; waffle: none → false
})
it('starts a drink on Iced when it comes both ways, otherwise its only way; food has none', () => {
  // both→'Iced', hot→'Hot', iced→'Iced', undefined→null
})
it('prices by temperature, and food by its fixed price', () => {
  // { price:170, priceHot:170, priceIce:180, drinkType:'both' }: Hot→170, Iced→180; food { price:150 }: null→150
})
it('labels drinks that come one way only', () => {
  // iced→'Iced only', hot→'Hot only', both/food→null
})
it('writes pesos with thousands separators', () => {
  expect(formatPeso(170)).toBe('₱170'); expect(formatPeso(1200)).toBe('₱1,200')
})
it('counts in words', () => {
  expect(countLabel(1, 'item')).toBe('1 item'); expect(countLabel(40, 'item')).toBe('40 items')
})
```

- [ ] **Step 2: Run `npx vitest run app/menu/menuView.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement `app/menu/menuView.ts`.**
  - `priceFor`: Hot uses `priceHot ?? price`, Iced uses `priceIce ?? price`, and no temperature uses `price`.
  - `withPhotos`: true when `items.some((i) => i.image != null)`.
- [ ] **Step 4: Run the test again.** Expected: PASS.

### Task 4: Menu photos from Sanity

**Files:**
- Create: `app/menu/menuPhoto.ts` (+ `.test.ts`), `app/menu/photoPreviews.ts` (+ `.test.ts`)
- Modify: `types/sanity.ts`, `app/menu/publicMenu.ts`, `app/menu/publicMenu.test.ts`

**Interfaces:**
- Produces:
  - `SanityMenuItem.lqip?: string`
  - `toPublicMenu(menu, previews?: Readonly<Record<string, string>>): PublicMenu` (previews default `{}`)
  - `fetchPhotoPreviews(): Promise<Record<string, string>>`, which never throws
  - `PHOTO_QUALITY = 70`
  - `photoLoader(image: SanityImageSource): ImageLoader`
  - `photoSrc(image: SanityImageSource): string` (= the loader at width 600)

- [ ] **Step 1: Write the failing tests.**

```ts
// menuPhoto.test.ts — vi.hoisted sets NEXT_PUBLIC_SANITY_PROJECT_ID='proj', NEXT_PUBLIC_SANITY_DATASET='prod' before imports
const IMG = { asset: { _ref: 'image-abc123-800x600-jpg' } }
it('asks Sanity for a square crop at the width shown, in the best format', () => {
  const url = photoLoader(IMG)({ src: '', width: 480 })
  expect(url.startsWith('https://cdn.sanity.io/images/proj/prod/abc123-800x600.jpg?')).toBe(true)
  for (const p of ['w=480', 'h=480', 'fit=crop', 'auto=format', 'q=70']) expect(url).toContain(p)
})
it('uses the quality next/image passes', () => {
  expect(photoLoader(IMG)({ src: '', width: 480, quality: 50 })).toContain('q=50')
})

// photoPreviews.test.ts — vi.mock('@/sanity/lib/client', () => ({ client: { withConfig: () => ({ fetch }) } }))
it('maps each item with a photo to its blurred preview', async () => {
  fetch.mockResolvedValue([{ _id: 'a', lqip: 'data:a' }, { _id: 'b', lqip: null }])
  expect(await fetchPhotoPreviews()).toEqual({ a: 'data:a' })
})
it('gives no previews when Sanity cannot be read, so the menu still renders', async () => {
  fetch.mockRejectedValue(new Error('offline')); expect(await fetchPhotoPreviews()).toEqual({})
})

// publicMenu.test.ts
it('adds the blurred preview to items that have a photo', () => {
  // items a (image) and b (no image), previews { a:'data:a', b:'data:b' } → a.lqip 'data:a', b.lqip undefined
})
```

- [ ] **Step 2: Run `npx vitest run app/menu`.** Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - `photoLoader`: `urlFor(image).width(w).height(w).fit('crop').auto('format').quality(q ?? PHOTO_QUALITY).url()`.
  - `fetchPhotoPreviews` query: `*[_type == "menuItem" && available != false && defined(image.asset)]{ _id, "lqip": image.asset->metadata.lqip }`. It goes through `client.withConfig({ useCdn: false })`, as `readMenu` does, so a POS save shows at once. On error, `console.error('Menu photo previews could not be loaded', error)`.
- [ ] **Step 4: Run the tests again.** Expected: PASS.

### Task 5: Menu parts: card, chips, tray bar, item sheet

**Files:**
- Create: `app/menu/TempToggle.tsx`, `app/menu/MenuCard.tsx`, `app/menu/CategoryChips.tsx`, `app/menu/TrayBar.tsx`, `app/menu/ItemSheet.tsx`, and a `.test.tsx` beside each of the last four.

**Interfaces:**
- Consumes: Task 3 (`Temp`, `MenuSection`, `defaultTemp`, `priceFor`, `tempNote`, `formatPeso`, `countLabel`), Task 4 (`photoLoader`, `photoSrc`, `lqip`), tokens and keyframes (Task 2).
- Produces:
  - `TempToggle({ item, temp, onTemp, large }: { item: SanityMenuItem; temp: Temp | null; onTemp: (t: Temp) => void; large?: boolean })`
  - `MenuCard(props: { item: SanityMenuItem; withPhoto: boolean; temp: Temp | null; justAdded: boolean; onTemp: (t: Temp) => void; onAdd: () => void; onOpen: () => void })`
  - `CategoryChips({ sections, active, onPick }: { sections: readonly { id: string; label: string }[]; active: string; onPick: (id: string) => void })`
  - `TrayBar({ count, total, pulseKey, onOpen }: { count: number; total: number; pulseKey: number; onOpen: () => void })`
  - `ItemSheet(props: { item: SanityMenuItem | null; categoryLabel: string; temp: Temp | null; onTemp: (t: Temp) => void; onAdd: () => void; onClose: () => void })`

- [ ] **Step 1: Write the failing tests** (static markup; files that render photos set the Sanity env vars with `vi.hoisted`, as in Task 4).

```tsx
// MenuCard.test.tsx — latte = { _id:'l', name:'Seasalt Spanish Latte⭐', price:170, priceHot:170, priceIce:170, drinkType:'both', category:'signature', description:'Espresso · Milk' }
it('a plain card: no photo, the name, the words, Hot/Iced with Iced on, the price and +', () => {
  // no '<img'; has 'bg-paper'; 'Espresso · Milk'; Iced button aria-pressed="true", Hot "false"; '₱170'; aria-label="Add Seasalt Spanish Latte⭐ to the tray"
})
it('a photo card shows the Sanity photo and opens the item from it', () => {
  // with image: '<img', 'cdn.sanity.io', aria-label="See Seasalt Spanish Latte⭐"
})
it('keeps the photo spot with a quiet unwnd. tile while the photo is missing', () => {
  // withPhoto true, no image: no '<img', text has 'unwnd.'
})
it('notes one-way drinks and shows nothing for food', () => {
  // iced only → 'Iced only', no aria-pressed; food → neither
})
it('turns + into a tick just after adding', () => {
  // justAdded → 'bg-added'; aria-label unchanged
})

// CategoryChips.test.tsx
it('one chip per tab, only the current one marked', () => {
  // 2 sections, active 'espresso': two buttons; aria-current="true" once, on Classic
})

// TrayBar.test.tsx
it('stays hidden until the tray has something', () => { expect(renderToStaticMarkup(<TrayBar count={0} total={0} pulseKey={0} onOpen={noop} />)).toBe('') })
it('shows the count and the total', () => { /* text 'Your tray · 3 items' and '₱450 · View' */ })

// ItemSheet.test.tsx
it('renders an empty dialog when no item is open', () => { /* '<dialog' and no 'Add to tray' */ })
it('shows the item with its temperature in the add button', () => {
  // latte with ingredients ['Espresso','Milk'], temp 'Iced': title, 'Signature', 'What’s in it', 'Espresso', 'Add to tray · ₱170 · Iced'
})
it('adds food without a temperature', () => { /* food price 150 → 'Add to tray · ₱150' and no '· Iced' */ })
it('shows no photo area for an item without a photo', () => { /* no '<img' */ })
```

- [ ] **Step 2: Run `npx vitest run app/menu`.** Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** Use the prototype's sizes:
  - **Card:**
    - Photo button: square, `rounded-[10px]`, `bg-photo`. The image uses `next/image` with `fill`, `sizes="(min-width: 1024px) 280px, (min-width: 640px) 30vw, 45vw"`, `placeholder="blur"` when there is an `lqip`, and a 1.04 hover zoom under `motion-safe`.
    - Name: 15 px medium, a button that opens the sheet.
    - Description: 12.5 px light, `text-ink-2`, clamped to 2 lines.
    - Foot pinned to the bottom with `mt-auto`.
    - Price: 16 px medium, tabular figures.
    - +: 42 px, round, `bg-foreground`, turning `bg-added` with a tick.
    - The plain card wraps the body in `rounded-xl border-hair bg-paper p-3.5`.
    - Names wrap with `break-words` inside `min-w-0`.
  - **Toggle:**
    - Pill `border-hair-2 p-0.5`; buttons 28 px tall, 12 px text, the pressed one `bg-foreground text-cream`.
    - Large variant: 40 px tall, 13.5 px text.
    - Note: 12 px `text-ink-2`.
  - **Chips:**
    - Container: `<nav aria-label="Menu categories">`, `sticky top-[var(--nav-h)] z-30 bg-background border-b border-hair`.
    - The row scrolls sideways with its scrollbar hidden, padded 20/40/64 px, `lg:justify-center-safe`.
    - Chips: 38 px tall, rounded, `border-hair-2`, 13.5 px; the current one is filled green.
    - A change of `active` scrolls the row so that chip is in view (`scrollTo({ left: chip.offsetLeft - 20 })`).
  - **Tray bar:**
    - Position: `sticky bottom-0 z-20`, padding-bottom `calc(12px+env(safe-area-inset-bottom))`, over a cream fade.
    - Button: `max-w-[560px]`, 54 px tall, rounded, green; "Your tray · N items" on the left, bold "₱total · View" on the right.
    - It re-mounts on `pulseKey` with `motion-safe:animate-[tray-pulse_.45s_ease-out]`.
  - **Sheet:**
    - A `<dialog aria-labelledby>` that is always mounted. An effect calls `showModal()` when `item` is set (`setAttribute('open', '')` if `showModal` is missing) and `close()` when it is null.
    - The `close` event and a click on the backdrop (`e.target === dialog`) call `onClose`.
    - Phone: a bottom sheet, `max-w-[480px]`, `rounded-t-[22px]`, `max-h-[min(92svh,860px)]`, scrolling with `overscroll-contain`, `motion-safe:animate-[sheet-up_.32s_cubic-bezier(.2,.8,.2,1)]`, backdrop `rgba(0,22,5,.5)`.
    - From `sm`: centred and `rounded-2xl`. With a photo it is 900 px wide in two columns (square photo | info); without one it stays 480 px.
    - Close ✕: 42 px, round, top right, `autoFocus`.
    - Info: eyebrow (category), Cormorant 2.2rem title, description, "What's in it" chips, large toggle, and the add button (52 px, rounded, green) reading "Add to tray · ₱price" plus " · Iced"/" · Hot" when the item comes both ways.
- [ ] **Step 4: Run the tests again.** Expected: PASS.

### Task 6: The new /menu page

**Files:**
- Modify: `app/menu/MenuClient.tsx` (rewrite), `app/menu/page.tsx`
- Create: `app/menu/MenuClient.test.tsx`, `app/menu/page.test.tsx`

**Interfaces:**
- Consumes: Tasks 3 to 5; `useCartStore` (`addItem`, `openTray`, `items`, `totalPrice`).
- Produces: `MenuClient({ items, categories }: { items: SanityMenuItem[]; categories: { id: string; label: string }[] })`.

- [ ] **Step 1: Write the failing tests.**

```tsx
// MenuClient.test.tsx
it('puts every tab on one page in the POS order, as h2 sections with h3 items', () => {
  // ids 'cat-signature' before 'cat-waffle'; text 'signature.', '2 items'; '<h2' and '<h3' present
})
it('marks the first chip current', () => { /* first aria-current="true" belongs to Signature */ })
it('shows plain cards for a tab without photos and photo cards for a tab with one', () => {})
it('shows no tray bar while the tray is empty', () => { /* no 'Your tray' */ })

// page.test.tsx — vi.mock('@/lib/posMenu', readMenu) and vi.mock('./photoPreviews', fetchPhotoPreviews)
it('heads the page with the brand, the title and the item count', async () => {
  // text 'unwnd. café', 'the menu.', '40 items · prices in pesos' (40 public items)
})
it('says items are on their way when the menu is empty', async () => { /* 'Menu items are being added — check back soon.' */ })
it('passes the blurred previews through to the cards', async () => { /* item with image + preview → blurDataURL in the markup */ })
```

- [ ] **Step 2: Run `npx vitest run app/menu`.** Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
  - **`MenuClient` state:**
    - `temps: Record<string, Temp>`;
    - `openId: string | null`;
    - `active` (first section);
    - `justAdded: string | null` (cleared after 900 ms);
    - `pulseKey: number`;
    - `announcement: string` (an `sr-only` `aria-live="polite"` line).
  - **Adding:**
    - `addItem({ id, name, price: priceFor(item, temp), drinkType: item.drinkType ? temp ?? undefined : undefined })`;
    - announce "Added {name} ({temp}) to your tray." (no brackets for food);
    - no `openTray`.
    - The tray bar's button calls `openTray`.
  - **Scroll-spy:** an `IntersectionObserver` on the `section[data-cat]`s with `rootMargin: '-140px 0px -55% 0px'`.
  - **Chips:** a click scrolls `#cat-<id>` into view, smoothly unless reduced motion, and sets it active.
  - **Sections:**
    - Markup: `<section id="cat-<id>" data-cat aria-labelledby>` with `scroll-mt-[calc(var(--nav-h)+66px)]`.
    - Head: h2 `{label.toLowerCase()}.` (Cormorant 2.3rem) and a count in 12 px `text-ink-2`.
    - Grid: 2 columns on phones (gaps 24/12 px), 3 from `sm` (32/20), 4 from `lg` (40/24).
    - Content sits in a `max-w-[1240px]` wrapper with 20/40/64 px padding.
  - **End line:** "Prices are a guide. Please order and pay at the counter." (12.5 px `text-ink-2`), then the tray bar.
  - **`page.tsx`:**
    - `Promise.all([readMenu({ noStore: false }), fetchPhotoPreviews()])` → `toPublicMenu(menu, previews)`.
    - A green header, aligned with the same wrapper and padded `calc(var(--nav-h)+1.875rem)` on top and 34 px below:
      - kicker `font-logo` 15 px `text-cream/65` "unwnd. café";
      - h1 "the menu." (Cormorant 500, `clamp(3rem,15vw,6rem)`, leading 0.9);
      - meta 12 px uppercase, 0.16em tracking, `text-cream/60`: "{countLabel(n,'item')} · prices in pesos".
    - Keep the empty-menu message.
    - `main` loses its flex/overflow box, so the page scrolls normally.
- [ ] **Step 4: Run `npx vitest run`.** Expected: every test passes.

### Task 7: Check, measure, review

- [ ] **Step 1: Run `npx tsc --noEmit -p tsconfig.json`, `npm run lint` and `npx vitest run`.** Expected: no type errors, no new lint problems, all tests pass.
- [ ] **Step 2: Build a snapshot of the working tree.**
  - Use `git checkout-index` and `git ls-files -o --exclude-standard` copied in, with a `node_modules` junction.
  - Build with `npx next build --webpack` and `NEXT_PUBLIC_SANITY_*` set; serve with `next start -p 3101`.
  - In the snapshot only, make `loadGoogleReviews` return two sample reviews, so the section can be seen and measured.
  - Expected: the build passes; `/` is listed with "1m" revalidate.
- [ ] **Step 3: Take Playwright (Edge) screenshots** at 390×844 and 1280×800 of `/`, `/menu` and `/menu#cat-meal` (chips stuck under the Nav). Expected:
  - no horizontal scroll (`scrollWidth === innerWidth`);
  - chips flush under the Nav;
  - long names wrap.
- [ ] **Step 4: Click through in Playwright.** Expected:
  - **+ on a card:** the tray bar reads "Your tray · 1 item", the Tray panel stays closed, the tick shows;
  - **the name:** the dialog opens;
  - **"Add to tray · …":** the dialog closes and the count reaches 2;
  - **a chip:** that chip gets `aria-current="true"`;
  - **Esc:** closes the dialog.
- [ ] **Step 5: Run Lighthouse (mobile, 3 runs, median) on both pages.** Expected: compared with the baseline (`/` 81 performance and 96 accessibility, `/menu` 95 and 93), no category drops.
- [ ] **Step 6: Get a fresh review of the whole diff.** Fix what it confirms, then repeat Steps 1–5 if code changed.
- [ ] **Step 7: Report to the owner.** Cover the decisions above, the Studio steps ("Google reviews" page; menu item Image field), the before/after scores, the "Add on food" tab and "⭐" names, and ask whether to commit and push.
