# Brand Font, POS on Phones and Moving Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every "unwnd" on the site and the POS in the brand font, the POS usable on an iPhone 16 (393 px), and the "kind words." reviews moving as a marquee that can carry all 62 Google reviews.

**Architecture:** The brand font becomes a self-hosted 9 KB subset of Noto Serif Display (condensed width 62.5, weight 800) loaded with `next/font/local`, replacing the 76 KB variable font every page preloads today; `font-logo` is then put on every brand word. The reviews section keeps its server-rendered header and gets a small client marquee (CSS transform animation, pause button, reduced-motion fallback to a swipe rail); a Takeout importer fills Studio with every review that has words. The POS is audited at true phone widths with Playwright against a scratch copy of the app (test PIN, dummy Sanity tokens, mocked APIs), and each screen that overflows or crowds is fixed with Tailwind breakpoints.

**Tech Stack:** Next.js 16.2.6 (App Router, `next/font`), React 19.2.3, TypeScript strict, Tailwind 4, Sanity 4.22 (`@sanity/client` for the importer), Vitest 4 (node environment, `react-dom/server` static markup), Playwright 1.63 from the npx cache (scratch only, not a dependency).

**Spec:** The prototype https://claude.ai/artifact/833UhfBmqsG9RLU3LPDjvH (its Plan tab: "Every unwnd uses the brand font: the logo, the hero, the footer, the name inside sentences, and the POS, Sales and login headers"; build order step 1 "One wordmark style for every unwnd"). The owner's ask on 2026-10-23: "proceed with refactoring the font design across different pages applying unwnd font, then make the /pos mobile web responsive experience since currently the other size like iphone 16 base is not yet responsive, then on google review make it marquee animated like its moving or sliding so it will show all 62 reviews not just 4".

## Global Constraints

- The brand font is the existing `font-logo` look: Noto Serif Display, width 62.5, weight 800, lowercase wordmark (`a1c1df2`). No new typeface.
- No page may download more font bytes than today; the subset must stay under 12 KB.
- Phones first: every POS screen works at 393 × 852 (iPhone 16) with no sideways scroll, and still at 360 px (small Android).
- No writes to Sanity while building or checking. The importer writes only on the owner's go-ahead, with `--write`.
- Reviews show first names only, word for word, never the owner's own review ("Gens Contreras").
- Moving content must have a visible pause control (WCAG 2.2.2) and must not move for `prefers-reduced-motion`.
- No commit or push until the owner says to ship. Then one commit per feature on `main` (see the unwnd git workflow).

## Review Focus

1. A very long review (400 characters) in the marquee: the card must not grow the whole row to a wall of text. Clamp the quote and step its size down.
2. Only one to three reviews published: the marquee must still fill a 1440 px screen with no gap at the loop seam.
3. A screen reader must hear each review once, not two or three times from the copies that make the loop seamless.
4. A long POS customer name or item name at 360 px must wrap or truncate, not push the order panel or a modal sideways.
5. A Takeout review whose text Google translated: keep the reviewer's own words, not "(Translated by Google)" text.

---

## Design

### What exists today (checked at `6026382`)

- **Fonts:** `app/layout.tsx` loads Geist, Cormorant Garamond, Poppins and `lib/fonts.ts`'s `Noto_Serif_Display` (variable, `wdth` axis). All five preload on every page, `/menu` and `/pos` included; Noto's Latin file is 76,348 bytes. So the old ruling that `/menu` avoids `font-logo` saves nothing; its test (`app/menu/page.test.tsx`, "stays off the brand display font") is now wrong.
- **Brand words already in `font-logo`:** hero `unwnd.cafe`, the address `unwnd. café`, the map badge, the reviews line, and the POS, Sales, login, Time clock and Manager headers.
- **Brand words still in Cormorant or Geist:** the Nav logo, the phone menu's footer line, the Footer logo and copyright line, two About sentences, the `/menu` kicker, and the photo-less menu card's `unwnd.` tile.
- **Reviews:** Studio holds rating 5, count 62 and 4 reviews (Angela, Sarah Jane, Jasper, Yves). Signed-out Google Maps shows only 5 reviews, so the other 58 need the owner's Google Takeout export ("Google Business Profile", JSON).
- **POS:** `app/pos/POSClient.tsx` header holds the wordmark, four icon buttons, Sales and Order; at 393 px it overflows once the Order button shows an item count.

### Decisions made for the owner (surface them in the final message)

