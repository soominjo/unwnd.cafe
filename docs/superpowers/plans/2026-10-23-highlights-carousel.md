# Highlights Carousel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "life at unwnd." section on the home page: the owner's seven café photos in a strip that moves on by one photo every 2.5 seconds with a slow glide, like the owner's reference (three photos across on a wide screen, arrows at the sides).

**Architecture:** The photos are cropped to 4:5 (1200×1500) in `public/highlights/` and served through `next/image`. A small client component slides a track of the seven photos plus three copies of the first ones (so the loop never shows a gap), using a CSS transform transition. A server component holds the section's heading. The arithmetic (the strip, the silent jump back after the copies) is pure and tested on its own.

**Tech Stack:** Next.js 16 (`next/image`), React 19, Tailwind 4, Vitest (node environment, static markup).

**Spec:** The owner's message of 2026-10-23, with the reference image (a three-photo carousel with round arrows):
- "using these 7 images create and add a new place inside homepage … it is moving automatically with i think every 2.5 seconds with slowmo animation";
- "the sequence should be entrance1 inside1 cashier inside 2 outside 1 outside 2 outside 3";
- the owner confirmed which photo is which: the entrance is the driveway view.

## Global Constraints

- Order: driveway (entrance), mirror, order window (cashier), tables with gold lamps, covered patio from the garden, umbrellas with the two-storey building, big umbrella.
- It moves on every 2,500 ms, and each move glides for 1,200 ms.
- One photo across below 640 px, two to 1023 px, three from 1024 px. Photos are 4:5 and edge to edge, with no gaps.
- It must not slow the page: lazy images, no new dependency, and nothing animates while the section is off screen or the tab is hidden.
- Moving content needs a visible Pause (WCAG 2.2.2). It pauses on hover and keyboard focus, and doesn't move with reduced motion.

## Review Focus

1. Clicking the arrows fast, or during a glide, must never leave the strip between photos or on a copy.
2. Left of the first photo leads to the last one, and right of the last leads back to the first, without a visible jump.
3. A screen reader hears each photo once (the copies are hidden) and can stop the motion.
4. On a phone, swiping left or right moves it, and scrolling up and down still scrolls the page.
5. With reduced motion, nothing moves by itself and the arrows change the photo at once.

---

### Task 1: The strip arithmetic
**Files:** Create `components/highlights/carousel.ts` and `carousel.test.ts`.
**Produces:** `ADVANCE_EVERY_MS = 2500`, `SLIDE_MS = 1200` and `LOOP_COPIES = 3`; `loopStrip<T>(items)` gives `{ item, copy }[]`; `settle(position, count)` returns the same view among the real photos.
- [ ] The tests fail first; then implement; then they pass.

### Task 2: The section and the carousel
**Files:**
- Create `components/highlights/photos.ts`, `HighlightsCarousel.tsx`, `HighlightsSection.tsx` and `HighlightsSection.test.tsx`.
- Modify `app/page.tsx` and `app/page.test.tsx`: the section goes between About and the reviews.
- The 7 photos go in `public/highlights/` (cropped and resized from the originals).

Steps:
- [ ] **Failing tests:**
  - all seven photos render in the owner's order, with their descriptions;
  - three copies render, hidden from screen readers;
  - there are Previous, Next and "Pause the photos" buttons;
  - the heading reads "life at unwnd." with the brand word in `font-logo`;
  - the section sits between About and the reviews.
- [ ] **Implement:**
  - a timer that moves on every 2.5 s while playing, in view and not hovered or focused;
  - a lock during a glide, released by a timeout, not `transitionend`;
  - swipe through pointer events with `touch-action: pan-y`.
- [ ] **Check by eye:** at 393 and 1440 px, at the start and one step later.