1. **Brand font = brand word only.** Headings ("kind words.", "find us.", "the menu.") stay in Cormorant; only "unwnd" changes, as the owner asked on 2026-10-05 ("the brand word in the brand font").
2. **The font becomes a 9 KB subset** of the same face (Google Fonts `text=` subset, static at width 62.5 and weight 800): Latin letters, digits and `. , ' ’ & -` plus `é É`. Any other character falls back to Times New Roman. `scripts/fetch-wordmark-font.ts` re-creates it.
3. **The marquee:**
   - one row while there are fewer than 8 reviews, two rows in opposite directions from 8;
   - about 50 px a second, pausing on hover or keyboard focus, with a Pause button;
   - with reduced motion it does not move and becomes a swipe rail;
   - long quotes get smaller type and are clamped to 6 lines.
4. **Takeout import keeps** every review with words and 4 or 5 stars, first names only (the 4 already typed keep their names), and leaves out the owner's own review. The rating and count are recomputed from the export, and the newest review comes first.

### Found while building (2026-10-23)

- **Next's compiler (SWC) dropped a space.** In "<span>unwnd.</span> is exactly what it sounds like — …", a multi-line JSX text with an em dash on its first line, SWC drops the leading space. Vitest's transform keeps it, so only a screenshot caught it. Inline brand words are followed by `{' '}`.
- **The POS grid cut off prices on phones.** It scrolls inside a fixed-height area, and its cards hide overflow. Its `auto` rows were therefore sized to fit that height, not their content. On a phone this always happened; on a tablet it would in any long tab. `auto-rows-max` fixes it.
- **The header's words never fitted between 640 and about 830 px** (Time clock wrapped as "TIME / CLOCK"). Time clock, Manager and Loyalty now show as words from `lg` (1024 px, where the Order button gives way to the order panel), and as icons below.
- **`h-dvh` replaces `h-screen`** on the POS root, so iOS Safari's toolbar doesn't cover the bottom of the menu.
- **From the code review:**
  - The floating "View Order" pill hid the last row of every tab, so the grid keeps `pb-28` below 1024 px.
  - iPhone Safari zooms into any text field under 16 px, so every POS field is `max-sm:text-base`, and `app/pos/phoneFields.test.ts` reads all of them.
  - Classes glued to `${` never reach Tailwind's CSS, so the marquee's optional classes became plain strings.
  - In menu editing on a phone, the ✎ and × stack and names wrap whole words.
  - The importer refuses an empty write and warns about a lower review count or an unpublished Studio draft.
- **Lighthouse (mobile), Turbopack builds, HEAD against these changes, 3 runs each:**
  - fonts downloaded on every page went from 164 KB to 97 KB;
  - `/menu` median went from 88 to 92 (LCP 3.8 s to 3.4 s);
  - `/` went from 76 to 75, within its usual 71–80 noise.

### Out of scope

- Poppins and Cormorant loading (they serve the POS figures and headings).
- The home page's highlights and clips sections, and the Japanese-theme menu image (owner postponed).

## File Structure

- Create `scripts/fetch-wordmark-font.ts` (+ `.test.ts`): builds the Google Fonts subset URL, downloads the woff2.
- Create `app/fonts/NotoSerifDisplay-CondensedExtraBold-wordmark.woff2` and `app/fonts/OFL.txt` (the font's licence).
- Modify `lib/fonts.ts`: `next/font/local` instead of `next/font/google`.
- Modify `app/globals.css`: `font-logo` drops `font-stretch`; marquee keyframes appended at the end.
- Modify `components/Nav.tsx`, `components/Footer.tsx`, `app/page.tsx`, `app/menu/page.tsx`, `app/menu/MenuCard.tsx`: brand words in `font-logo`.
- Create `components/reviews/ReviewsMarquee.tsx` (+ test) and `components/reviews/marquee.ts` (+ test, pure row maths); modify `components/reviews/ReviewsSection.tsx` (+ test).
- Create `lib/googleReviewsImport.ts` (+ test) and `scripts/import-google-reviews.ts`.
- Modify POS screens found by the audit (Task 5).

---

### Task 1: The brand font as a 9 KB subset

**Files:**
- Create: `scripts/fetch-wordmark-font.ts`, `scripts/fetch-wordmark-font.test.ts`, `app/fonts/NotoSerifDisplay-CondensedExtraBold-wordmark.woff2`, `app/fonts/OFL.txt`
- Modify: `lib/fonts.ts`, `app/globals.css` (the `font-logo` utility)

**Interfaces:**
- Produces: `WORDMARK_GLYPHS: string`, `wordmarkCssUrl(glyphs: string): string`, `fontUrlFromCss(css: string): string | null`; `notoSerifDisplay` (same export name and CSS variable `--font-noto-serif-display`, so `app/layout.tsx` is unchanged).

- [ ] **Step 1: Write the failing tests** in `scripts/fetch-wordmark-font.test.ts`:
  - `wordmarkCssUrl('ab')` equals `https://fonts.googleapis.com/css2?family=Noto+Serif+Display:wdth,wght@62.5,800&text=ab`, and `WORDMARK_GLYPHS` contains every character of `unwnd.cafe`, `unwnd. café`, `unwnd. pos`, `unwnd. sales`, `unwnd. time clock`, `unwnd. manager`;
  - `fontUrlFromCss` returns the `url(...)` of a Google `@font-face` block and `null` for CSS without one;
  - the committed woff2 starts with the bytes `wOF2` and is under 12,000 bytes.
- [ ] **Step 2: Run** `npx vitest run scripts/fetch-wordmark-font.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement the script** (fetch the CSS with a Chrome user agent so Google answers with woff2, then the font) and run `node scripts/fetch-wordmark-font.ts`. Fetch `OFL.txt` from `https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifdisplay/OFL.txt`.
- [ ] **Step 4: Switch `lib/fonts.ts` to `localFont`** with `weight: '800'`, `style: 'normal'`, `display: 'swap'`, `adjustFontFallback: 'Times New Roman'`, `variable: '--font-noto-serif-display'`. Drop `font-stretch: 62.5%` from `font-logo` (the file is the condensed cut).
- [ ] **Step 5: Run** the test file, `npx tsc --noEmit` and a production build. Expected: PASS; the build's CSS has one `@font-face` for the wordmark.

### Task 2: Every brand word in the brand font

**Files:**
- Modify: `components/Nav.tsx` (logo, phone menu footer), `components/Footer.tsx` (logo, copyright), `app/page.tsx` (two About sentences), `app/menu/page.tsx` (kicker), `app/menu/MenuCard.tsx` (photo-less tile)
- Test: `components/Nav.test.tsx`, new `components/Footer.test.tsx`, `app/page.test.tsx`, `app/menu/page.test.tsx`

- [ ] **Step 1: Write the failing tests:**
  - Nav: the home link's class contains `font-logo` and its text is `unwnd`;
  - Footer: the home link has `font-logo`, and the copyright's `unwnd.` sits in a `font-logo` span;
  - home: both About sentences start with `<span class="font-logo">unwnd.</span>`;
  - menu: replace "stays off the brand display font" with "names the café in the brand font" (the kicker `<p>` has `font-logo`);
  - menu card: the photo-less tile's `unwnd.` has `font-logo`.
- [ ] **Step 2: Run** them. Expected: FAIL on each new assertion.
- [ ] **Step 3: Change the classes.** The Nav logo keeps `text-3xl`, so `--nav-h` stays 77 px. The phone menu footer becomes `font-logo text-lg lowercase text-cream/60`, no tracking. Inline brand words get `font-logo` alone. Remove the `/menu` "Cormorant, not font-logo" comment.
- [ ] **Step 4: Run** `npx vitest run`. Expected: all PASS. Then check `/`, `/menu` and `/pos/login` by eye at 393 px and 1440 px.

### Task 3: The reviews marquee

**Files:**
- Create: `components/reviews/marquee.ts`, `components/reviews/marquee.test.ts`, `components/reviews/ReviewsMarquee.tsx`, `components/reviews/ReviewsMarquee.test.tsx`
- Modify: `components/reviews/ReviewsSection.tsx`, `components/reviews/ReviewsSection.test.tsx`, `app/globals.css` (append only)

**Interfaces:**
- Consumes: `ShownReview` from `lib/googleReviews.ts`.
- Produces: `TWO_ROWS_FROM = 8`, `MIN_CARDS_PER_LOOP = 8`, `SECONDS_PER_CARD = 7`; `splitIntoRows<T>(items: T[]): T[][]`; `fillLoop<T>(row: T[]): { item: T; copy: number }[]`; `ReviewsMarquee({ reviews }: { reviews: ShownReview[] })`. `ReviewsSection`'s props do not change.

- [ ] **Step 1: Write the failing tests:**
  - `splitIntoRows`: 7 items give one row; 8 give two rows of even and odd indices;
  - `fillLoop`: 3 items give 9 entries (3 copies), 10 give 10 (1 copy);
  - marquee markup: each review's quote is announced once (exactly one card per review without `aria-hidden`), the track holds two identical halves, there is a button named "Pause the reviews", the duration is `cards × 7` seconds, and the second row runs in reverse;
  - section: the old "four in one row" and "swipe" tests are replaced by "shows every published review", e.g. 12 reviews give 12 announced cards.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The track is `w-max flex`, each card wrapped with right padding, not `gap`, so −50% is exactly one loop.
  - Keyframes `marquee` go to `translateX(-50%)`.
  - Hover, `focus-within` and the Pause button set `animation-play-state: paused`.
  - With `motion-reduce:` there is no animation, the copies are hidden and the row scrolls with snap.
  - The edges fade with `mask-image`.
  - Cards are 280, 320 and 360 px wide (phone, `sm`, `lg`). A quote over 110 characters drops from 1.32rem to 1.08rem, and every quote is clamped to 6 lines.
- [ ] **Step 4: Run** `npx vitest run components/reviews`. Expected: PASS. Then check by eye at 393 px and 1440 px, with and without reduced motion, and with 3 and 30 sample reviews.

### Task 4: Import all reviews from Google Takeout

**Files:**
- Create: `lib/googleReviewsImport.ts`, `lib/googleReviewsImport.test.ts`, `scripts/import-google-reviews.ts`

**Interfaces:**
- Produces: `parseTakeoutReviews(json: unknown): TakeoutReview[]` (`{ id, displayName, stars, text, createTime }`); `toStudioReviews(reviews: TakeoutReview[], existing: StudioReview[]): StudioReview[]`; `summarize(reviews: TakeoutReview[]): { rating: number; reviewCount: number }`.

- [ ] **Step 1: Write the failing tests:**
  - `starRating: "FIVE"` reads as 5;
  - a review without `comment` is counted but not shown;
  - "(Translated by Google) … (Original) …" keeps the original words;
  - "Gens Contreras" is left out;
  - an already-typed quote keeps its `_key` and name ("Sarah Jane");
  - new names are the first word;
  - text over 400 characters is cut at a word with "…";
  - dates become `YYYY-MM-DD`, newest first;
  - the rating is the mean to one decimal and the count includes star-only reviews.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement**, and add the script. It prints a dry-run table by default and patches `google-reviews` only with `--write`. Run it as `node --env-file=.env.local scripts/import-google-reviews.ts <folder or reviews.json> [--write]`.
- [ ] **Step 4: Run** the tests. Expected: PASS. Run the script on a fixture folder (dry run only).

### Task 5: POS phone audit and fixes

**Files:**
- Scratch only: the Playwright harness (a mirror of the app run with `next dev --webpack`, `POS_PIN` set to a test PIN, dummy Sanity tokens, `/api/*` GETs answered with fixtures, every non-GET aborted).
- Modify: the POS screens the audit flags. `app/pos/POSClient.tsx` (header) is known.

- [ ] **Step 1: Run the audit** at 360, 375, 393 and 430 px.
  - Screens: `/pos` empty and with items, the order drawer, the review modal, the item modal, the loyalty cards, the receipt preview, `/pos/sales` (each view), `/pos/timeclock` and `/pos/manager`.
  - Record any element wider than the viewport, and any tap target under 40 px.
  - Expected before the fixes: at least the `/pos` header overflows at 393 px.
- [ ] **Step 2: Fix each finding** with breakpoint classes. Phone-only changes go behind `max-sm:` or are undone at `sm:`, so the tablet layout stays as it is.
- [ ] **Step 3: Re-run the audit.** Expected: no element wider than the viewport on any screen at 360 to 430 px. Screenshots go to the owner.
- [ ] **Step 4: Run** `npx vitest run app/pos`. Expected: PASS. Update any test that pins a changed class.

### Task 6: Verify and hand over

- [ ] Run `npx tsc --noEmit -p tsconfig.json`, `npx vitest run`, `npx eslint` and `npx next build`. Expected: all green.
- [ ] Lighthouse (mobile), 3 runs each on `/` and `/menu` against a HEAD build, about 6 minutes. Say so before starting. Expected: no page worse than baseline.
- [ ] Get a fresh code review, then fix its critical and high findings.
- [ ] Show the owner, and commit and push only on their go-ahead: font, then reviews, then POS, each its own commit.
