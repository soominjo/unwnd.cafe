# Staff Time Clock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a Time clock page, staff tap Clock in or Clock out on their own name and confirm with their own PIN, and see only their own records there. The manager sees everyone's hours, fixes times, and sets staff PINs on a new Manager page behind the manager PIN.

**Architecture:**
- **Data.** Two new Sanity document types: `staffMember`, which holds the name and a keyed fingerprint of the PIN, and `timeShift`, one document per shift. Two people clocking in at once never write to the same document.
- **Server.** Server-only store functions check a PIN against the person tapped (inside the query, by fingerprint) and stamp every time with the server's clock. Small routes under `/api/timeclock`, all needing the POS session, wrap them.
- **POS header.** **Time clock** and **Manager** each open their own page, like Sales. Both ask first when an order is on screen.
- **Menu editing.** It moves behind the Manager page: Menu → Edit the menu returns to the POS with editing on.

**Tech Stack:** Next 16 App Router (pages and route handlers), React 19, Tailwind 4, Sanity through `next-sanity` (`ifRevisionId` for safe writes), Node `crypto` HMAC for PIN fingerprints, Vitest 4 in the node environment (components through `renderToStaticMarkup`).

**Spec:** the clickable prototype, version 3, at https://claude.ai/artifact/CrHwq9Ue3o8oVRNSmyLnvQ (awaiting the owner's review), written out under **Design** below. This revision (2026-10-16) replaces two earlier ones: one button per name with no PINs (2026-10-15), then one PIN pad for everyone (2026-10-16, version 2).

**How the code here was checked:** every code block was run in an exported copy of `733007a` before it was written down. There, these all passed:
- the full suite, 577 tests, of which 131 are new or changed;
- `tsc --noEmit`;
- eslint on every touched file;
- `next build`;
- the 8 jsdom click-throughs in the Appendix.

## Design

The owner's requests of 2026-10-16, with my picks where they left gaps:

- **POS header.** Time clock · Manager · Loyalty · Sales. Time clock and Manager now open their own pages, like Sales.
  - If the order on screen has items, both ask "Leave the POS? The order in progress will be cleared." with the browser's own confirm, like Reload.
  - Time clock keeps a green number for how many staff are on shift.
- **Time clock page (`/pos/timeclock`), no manager PIN.** It has two tabs.
  - **Clock in or out** lists everyone on the time clock, each name with one button.
    - **Clock in** opens a PIN pad for that person ("Enter your PIN to clock in."). Their own PIN clocks them in: the row turns green with "On shift since 9:58 AM" and a running timer, and the button becomes **Clock out**.
    - **Clock out** asks for their PIN again, then clocks them out.
    - Someone else's PIN on a name is refused ("Incorrect PIN"). Someone with no PIN yet has Clock in turned off, with "No PIN yet · ask the manager".
    - After each clock in or out, a line at the top says so for a few seconds: "John Reyes clocked in at 9:58 AM.", or "John Reyes clocked out at 6:02 PM · 8h 04m on this shift."
  - **My records** asks for the PIN, then shows only that person's status, running timer and shifts, for this week, last week, this month or last month.
    - The shifts are a plain timesheet, oldest first, one line each: **Monday, October 12 · 9:55 AM – 6:01 PM · 8h 06m**, with the total at the foot.
    - It is view only, with "Edited" marked on shifts a manager changed.
    - It closes on Done, after a minute without a tap, or when the screen goes off.
- **Two people arriving together.** One taps their name and enters their PIN, then the other does. Each shift is saved on its own, with the server's time.
- **A double tap, or a retry after a lost reply,** never undoes anything. Clock in for someone already on shift answers "already clocked in", and Clock out within a minute of their last clock-out answers "already clocked out".
- **Manager page (`/pos/manager`).** It opens with the manager PIN (the POS login PIN). It locks itself after two idle minutes or when the screen goes off, and with its Lock button. Its tabs:
  - **Hours:** everyone's totals and shifts for the period, Edit and Delete, a forgotten clock-out flagged at the top with **Set time out**, and "Over 16h · check" on long shifts.
  - **Staff:** add a name with a 4-digit PIN, change a PIN, remove someone (their records stay). A PIN can't be read back; a forgotten one is replaced.
  - **Menu:** **Edit the menu** returns to the POS with menu editing on, without asking the PIN again. While editing, the header's Manager button is the amber **Lock**, as today.
- **PINs.** 4 digits, one per person, never the manager PIN; they stay unique because My records finds a person by PIN alone. They are stored only as an HMAC fingerprint keyed by `STAFF_PIN_SECRET`, because the dataset is publicly readable and a plain hash of 4 digits is undone in a moment.
- **The manager's totals** stay as they are in version 2 (the owner's "always cap" was dropped on 2026-10-16).

**Open owner calls** (the prototype's "Your calls"). The plan builds my pick for each:

1. **Menu editing.** Manager → Menu → Edit the menu (built). The alternative is a separate Edit menu lock on the POS; that would keep `ManagerPinModal` instead of deleting it in Task 9.
2. **Leaving mid-order.** Asking first (built). The alternative is keeping the order across the visit, which is a larger change to `POSClient` state.
3. **Pay periods.** Weekly and monthly (built). For the 15th/30th cut-off, replace `month`/`lastmonth` in `lib/timeclock/time.ts` (`TIMECLOCK_PERIODS`, `PERIOD_LABELS`, `periodRange`) with 1st–15th and 16th–end.
4. **Privacy.** Names and hours sit in the publicly readable dataset (the open item from the 2026-10-02 security review), and the Manager page is locked on screen only. Fine for now (built), or fix that first?

## Global Constraints

- **New environment variable `STAFF_PIN_SECRET`:** at least 32 random characters, in `.env.local` and in Vercel (Production and Preview). Until it is set, the punch, My records and staff PIN routes answer 500 "Server misconfiguration". Changing it later makes every staff PIN stop working until it is set again.
- **Times:** stamped by the server (`new Date()` in `lib/timeclock/store.ts`), never sent by the tablet, and stored as UTC ISO strings from `toISOString()`. They are shown in Manila time (`Asia/Manila`, UTC+8) with the `en-PH` locale. Weeks run Monday to Sunday, as on Sales.
- **Staff PINs:**
  - exactly 4 digits (`STAFF_PIN_LENGTH`, the same as `PIN_LENGTH` in `app/pos/PinPad.tsx`);
  - unique among people on the time clock, and never `POS_PIN`;
  - stored only as `hashStaffPin(pin)` and never returned by any read;
  - sent only in POST or PATCH bodies, never in a URL.
- **Wrong PINs:** a PIN that isn't the tapped person's (or, on My records, isn't anyone's) answers **403**, never 401, because to the POS a 401 means its session ended. There is no attempt limit, the same as the POS PIN today.
- **Punching:**
  - The POS sends `{ staffId, action: 'in' | 'out', pin }`; the PIN is compared with that person's fingerprint inside the query.
  - One open shift per person.
  - A shift counts in the period, and on the day, that its time in falls in.
  - A repeat never undoes anything. Clock in for someone on shift answers with that shift (`repeat`). Clock out within `REPEAT_WINDOW_MS` (60 s) of their last clock-out answers with it; later, it is 409 "X is not clocked in."
- **A manager's edits:** the time out must come after the time in, neither more than 60 s in the future. The shift may be at most 16 h and may not overlap the same person's other shifts. Clocking out is never refused for length.
- **Staff names:** 2–60 characters of letters, digits, spaces and `. , ' ’ & ( ) -`, with at least one letter. Removing someone sets `active: false`, and their shifts keep `staffName`. Removing is refused while they are on shift.
- **Locks:**
  - The Manager page's PIN gate is on screen only (`verifyPosPin`); like the menu routes, the time clock routes accept any signed-in POS.
  - Manager mode and the Manager page lock after `MANAGER_IDLE_LOCK_MS` (2 min) or when the screen goes off.
  - My records closes after 60 s idle.
- **Routes:** every route calls `requirePosAuth()` first, and writes need `SANITY_API_WRITE_TOKEN`. Ids must match `^[A-Za-z0-9_-]{1,100}$`. Replies use `{ success, data?, error? }`. `proxy.ts` covers `/api/timeclock` and `/api/timeclock/(.+)`; `/pos/(.+)` already covers the two pages. A route file exports only handlers and route config; shared checks live in `lib/timeclock`.
- **UI copy:** plain sentences, `·` separators, and they/them for staff.
- **Tests:** Vitest in the node environment; components with `renderToStaticMarkup`. Route tests mock `@/lib/requirePosAuth` and `@/lib/timeclock/store` and stub `STAFF_PIN_SECRET` and `POS_PIN` (`'2468'`, never the real one). No new dependencies.
- **Editing existing files:** they are CRLF in the working tree, so change them with an editor or the Edit tool, not `sed`. Quote bracketed paths in git (`':(literal)app/api/timeclock/shifts/[id]/route.ts'`).
- **Commits:** none per task. This repo takes one conventional commit per feature, straight on `main`, made in Task 10 when the owner says to.

## Review Focus

1. **Two people clock in one right after the other.** Each taps their own name and enters their own PIN; each gets their own shift, and both buttons turn to Clock out. Pinned by the two-at-once store test (Task 3) and the first click-through in the Appendix.
2. **A double tap, or a retry after a lost reply.** Clock in again answers "already clocked in", Clock out again within a minute answers "already clocked out", and nothing is undone; with no reply at all, the pad says it is safe to enter the PIN again. Pinned by the repeat store tests (Task 3) and `punchLine` (Task 7).
3. **The wrong PIN.**
   - Someone else's PIN on a name gets 403 "Incorrect PIN".
   - When the manager sets a PIN, one someone else has gets 409 "Someone else has that PIN", and the manager PIN gets 400 "That's the manager PIN".
   - Pinned by `staffPinRefusal` (Task 2), the store's `wrong-pin` and `pin-taken` tests (Task 3), the route tests (Tasks 4 and 5) and three click-throughs.
4. **A clock-out forgotten across midnight.** Hours flags the shift at the top with Set time out, and marks shifts over 16 h. Clocking out still works. Pinned by `startedBeforeToday` and the Manila day and week edge tests (Tasks 1 and 2), and the ShiftRow and ShiftEditor tests (Task 8).
5. **Leaving the POS with an order on screen, and the menu hand-off.** Time clock and Manager ask first. The hand-off turns editing on for one page load within 30 s and never on first paint. Pinned by `openPosPage` and `takeMenuEditing` (Task 6), the POSClient first-paint tests (Task 9) and the hand-off click-throughs.

**Accepted limits** (by design, not covered by tests):

- There is no limit on wrong PIN attempts. With 4 digits and a few staff, someone at the tablet could find a PIN by trying. This is the same exposure as the POS PIN today.
- Two devices punching the *same* person within about 100 ms can both pass the "already on shift" read. With one tablet this is unlikely; the manager deletes the extra shift.
- The Manager page is locked on screen, not by the routes, the same as menu editing today.
- The running timers use the tablet's clock; the saved times use the server's.

## File map

| File | Responsibility |
|---|---|
| `lib/timeclock/time.ts` (new) | Manila days, weeks and periods; how times and hours are written |
| `lib/timeclock/rules.ts` (new) | Types; names, PINs, ranges, open shifts, manager edits, hours per person |
| `lib/timeclock/pins.ts` (new, server only) | PIN fingerprints (`STAFF_PIN_SECRET`), and which PINs a person may have |
| `lib/timeclock/store.ts` (new, server only) | Sanity reads and writes: punch, a person's own records, edits, staff and PINs |
| `sanity/schemaTypes/staffMember.ts`, `timeShift.ts` (new), `index.ts` | Studio schema |
| `app/api/timeclock/route.ts` (new) | `GET` the staff list, and everyone's shifts in a range |
| `app/api/timeclock/punch/route.ts`, `mine/route.ts` (new) | `POST` a name, an action and its PIN to clock in or out; `POST` a PIN for My records |
| `app/api/timeclock/shifts/[id]/route.ts` (new) | `PATCH` a manager's fix, `DELETE` a shift |
| `app/api/timeclock/staff/route.ts`, `staff/[id]/route.ts` (new) | `POST` a name and PIN; `PATCH` a PIN, `DELETE` (remove) a person |
| `proxy.ts` | The POS login check covers the time clock routes |
| `app/pos/timeclock/sendTimeClock.ts`, `latestOnly.ts`, `useNow.ts` (new) | Send a change, read the time clock or My records, keep the latest read, tick every second |
| `app/pos/navigation.ts`, `menuHandoff.ts` (new), `useIdleLock.ts` (new), `PageChrome.tsx` (new) | Leave the POS safely, hand menu editing over, lock when idle, page header and tabs |
| `app/pos/timeclock/page.tsx`, `TimeClockClient.tsx`, `ClockView.tsx`, `PinDialog.tsx`, `MyRecordsView.tsx`, `PadCard.tsx` (new) | The Time clock page: the staff list, a person's PIN, My records |
| `app/pos/manager/page.tsx`, `ManagerClient.tsx`, `RecordsView.tsx`, `ShiftEditor.tsx`, `StaffAdmin.tsx` (new) | The Manager page |
| `app/pos/POSClient.tsx`, `app/pos/sales/icons.tsx`; `app/pos/ManagerPinModal.tsx` (deleted) | The header's two page buttons, the hand-off, `ClockIcon`; the old PIN modal goes |

---

### Task 1: Manila time maths

**Files:**
- Create: `lib/timeclock/time.ts`
- Test: `lib/timeclock/time.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `TIMECLOCK_PERIODS`, `type TimeclockPeriod = 'week' | 'lastweek' | 'month' | 'lastmonth'`, `PERIOD_LABELS`, and `isTimeclockPeriod(value)`;
  - `type Instant = string | number`, `interface IsoRange { from: string; to: string }`, `manilaDayStart(ms)` and `manilaWeekStart(ms)`;
  - `periodRange(period, now): IsoRange`, `staffWeeksRange(now)` and `isInRange(at, range)`;
  - `manilaDayKey(at)`, which returns `'YYYY-MM-DD'`;
  - the writers `formatClock`, `formatClockSeconds`, `formatDay`, `formatLongDay`, `formatSince(at, now)`, `formatEnd(clockOut, clockIn)`, `formatHours(ms)` and `formatTimer(ms)`;
  - `toManilaInput(at)` and `fromManilaInput(value): string | null`, for `datetime-local` fields.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import {
  formatClock,
  formatDay,
  formatEnd,
  formatHours,
  formatLongDay,
  formatSince,
  formatTimer,
  fromManilaInput,
  isInRange,
  isTimeclockPeriod,
  manilaDayKey,
  manilaWeekStart,
  periodRange,
  staffWeeksRange,
  toManilaInput,
} from './time'

const at = (iso: string) => Date.parse(iso)
const NOW = at('2026-10-15T15:00:00Z') // Thu, Oct 15, 2026, 11:00 PM in Manila

describe('weeks and periods, in Manila time', () => {
  it('starts the week on Monday 12:00 AM Manila, which is Sunday 4:00 PM UTC', () => {
    expect(new Date(manilaWeekStart(NOW)).toISOString()).toBe('2026-10-11T16:00:00.000Z')
  })

  it('puts Monday 12:30 AM Manila in the new week, though it is still Sunday in UTC', () => {
    expect(new Date(manilaWeekStart(at('2026-10-18T16:30:00Z'))).toISOString()).toBe('2026-10-18T16:00:00.000Z')
  })

  it('keeps Sunday 11:59 PM Manila in the old week', () => {
    expect(new Date(manilaWeekStart(at('2026-10-18T15:59:00Z'))).toISOString()).toBe('2026-10-11T16:00:00.000Z')
  })

  it('gives this week, last week, this month and last month as UTC ranges', () => {
    expect(periodRange('week', NOW)).toEqual({ from: '2026-10-11T16:00:00.000Z', to: '2026-10-18T16:00:00.000Z' })
    expect(periodRange('lastweek', NOW)).toEqual({ from: '2026-10-04T16:00:00.000Z', to: '2026-10-11T16:00:00.000Z' })
    expect(periodRange('month', NOW)).toEqual({ from: '2026-09-30T16:00:00.000Z', to: '2026-10-31T16:00:00.000Z' })
    expect(periodRange('lastmonth', NOW)).toEqual({ from: '2026-08-31T16:00:00.000Z', to: '2026-09-30T16:00:00.000Z' })
  })

  it('counts Nov 1, 12:10 AM Manila as November, not October', () => {
    expect(periodRange('month', at('2026-10-31T16:10:00Z')).from).toBe('2026-10-31T16:00:00.000Z')
  })

  it('reads last week and this week for the Staff tab', () => {
    expect(staffWeeksRange(NOW)).toEqual({ from: '2026-10-04T16:00:00.000Z', to: '2026-10-18T16:00:00.000Z' })
  })

  it('takes a range from inclusive to exclusive', () => {
    const week = periodRange('week', NOW)
    expect(isInRange('2026-10-11T16:00:00.000Z', week)).toBe(true)
    expect(isInRange('2026-10-18T16:00:00.000Z', week)).toBe(false)
  })

  it('knows its four periods', () => {
    expect(isTimeclockPeriod('lastmonth')).toBe(true)
    expect(isTimeclockPeriod('year')).toBe(false)
  })
})

describe('days and times as staff read them', () => {
  it('names the Manila day an instant falls on', () => {
    expect(manilaDayKey('2026-10-15T15:59:00Z')).toBe('2026-10-15')
    expect(manilaDayKey('2026-10-15T16:00:00Z')).toBe('2026-10-16')
    expect(manilaDayKey(NOW)).toBe('2026-10-15')
  })

  it('writes times and days the way the POS does', () => {
    expect(formatClock('2026-10-15T01:58:00Z')).toBe('9:58 AM')
    expect(formatDay('2026-10-15T01:58:00Z')).toBe('Thu, Oct 15')
    expect(formatLongDay('2026-10-15T01:58:00Z')).toBe('Thursday, October 15')
  })

  it('says when a shift began: today, yesterday, or an earlier day', () => {
    expect(formatSince('2026-10-15T01:58:00Z', NOW)).toBe('9:58 AM')
    expect(formatSince('2026-10-14T01:51:00Z', NOW)).toBe('yesterday, 9:51 AM')
    expect(formatSince('2026-10-13T01:51:00Z', NOW)).toBe('Tue, Oct 13, 9:51 AM')
  })

  it('adds the day to a time out on a later day than the time in', () => {
    expect(formatEnd('2026-10-15T10:03:00Z', '2026-10-15T01:51:00Z')).toBe('6:03 PM')
    expect(formatEnd('2026-10-15T16:30:00Z', '2026-10-15T10:00:00Z')).toBe('Fri, Oct 16, 12:30 AM')
  })

  it('writes hours as hours and minutes, rounded down to the minute', () => {
    expect(formatHours(8 * 3600e3 + 4 * 60e3 + 59e3)).toBe('8h 04m')
    expect(formatHours(42 * 60e3)).toBe('42m')
    expect(formatHours(-5)).toBe('0m')
  })

  it('runs the timer in hours, minutes and seconds, past 24 hours too', () => {
    expect(formatTimer(2 * 3600e3 + 14 * 60e3 + 5e3)).toBe('2:14:05')
    expect(formatTimer(26 * 3600e3)).toBe('26:00:00')
  })
})

describe('the date and time fields of the shift editor', () => {
  it('shows an instant in Manila time and reads it back', () => {
    expect(toManilaInput('2026-10-15T01:58:00.000Z')).toBe('2026-10-15T09:58')
    expect(fromManilaInput('2026-10-15T09:58')).toBe('2026-10-15T01:58:00.000Z')
    expect(fromManilaInput('2026-10-15T09:58:30')).toBe('2026-10-15T01:58:00.000Z')
  })

  it('refuses a value that is not a whole, real date and time', () => {
    expect(fromManilaInput('')).toBeNull()
    expect(fromManilaInput('2026-10-15')).toBeNull()
    expect(fromManilaInput('2026-02-30T09:00')).toBeNull()
    expect(fromManilaInput('2026-10-15T24:00')).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run lib/timeclock/time.test.ts`
Expected: FAIL. `Failed to resolve import "./time"`.

- [ ] **Step 3: Write the implementation**

```ts
// Time clock times: stored as UTC instants (ISO strings), read and grouped in Manila time
// (UTC+8, no daylight saving). Weeks run Monday to Sunday, the same as on Sales.

export const MANILA_TIME_ZONE = 'Asia/Manila'
const OFFSET_MS = 8 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export const TIMECLOCK_PERIODS = ['week', 'lastweek', 'month', 'lastmonth'] as const
export type TimeclockPeriod = (typeof TIMECLOCK_PERIODS)[number]

export const PERIOD_LABELS: Record<TimeclockPeriod, string> = {
  week: 'This week',
  lastweek: 'Last week',
  month: 'This month',
  lastmonth: 'Last month',
}

/** An instant: an ISO string as stored, or epoch milliseconds such as Date.now(). */
export type Instant = string | number

/** From (inclusive) and to (exclusive), as UTC ISO strings for the API. */
export interface IsoRange {
  from: string
  to: string
}

const toMs = (at: Instant): number => (typeof at === 'number' ? at : Date.parse(at))
const iso = (ms: number): string => new Date(ms).toISOString()
// An instant shifted so that its UTC fields read as Manila wall-clock time, and back.
const toWall = (ms: number): Date => new Date(ms + OFFSET_MS)
const fromWall = (wallMs: number): number => wallMs - OFFSET_MS

/** The Manila midnight that starts the day `ms` falls on. */
export function manilaDayStart(ms: number): number {
  const wall = toWall(ms)
  return fromWall(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()))
}

/** Monday 12:00 AM, Manila time, of the week `ms` falls in. */
export function manilaWeekStart(ms: number): number {
  const sinceMonday = (toWall(ms).getUTCDay() + 6) % 7
  return manilaDayStart(ms) - sinceMonday * DAY_MS
}

function manilaMonthStart(ms: number, monthsAway: number): number {
  const wall = toWall(ms)
  return fromWall(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth() + monthsAway, 1))
}

export function isTimeclockPeriod(value: string): value is TimeclockPeriod {
  return (TIMECLOCK_PERIODS as readonly string[]).includes(value)
}

/** The shifts Records shows for a period: those whose time in falls inside it. */
export function periodRange(period: TimeclockPeriod, now: number): IsoRange {
  const week = manilaWeekStart(now)
  switch (period) {
    case 'week':
      return { from: iso(week), to: iso(week + 7 * DAY_MS) }
    case 'lastweek':
      return { from: iso(week - 7 * DAY_MS), to: iso(week) }
    case 'month':
      return { from: iso(manilaMonthStart(now, 0)), to: iso(manilaMonthStart(now, 1)) }
    case 'lastmonth':
      return { from: iso(manilaMonthStart(now, -1)), to: iso(manilaMonthStart(now, 0)) }
  }
}

/** What the Staff tab reads: last week and this week, for each person's "This week" and last week's total. */
export function staffWeeksRange(now: number): IsoRange {
  const week = manilaWeekStart(now)
  return { from: iso(week - 7 * DAY_MS), to: iso(week + 7 * DAY_MS) }
}

export function isInRange(at: Instant, range: IsoRange): boolean {
  const ms = toMs(at)
  return ms >= Date.parse(range.from) && ms < Date.parse(range.to)
}

/** "2026-10-15": the Manila calendar day an instant falls on. Sorts like the days it names. */
export function manilaDayKey(at: Instant): string {
  return toWall(toMs(at)).toISOString().slice(0, 10)
}

function format(at: Instant, options: Intl.DateTimeFormatOptions): string {
  return new Date(toMs(at)).toLocaleString('en-PH', { timeZone: MANILA_TIME_ZONE, ...options })
}

/** "9:58 AM" */
export const formatClock = (at: Instant): string => format(at, { hour: 'numeric', minute: '2-digit' })

/** "9:58:12 AM": the clock at the top of the Staff tab. */
export const formatClockSeconds = (at: Instant): string => format(at, { hour: 'numeric', minute: '2-digit', second: '2-digit' })

/** "Thu, Oct 15" */
export const formatDay = (at: Instant): string => format(at, { weekday: 'short', month: 'short', day: 'numeric' })

/** "Thursday, October 15" */
export const formatLongDay = (at: Instant): string => format(at, { weekday: 'long', month: 'long', day: 'numeric' })

/** When a shift began, the way a person says it: "9:58 AM" today, "yesterday, 9:51 AM", else "Tue, Oct 13, 9:51 AM". */
export function formatSince(at: Instant, now: number): string {
  const day = manilaDayKey(at)
  if (day === manilaDayKey(now)) return formatClock(at)
  if (day === manilaDayKey(now - DAY_MS)) return `yesterday, ${formatClock(at)}`
  return `${formatDay(at)}, ${formatClock(at)}`
}

/** A shift's end: the time alone, or with the day when the shift ended on a later day than it began. */
export function formatEnd(clockOut: Instant, clockIn: Instant): string {
  return manilaDayKey(clockOut) === manilaDayKey(clockIn) ? formatClock(clockOut) : `${formatDay(clockOut)}, ${formatClock(clockOut)}`
}

/** "8h 04m", or "42m" under an hour: whole minutes, rounded down. */
export function formatHours(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / 60000))
  const hours = Math.floor(minutes / 60)
  return hours > 0 ? `${hours}h ${String(minutes % 60).padStart(2, '0')}m` : `${minutes}m`
}

/** "2:14:05": the running timer of a shift. */
export function formatTimer(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const mm = String(Math.floor(seconds / 60) % 60).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${Math.floor(seconds / 3600)}:${mm}:${ss}`
}

/** "2026-10-15T09:58": an instant as a datetime-local input shows it, in Manila time. */
export function toManilaInput(at: Instant): string {
  return toWall(toMs(at)).toISOString().slice(0, 16)
}

const INPUT_VALUE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/

/** The instant a datetime-local value means in Manila (seconds dropped), or null when it is not a whole, real date and time. */
export function fromManilaInput(value: string): string | null {
  const match = INPUT_VALUE.exec(value)
  if (!match) return null
  const [year, month, day, hour, minute] = match.slice(1, 6).map(Number)
  const wall = new Date(Date.UTC(year, month - 1, day, hour, minute))
  // Date.UTC rolls an impossible value (Feb 30, 24:00) into the next day: refuse it instead.
  if (wall.getUTCMonth() !== month - 1 || wall.getUTCDate() !== day || wall.getUTCHours() !== hour || wall.getUTCMinutes() !== minute) return null
  return iso(fromWall(wall.getTime()))
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run lib/timeclock/time.test.ts`
Expected: PASS, 16 tests.

### Task 2: Rules, and PIN fingerprints

**Files:**
- Create: `lib/timeclock/rules.ts`, `lib/timeclock/pins.ts`
- Test: `lib/timeclock/rules.test.ts`, `lib/timeclock/pins.test.ts`

**Interfaces:**
- Consumes: `formatClock`, `formatDay`, `manilaDayKey` and `IsoRange` (Task 1); `PIN_LENGTH` from `app/pos/PinPad.tsx` (test only).
- Produces, from `rules.ts`:
  - **Types:**
    - `ClockAction = 'in' | 'out'`;
    - `OpenShift { _id; clockIn }`;
    - `BoardRow { staffId; name; hasPin: boolean; openShift: OpenShift | null }`;
    - `TimeShift { _id; staffId; staffName; clockIn; clockOut: string | null; editedAt: string | null }`;
    - `ShiftTimes`;
    - `MyHours { name; openShift; shifts: TimeShift[] }`;
    - `StaffTotal`.
  - **Constants:** `MAX_SHIFT_MS`, `FUTURE_SLACK_MS`, `MAX_RANGE_MS`, `MIN/MAX_STAFF_NAME_LENGTH` and `STAFF_PIN_LENGTH`.
  - **Checks for routes:** `isDocId`, `readInstant` and `readRange(from, to): IsoRange | null`.
  - **PINs:** `isStaffPin` and `staffPinProblem(pin)`.
  - **Names:** `cleanStaffName` and `staffNameProblem`.
  - **Shifts:** `shiftMs`, `countOnShift`, `startedBeforeToday` and `shiftTimesProblem`.
  - **Hours:** `totalsByStaff` and `groupByDay`.
- Produces, from `pins.ts` (server only): `MIN_PIN_SECRET_LENGTH`, `hasStaffPinSecret(secret?)`, `staffPinRefusal(pin, managerPin?)` and `hashStaffPin(pin, secret?)`.

- [ ] **Step 1: Write the failing tests**

`lib/timeclock/rules.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { PIN_LENGTH } from '@/app/pos/PinPad'
import {
  MAX_SHIFT_MS,
  STAFF_PIN_LENGTH,
  cleanStaffName,
  countOnShift,
  groupByDay,
  isDocId,
  isStaffPin,
  readInstant,
  readRange,
  shiftMs,
  shiftTimesProblem,
  staffNameProblem,
  staffPinProblem,
  startedBeforeToday,
  totalsByStaff,
  type TimeShift,
} from './rules'

const NOW = Date.parse('2026-10-15T15:00:00Z') // Thu, Oct 15, 11:00 PM in Manila

const shift = (id: string, staffId: string, clockIn: string, clockOut: string | null, staffName = staffId): TimeShift => ({
  _id: id, staffId, staffName, clockIn, clockOut, editedAt: null,
})

describe('what the routes accept', () => {
  it('takes document ids the POS creates, never a draft or a path', () => {
    expect(isDocId('kq3Fz9_x-1')).toBe(true)
    expect(isDocId('drafts.john')).toBe(false)
    expect(isDocId('../sales')).toBe(false)
    expect(isDocId(42)).toBe(false)
  })

  it('reads a UTC instant and stores it the way toISOString writes it', () => {
    expect(readInstant('2026-10-15T01:58Z')).toBe('2026-10-15T01:58:00.000Z')
    expect(readInstant('2026-10-15T01:58:00.000Z')).toBe('2026-10-15T01:58:00.000Z')
    expect(readInstant('2026-10-15T09:58:00+08:00')).toBeNull()
    expect(readInstant('2026-10-15T25:00:00Z')).toBeNull()
    expect(readInstant(null)).toBeNull()
  })

  it('reads a range of at most two months, from before to', () => {
    expect(readRange('2026-10-11T16:00:00Z', '2026-10-18T16:00:00Z')).toEqual({ from: '2026-10-11T16:00:00.000Z', to: '2026-10-18T16:00:00.000Z' })
    expect(readRange('2026-10-18T16:00:00Z', '2026-10-11T16:00:00Z')).toBeNull()
    expect(readRange('2026-01-01T00:00:00Z', '2026-10-01T00:00:00Z')).toBeNull()
    expect(readRange('2026-10-11', '2026-10-18')).toBeNull()
    expect(readRange(undefined, '2026-10-18T16:00:00Z')).toBeNull()
  })
})

describe('staff PINs', () => {
  it('are as long as the POS PIN pad takes', () => {
    expect(STAFF_PIN_LENGTH).toBe(PIN_LENGTH)
  })

  it('are exactly four digits', () => {
    expect(isStaffPin('0427')).toBe(true)
    expect(staffPinProblem('0427')).toBeNull()
    for (const pin of ['427', '04271', '04a7', ' 0427', '']) expect(staffPinProblem(pin)).toBe('A PIN is 4 digits.')
    expect(isStaffPin(427)).toBe(false)
  })
})

describe('staff names', () => {
  it('saves a name trimmed, with single spaces', () => {
    expect(cleanStaffName('  John   Reyes ')).toBe('John Reyes')
  })

  it('takes 2 to 60 letters, numbers and simple punctuation, with at least one letter', () => {
    expect(staffNameProblem('Ana Cruz')).toBeNull()
    expect(staffNameProblem("Ma. Lourdes O'Neil-Santos")).toBeNull()
    expect(staffNameProblem('A')).toBe('Enter a name: 2 to 60 characters.')
    expect(staffNameProblem('x'.repeat(61))).toBe('Enter a name: 2 to 60 characters.')
    expect(staffNameProblem('John ←')).toBe('Use letters, numbers and simple punctuation only.')
    expect(staffNameProblem('123')).toBe('Use letters, numbers and simple punctuation only.')
  })
})

describe('who is on shift, and for how long', () => {
  it('counts an open shift up to now and a closed one to its time out', () => {
    expect(shiftMs({ clockIn: '2026-10-15T13:00:00Z', clockOut: null }, NOW)).toBe(2 * 3600e3)
    expect(shiftMs({ clockIn: '2026-10-15T01:00:00Z', clockOut: '2026-10-15T09:04:00Z' }, NOW)).toBe(8 * 3600e3 + 4 * 60e3)
  })

  it('counts the people on shift, for the header', () => {
    expect(countOnShift([
      { staffId: 'a', name: 'Ana Cruz', hasPin: true, openShift: { _id: 's1', clockIn: '2026-10-15T13:00:00Z' } },
      { staffId: 'j', name: 'John Reyes', hasPin: true, openShift: null },
    ])).toBe(1)
  })

  it('flags a shift begun on an earlier Manila day as a forgotten clock-out', () => {
    expect(startedBeforeToday('2026-10-14T01:51:00Z', NOW)).toBe(true)
    // 12:30 AM in Manila today is still today, though it was yesterday in UTC.
    expect(startedBeforeToday('2026-10-14T16:30:00Z', NOW)).toBe(false)
  })
})

describe('what a manager can set a shift to', () => {
  const open = { wasOpen: true, now: NOW, others: [] }
  const closed = { wasOpen: false, now: NOW, others: [] }

  it('takes an ordinary shift, and an open one left open', () => {
    expect(shiftTimesProblem({ clockIn: '2026-10-15T01:00:00Z', clockOut: '2026-10-15T09:00:00Z' }, closed)).toBeNull()
    expect(shiftTimesProblem({ clockIn: '2026-10-15T13:00:00Z', clockOut: null }, open)).toBeNull()
  })

  it('needs a time out on a shift that was already closed', () => {
    expect(shiftTimesProblem({ clockIn: '2026-10-15T01:00:00Z', clockOut: null }, closed)).toBe('Enter the time out.')
  })

  it('refuses times out of order, in the future, or more than 16 hours apart', () => {
    expect(shiftTimesProblem({ clockIn: '2026-10-15T09:00:00Z', clockOut: '2026-10-15T09:00:00Z' }, closed)).toBe('Time out must be after time in.')
    expect(shiftTimesProblem({ clockIn: '2026-10-15T16:00:00Z', clockOut: '2026-10-15T17:00:00Z' }, closed)).toBe("Time in can't be in the future.")
    expect(shiftTimesProblem({ clockIn: '2026-10-15T14:00:00Z', clockOut: '2026-10-15T15:30:00Z' }, closed)).toBe("Time out can't be in the future.")
    const longOut = new Date(Date.parse('2026-10-14T01:00:00Z') + MAX_SHIFT_MS + 60e3).toISOString()
    expect(shiftTimesProblem({ clockIn: '2026-10-14T01:00:00Z', clockOut: longOut }, closed)).toBe('A shift can be 16 hours at most. Check the dates.')
  })

  it('lets the tablet’s clock run up to a minute ahead of the server’s', () => {
    expect(shiftTimesProblem({ clockIn: '2026-10-15T14:00:00Z', clockOut: '2026-10-15T15:00:30Z' }, closed)).toBeNull()
  })

  it('refuses a shift that overlaps another of the same person’s, but not one that starts as it ends', () => {
    const others = [{ clockIn: '2026-10-14T23:38:00Z', clockOut: '2026-10-15T07:52:00Z' }]
    expect(shiftTimesProblem({ clockIn: '2026-10-15T07:00:00Z', clockOut: '2026-10-15T10:00:00Z' }, { ...closed, others }))
      .toBe('That overlaps their shift from Thu, Oct 15, 7:38 AM.')
    expect(shiftTimesProblem({ clockIn: '2026-10-15T07:52:00Z', clockOut: '2026-10-15T10:00:00Z' }, { ...closed, others })).toBeNull()
  })

  it('counts an open shift of theirs as running until now', () => {
    const others = [{ clockIn: '2026-10-15T13:00:00Z', clockOut: null }]
    expect(shiftTimesProblem({ clockIn: '2026-10-15T12:00:00Z', clockOut: '2026-10-15T14:00:00Z' }, { ...closed, others }))
      .toBe('That overlaps their shift from Thu, Oct 15, 9:00 PM.')
  })

  it('refuses a time in that is not a date', () => {
    expect(shiftTimesProblem({ clockIn: 'soon', clockOut: '2026-10-15T09:00:00Z' }, closed)).toBe('Enter the time in.')
  })
})

describe('hours per person', () => {
  const staff = [{ staffId: 'g', name: 'Genessis Contreras' }, { staffId: 'j', name: 'John Reyes' }]

  it('adds up each person’s shifts, the open one up to now, in the order of the staff list', () => {
    const totals = totalsByStaff([
      shift('1', 'j', '2026-10-15T13:00:00Z', null),
      shift('2', 'j', '2026-10-14T23:43:00Z', '2026-10-15T07:46:00Z'),
      shift('3', 'g', '2026-10-15T01:51:00Z', '2026-10-15T10:03:00Z'),
    ], staff, NOW)
    expect(totals).toEqual([
      { staffId: 'g', name: 'Genessis Contreras', ms: 8 * 3600e3 + 12 * 60e3, count: 1, openSince: null },
      { staffId: 'j', name: 'John Reyes', ms: 10 * 3600e3 + 3 * 60e3, count: 2, openSince: '2026-10-15T13:00:00Z' },
    ])
  })

  it('lists someone removed who has shifts in the period, under the name they clocked in with', () => {
    const totals = totalsByStaff([shift('4', 'gone', '2026-10-13T04:00:00Z', '2026-10-13T13:00:00Z', 'Ana Cruz')], staff, NOW)
    expect(totals.map(total => [total.name, total.count])).toEqual([['Genessis Contreras', 0], ['John Reyes', 0], ['Ana Cruz', 1]])
  })

  it('groups shifts by the Manila day they began on', () => {
    const days = groupByDay([
      shift('1', 'j', '2026-10-15T13:00:00Z', null),
      shift('2', 'g', '2026-10-14T16:30:00Z', '2026-10-15T01:00:00Z'),
      shift('3', 'g', '2026-10-14T01:51:00Z', '2026-10-14T10:03:00Z'),
    ])
    expect(days.map(day => [day.day, day.shifts.map(s => s._id)])).toEqual([['2026-10-15', ['1', '2']], ['2026-10-14', ['3']]])
  })
})
```

`lib/timeclock/pins.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { hasStaffPinSecret, hashStaffPin, staffPinRefusal } from './pins'

const SECRET = 'test-secret-that-is-long-enough-1234'
const OTHER = 'another-secret-that-is-long-enough-99'

describe('hashStaffPin', () => {
  it('gives the same fingerprint for the same PIN, so a PIN finds its owner', () => {
    expect(hashStaffPin('0427', SECRET)).toBe(hashStaffPin('0427', SECRET))
    expect(hashStaffPin('0427', SECRET)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashStaffPin('0428', SECRET)).not.toBe(hashStaffPin('0427', SECRET))
  })

  it('needs the secret: not a plain hash anyone could reverse from the public dataset', () => {
    expect(hashStaffPin('0427', SECRET)).not.toBe(hashStaffPin('0427', OTHER))
    expect(hashStaffPin('0427', SECRET)).not.toBe(createHash('sha256').update('0427').digest('hex'))
  })

  it('takes four digits that are not the manager PIN', () => {
    expect(staffPinRefusal('3333', '2468')).toBeNull()
    expect(staffPinRefusal('2468', '2468')).toBe("That's the manager PIN. Choose another.")
    expect(staffPinRefusal('33', '2468')).toBe('A PIN is 4 digits.')
    expect(staffPinRefusal(3333, '2468')).toBe('A PIN is 4 digits.')
  })

  it('refuses to work without a long enough secret', () => {
    expect(hasStaffPinSecret(undefined)).toBe(false)
    expect(hasStaffPinSecret('short')).toBe(false)
    expect(hasStaffPinSecret(SECRET)).toBe(true)
    expect(() => hashStaffPin('0427', 'short')).toThrow('STAFF_PIN_SECRET must be set')
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run lib/timeclock`
Expected: FAIL. `Failed to resolve import "./rules"` and `"./pins"`.

- [ ] **Step 3: Write `lib/timeclock/rules.ts`**

```ts
import { formatClock, formatDay, manilaDayKey, type IsoRange } from './time'

// The time clock's rules, shared by the POS and the server: staff names and PINs, who is on
// shift, what a manager may change a shift to, and how the hours add up.

/** The longest shift a manager can save. A forgotten clock-out can run longer; Records flags it. */
export const MAX_SHIFT_MS = 16 * 60 * 60 * 1000
/** A time this far past the server's clock still counts as now: the tablet's clock may run a little ahead. */
export const FUTURE_SLACK_MS = 60 * 1000
/** The longest range one read covers: two months, enough for This month and Last month. */
export const MAX_RANGE_MS = 62 * 24 * 60 * 60 * 1000
export const MIN_STAFF_NAME_LENGTH = 2
export const MAX_STAFF_NAME_LENGTH = 60
/** As many digits as the POS's own PIN pad takes (PIN_LENGTH in app/pos/PinPad.tsx). */
export const STAFF_PIN_LENGTH = 4
// Letters (any script), accents, digits, spaces and . , ' ’ & ( ) - only, like loyalty card names.
const STAFF_NAME_CHARACTERS = /^[\p{L}\p{M}\p{N} .,'’&()-]+$/u
const HAS_LETTER = /\p{L}/u
const STAFF_PIN = new RegExp(String.raw`^\d{${STAFF_PIN_LENGTH}}$`)
/** A Sanity document id as the POS creates them: never a draft ("drafts.") or a path. */
const DOC_ID = /^[A-Za-z0-9_-]{1,100}$/
/** A UTC instant, as toISOString() writes it (seconds and milliseconds optional). */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/

export type ClockAction = 'in' | 'out'

export interface OpenShift {
  _id: string
  clockIn: string
}

/** One person on the time clock, and the shift they are on, if any. */
export interface BoardRow {
  staffId: string
  name: string
  /** A PIN is set, so they can clock in. The PIN itself never leaves the server. */
  hasPin: boolean
  openShift: OpenShift | null
}

export interface TimeShift {
  _id: string
  staffId: string
  /** Their name when they clocked in, so the record keeps it after they are removed. */
  staffName: string
  clockIn: string
  /** null while they are on shift. */
  clockOut: string | null
  /** When a manager last changed the shift, or null. Staff see it as "Edited". */
  editedAt: string | null
}

/** A shift's times as a manager sets them. */
export interface ShiftTimes {
  clockIn: string
  clockOut: string | null
}

/** What a staff member sees under My records: their own shifts only. */
export interface MyHours {
  name: string
  openShift: OpenShift | null
  shifts: TimeShift[]
}

export interface StaffTotal {
  staffId: string
  name: string
  ms: number
  count: number
  /** When their open shift began, if one of the shifts counted is still open. */
  openSince: string | null
}

export function isDocId(value: unknown): value is string {
  return typeof value === 'string' && DOC_ID.test(value)
}

/** A UTC instant as it is stored (toISOString), or null when the value is not one. */
export function readInstant(value: unknown): string | null {
  if (typeof value !== 'string' || !ISO_INSTANT.test(value)) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

/** A from/to pair of UTC instants, at most MAX_RANGE_MS apart, as stored; null when either is wrong. */
export function readRange(from: unknown, to: unknown): IsoRange | null {
  const start = readInstant(from)
  const end = readInstant(to)
  if (start === null || end === null) return null
  const span = Date.parse(end) - Date.parse(start)
  return span > 0 && span <= MAX_RANGE_MS ? { from: start, to: end } : null
}

export function isStaffPin(value: unknown): value is string {
  return typeof value === 'string' && STAFF_PIN.test(value)
}

/** Why a PIN can't be a staff PIN, or null when it can. Whether it is taken is the server's to say. */
export function staffPinProblem(pin: string): string | null {
  return isStaffPin(pin) ? null : `A PIN is ${STAFF_PIN_LENGTH} digits.`
}

/** A staff name as it is saved: trimmed, with single spaces. */
export function cleanStaffName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/** Why a name can't go on the time clock, or null when it can. */
export function staffNameProblem(raw: string): string | null {
  const name = cleanStaffName(raw)
  if (name.length < MIN_STAFF_NAME_LENGTH || name.length > MAX_STAFF_NAME_LENGTH) {
    return `Enter a name: ${MIN_STAFF_NAME_LENGTH} to ${MAX_STAFF_NAME_LENGTH} characters.`
  }
  if (!STAFF_NAME_CHARACTERS.test(name) || !HAS_LETTER.test(name)) return 'Use letters, numbers and simple punctuation only.'
  return null
}

/** How long a shift lasted, or has lasted so far while it is open. */
export function shiftMs(shift: Pick<TimeShift, 'clockIn' | 'clockOut'>, now: number): number {
  const end = shift.clockOut === null ? now : Date.parse(shift.clockOut)
  return Math.max(0, end - Date.parse(shift.clockIn))
}

export function countOnShift(rows: BoardRow[]): number {
  return rows.filter(row => row.openShift !== null).length
}

/** Clocked in on an earlier Manila day and still on shift: most likely a forgotten clock-out. */
export function startedBeforeToday(clockIn: string, now: number): boolean {
  return manilaDayKey(clockIn) < manilaDayKey(now)
}

/**
 * Why a manager can't save these times on a shift, or null when they can. `wasOpen` says the
 * shift is still on (it may stay open); `others` are the same person's shifts that could overlap.
 */
export function shiftTimesProblem(
  times: ShiftTimes,
  { wasOpen, now, others }: { wasOpen: boolean; now: number; others: Pick<TimeShift, 'clockIn' | 'clockOut'>[] },
): string | null {
  const start = Date.parse(times.clockIn)
  if (Number.isNaN(start)) return 'Enter the time in.'
  if (times.clockOut === null && !wasOpen) return 'Enter the time out.'
  const end = times.clockOut === null ? now : Date.parse(times.clockOut)
  if (Number.isNaN(end)) return 'Enter the time out.'
  if (start > now + FUTURE_SLACK_MS) return "Time in can't be in the future."
  if (end > now + FUTURE_SLACK_MS) return "Time out can't be in the future."
  if (end <= start) return 'Time out must be after time in.'
  if (end - start > MAX_SHIFT_MS) return 'A shift can be 16 hours at most. Check the dates.'
  const clash = others.find(other => Date.parse(other.clockIn) < end && start < (other.clockOut === null ? now : Date.parse(other.clockOut)))
  if (clash) return `That overlaps their shift from ${formatDay(clash.clockIn)}, ${formatClock(clash.clockIn)}.`
  return null
}

/** Hours per person: everyone in `staff`, in that order, then anyone else with shifts (removed since). */
export function totalsByStaff(shifts: TimeShift[], staff: Pick<BoardRow, 'staffId' | 'name'>[], now: number): StaffTotal[] {
  const empty = (staffId: string, name: string): StaffTotal => ({ staffId, name, ms: 0, count: 0, openSince: null })
  const totals = new Map<string, StaffTotal>(staff.map(person => [person.staffId, empty(person.staffId, person.name)]))
  for (const shift of shifts) {
    const current = totals.get(shift.staffId) ?? empty(shift.staffId, shift.staffName)
    totals.set(shift.staffId, {
      ...current,
      ms: current.ms + shiftMs(shift, now),
      count: current.count + 1,
      openSince: shift.clockOut === null ? shift.clockIn : current.openSince,
    })
  }
  return [...totals.values()]
}

/** Shifts, newest first as the API sends them, grouped by the Manila day they began on. */
export function groupByDay(shifts: TimeShift[]): { day: string; shifts: TimeShift[] }[] {
  return shifts.reduce<{ day: string; shifts: TimeShift[] }[]>((days, shift) => {
    const day = manilaDayKey(shift.clockIn)
    const last = days[days.length - 1]
    return last && last.day === day
      ? [...days.slice(0, -1), { day, shifts: [...last.shifts, shift] }]
      : [...days, { day, shifts: [shift] }]
  }, [])
}
```

- [ ] **Step 4: Write `lib/timeclock/pins.ts`**

```ts
import { createHmac } from 'crypto'
import { staffPinProblem } from './rules'

// Server only. Staff PINs are stored as a keyed fingerprint, never as digits. The dataset can be
// read by anyone with the project ID, and a 4-digit PIN has only 10,000 values, so a plain hash
// would be undone in a moment; this one can't be checked without STAFF_PIN_SECRET.

/** The shortest STAFF_PIN_SECRET accepted. */
export const MIN_PIN_SECRET_LENGTH = 32

/** Whether STAFF_PIN_SECRET is set. Until it is, the PIN routes answer "Server misconfiguration". */
export function hasStaffPinSecret(secret: string | undefined = process.env.STAFF_PIN_SECRET): boolean {
  return typeof secret === 'string' && secret.length >= MIN_PIN_SECRET_LENGTH
}

/**
 * Why `pin` can't be someone's PIN on this POS, or null when it can: four digits, and not the
 * manager PIN (POS_PIN), which would open the Manager page. Whether another person has it is
 * the store's to say.
 */
export function staffPinRefusal(pin: unknown, managerPin: string | undefined = process.env.POS_PIN): string | null {
  const problem = staffPinProblem(typeof pin === 'string' ? pin : '')
  if (problem) return problem
  return pin === managerPin ? "That's the manager PIN. Choose another." : null
}

/** A staff PIN's fingerprint: the same PIN always gives the same one, so a PIN finds its owner. */
export function hashStaffPin(pin: string, secret: string | undefined = process.env.STAFF_PIN_SECRET): string {
  if (!hasStaffPinSecret(secret)) throw new Error(`STAFF_PIN_SECRET must be set, at least ${MIN_PIN_SECRET_LENGTH} characters`)
  return createHmac('sha256', secret as string).update(`unwnd-staff-pin:${pin}`).digest('hex')
}
```

- [ ] **Step 5: Run them to see them pass**

Run: `npx vitest run lib/timeclock`
Expected: PASS, 40 tests across three files.

### Task 3: Sanity schema and the store

**Files:**
- Create: `sanity/schemaTypes/staffMember.ts`, `sanity/schemaTypes/timeShift.ts`, `lib/timeclock/store.ts`
- Modify: `sanity/schemaTypes/index.ts`
- Test: `lib/timeclock/store.test.ts`

**Interfaces:**
- Consumes: `cleanStaffName`, `shiftTimesProblem` and the types (Task 2); `client` (`@/sanity/lib/client`) and `getWriteClient` (`@/sanity/lib/writeClient`).
- Produces: `MAX_SHIFTS_READ` and `REPEAT_WINDOW_MS`, plus:
  - **Reads:**
    - `fetchBoard(): Promise<BoardRow[]>`;
    - `fetchShifts(from, to): Promise<TimeShift[]>`;
    - `fetchMine(pinHash, from, to): Promise<MyHours | null>`.
  - **Punching:** `punch(staffId, pinHash, action: ClockAction, now?)` returns `Promise<PunchResult>`, where `PunchResult` is
    - `{ ok: true; action; name; shift; repeat }`,
    - `{ ok: false; problem: 'no-staff' }`,
    - `{ ok: false; problem: 'wrong-pin' }`,
    - `{ ok: false; problem: 'not-in'; name }`, or
    - `{ ok: false; problem: 'changed' }`.
  - **A manager's fix:** `editShift(id, times, now?)` returns `Promise<EditResult>`, where `EditResult` is
    - `{ ok: true; shift }`, or
    - `{ ok: false; problem: 'gone' }`, `'changed'`, or `'invalid'` with a `message`.
  - **Deleting:** `deleteShift(id): Promise<boolean>`.
  - **The staff list:**
    - `addStaff(name, pinHash)` returns `{ ok: true; row }`, or `{ ok: false; problem: 'duplicate' }` or `'pin-taken'`;
    - `setStaffPin(staffId, pinHash)` returns `{ ok: true; name }`, or `{ ok: false; problem: 'gone' }` or `'pin-taken'`;
    - `removeStaff(staffId)` returns `{ ok: true; name }`, `{ ok: false; problem: 'gone' }`, or `{ ok: false; problem: 'on-shift'; name }`.

- [ ] **Step 1: Add the two document types**

`sanity/schemaTypes/staffMember.ts`:

```ts
import { defineField, defineType } from 'sanity'

// Someone on the POS time clock. Removing them on the POS only turns `active` off, so their
// shifts keep pointing at a real document. The PIN is kept only as a keyed fingerprint (see
// lib/timeclock/pins.ts), set from the Manager page.
export const staffMember = defineType({
  name: 'staffMember',
  title: 'Staff member',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (rule) => rule.required().min(2).max(60),
    }),
    defineField({
      name: 'active',
      title: 'On the time clock',
      description: 'Turned off when they are removed on the POS. Their shifts stay.',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'pinHash',
      title: 'PIN fingerprint',
      description: 'Set or changed on the POS Manager page. Not the PIN itself.',
      type: 'string',
      readOnly: true,
      hidden: true,
    }),
  ],
  preview: {
    select: { name: 'name', active: 'active' },
    prepare({ name, active }) {
      return { title: name, subtitle: active === false ? 'Removed' : 'On the time clock' }
    },
  },
})
```

`sanity/schemaTypes/timeShift.ts`:

```ts
import { defineField, defineType } from 'sanity'

// One shift on the POS time clock. The server stamps the time in and the time out; a manager's
// fix on the POS sets editedAt, which staff see as "Edited".
export const timeShift = defineType({
  name: 'timeShift',
  title: 'Time clock shift',
  type: 'document',
  fields: [
    defineField({ name: 'staffId', title: 'Staff member ID', type: 'string', readOnly: true, validation: (rule) => rule.required() }),
    defineField({ name: 'staffName', title: 'Name when they clocked in', type: 'string', readOnly: true }),
    defineField({ name: 'clockIn', title: 'Clocked in', type: 'datetime', validation: (rule) => rule.required() }),
    defineField({ name: 'clockOut', title: 'Clocked out', description: 'Empty while they are on shift.', type: 'datetime' }),
    defineField({ name: 'editedAt', title: 'Changed by a manager', type: 'datetime', readOnly: true }),
  ],
  orderings: [{ title: 'Newest first', name: 'clockInDesc', by: [{ field: 'clockIn', direction: 'desc' }] }],
  preview: {
    select: { staffName: 'staffName', clockIn: 'clockIn', clockOut: 'clockOut' },
    prepare({ staffName, clockIn, clockOut }) {
      const when = (iso?: string) =>
        iso ? new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
      return { title: staffName ?? 'Shift', subtitle: clockOut ? `${when(clockIn)} – ${when(clockOut)}` : `${when(clockIn)} · on shift` }
    },
  },
})
```

- [ ] **Step 2: Register them**

```diff
--- a/sanity/schemaTypes/index.ts
+++ b/sanity/schemaTypes/index.ts
@@ -7,7 +7,9 @@ import { saleItem } from './saleItem'
 import { saleDiscount } from './saleDiscount'
 import { salePayment } from './salePayment'
 import { loyaltyMember } from './loyaltyMember'
+import { staffMember } from './staffMember'
+import { timeShift } from './timeShift'
 
 export const schema: { types: SchemaTypeDefinition[] } = {
-  types: [menuCategory, menuItem, menuSettings, saleItem, saleDiscount, salePayment, sale, loyaltyMember],
+  types: [menuCategory, menuItem, menuSettings, saleItem, saleDiscount, salePayment, sale, loyaltyMember, staffMember, timeShift],
 }
```

- [ ] **Step 3: Write the failing store test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { read, create, remove, patch } = vi.hoisted(() => ({ read: vi.fn(), create: vi.fn(), remove: vi.fn(), patch: vi.fn() }))
vi.mock('@/sanity/lib/client', () => ({ client: { withConfig: () => ({ fetch: read }) } }))
vi.mock('@/sanity/lib/writeClient', () => ({ getWriteClient: () => ({ create, delete: remove, patch }) }))

import { REPEAT_WINDOW_MS, addStaff, deleteShift, editShift, fetchBoard, fetchMine, fetchShifts, punch, removeStaff, setStaffPin } from './store'

const NOW = new Date('2026-10-15T10:02:00.000Z') // 6:02 PM in Manila
const later = (ms: number) => new Date(NOW.getTime() + ms)

// A Sanity patch that records what it was given, then commits to `result` (or throws it).
function patchChain(result: unknown) {
  const chain = {
    ifRevisionId: vi.fn(() => chain),
    set: vi.fn(() => chain),
    commit: vi.fn(async () => {
      if (result instanceof Error) throw result
      return result
    }),
  }
  return chain
}
const conflict = () => Object.assign(new Error('Document has unexpected revision ID'), { statusCode: 409 })

const shift = (over: Record<string, unknown> = {}) => ({
  _id: 'shift-1', staffId: 'john', staffName: 'John Reyes', clockIn: '2026-10-14T23:44:00.000Z', clockOut: null, editedAt: null, ...over,
})
const off = { staffId: 'john', name: 'John Reyes', pinMatches: true, openShift: null, lastShift: shift({ clockOut: '2026-10-14T07:46:00.000Z' }) }
const onShift = { staffId: 'john', name: 'John Reyes', pinMatches: true, openShift: { ...shift(), _rev: 'rev-1' }, lastShift: null }

beforeEach(() => {
  read.mockReset()
  create.mockReset().mockImplementation(async (doc: Record<string, unknown>) => ({ ...doc, _id: 'new-id' }))
  remove.mockReset()
  patch.mockReset()
})

describe('punch', () => {
  it('checks the PIN against the person tapped, inside the query, never reading a fingerprint back', async () => {
    read.mockResolvedValueOnce(off)
    await punch('john', 'pin-hash', 'in', NOW)
    expect(read.mock.calls[0][1]).toEqual({ id: 'john', pinHash: 'pin-hash' })
    expect(read.mock.calls[0][0]).toContain('active != false')
    expect(read.mock.calls[0][0]).toContain('"pinMatches": defined(pinHash) && pinHash == $pinHash')
    expect(read.mock.calls[0][0]).not.toMatch(/[{,]\s*pinHash\s*[,}]/)
  })

  it('clocks someone in at the server’s time, under the name they have now', async () => {
    read.mockResolvedValueOnce(off)
    const result = await punch('john', 'pin-hash', 'in', NOW)
    expect(create).toHaveBeenCalledWith({ _type: 'timeShift', staffId: 'john', staffName: 'John Reyes', clockIn: '2026-10-15T10:02:00.000Z' })
    expect(result).toEqual({
      ok: true, action: 'in', name: 'John Reyes', repeat: false,
      shift: { _id: 'new-id', staffId: 'john', staffName: 'John Reyes', clockIn: '2026-10-15T10:02:00.000Z', clockOut: null, editedAt: null },
    })
  })

  it('clocks someone out at the revision it read', async () => {
    read.mockResolvedValueOnce(onShift)
    const chain = patchChain({ ...shift(), clockOut: '2026-10-15T10:02:00.000Z' })
    patch.mockReturnValue(chain)
    const result = await punch('john', 'pin-hash', 'out', NOW)
    expect(patch).toHaveBeenCalledWith('shift-1')
    expect(chain.ifRevisionId).toHaveBeenCalledWith('rev-1')
    expect(chain.set).toHaveBeenCalledWith({ clockOut: '2026-10-15T10:02:00.000Z' })
    expect(result).toMatchObject({ ok: true, action: 'out', repeat: false, shift: { clockOut: '2026-10-15T10:02:00.000Z' } })
  })

  it('refuses a PIN that is not that person’s, and says when they are not on the time clock', async () => {
    read.mockResolvedValueOnce({ ...off, pinMatches: false })
    expect(await punch('john', 'ana-hash', 'in', NOW)).toEqual({ ok: false, problem: 'wrong-pin' })
    read.mockResolvedValueOnce(null)
    expect(await punch('gone', 'pin-hash', 'in', NOW)).toEqual({ ok: false, problem: 'no-staff' })
    expect(create).not.toHaveBeenCalled()
  })

  it('answers a second Clock in with the shift already open, starting nothing', async () => {
    read.mockResolvedValueOnce(onShift)
    const result = await punch('john', 'pin-hash', 'in', NOW)
    expect(result).toEqual({ ok: true, action: 'in', name: 'John Reyes', shift: shift(), repeat: true })
    expect(create).not.toHaveBeenCalled()
  })

  it('repeats a Clock out within a minute, and refuses one for someone not clocked in', async () => {
    const justOut = { ...off, lastShift: shift({ clockOut: NOW.toISOString() }) }
    read.mockResolvedValueOnce(justOut)
    expect(await punch('john', 'pin-hash', 'out', later(30 * 1000))).toMatchObject({ ok: true, action: 'out', repeat: true })
    read.mockResolvedValueOnce(justOut)
    expect(await punch('john', 'pin-hash', 'out', later(REPEAT_WINDOW_MS))).toEqual({ ok: false, problem: 'not-in', name: 'John Reyes' })
    expect(patch).not.toHaveBeenCalled()
  })

  it('clocks two people in at the same moment, each into their own shift', async () => {
    read.mockImplementation(async (_query: string, params: { id: string }) => ({
      ...off, staffId: params.id, name: params.id === 'john' ? 'John Reyes' : 'Ana Cruz', lastShift: null,
    }))
    const results = await Promise.all([punch('john', 'john-hash', 'in', NOW), punch('ana', 'ana-hash', 'in', NOW)])
    expect(create).toHaveBeenCalledTimes(2)
    expect(results.map(result => result.ok && result.name)).toEqual(['John Reyes', 'Ana Cruz'])
  })

  it('says when another clock-out landed first', async () => {
    read.mockResolvedValueOnce(onShift)
    patch.mockReturnValue(patchChain(conflict()))
    expect(await punch('john', 'pin-hash', 'out', NOW)).toEqual({ ok: false, problem: 'changed' })
  })
})

describe('reads', () => {
  it('lists the people on the time clock with whether they have a PIN, never the PIN', async () => {
    read.mockResolvedValueOnce([])
    await fetchBoard()
    expect(read.mock.calls[0][0]).toContain('"hasPin": defined(pinHash)')
    expect(read.mock.calls[0][0]).not.toMatch(/[{,]\s*pinHash\s*[,}]/)
  })

  it('reads everyone’s shifts in a range, and one person’s own by PIN', async () => {
    read.mockResolvedValueOnce([]).mockResolvedValueOnce({ name: 'John Reyes', openShift: null, shifts: [] })
    await fetchShifts('2026-10-11T16:00:00.000Z', '2026-10-18T16:00:00.000Z')
    expect(read.mock.calls[0][1]).toEqual({ from: '2026-10-11T16:00:00.000Z', to: '2026-10-18T16:00:00.000Z' })
    expect(await fetchMine('pin-hash', '2026-10-11T16:00:00.000Z', '2026-10-18T16:00:00.000Z')).toEqual({ name: 'John Reyes', openShift: null, shifts: [] })
    expect(read.mock.calls[1][1]).toEqual({ pinHash: 'pin-hash', from: '2026-10-11T16:00:00.000Z', to: '2026-10-18T16:00:00.000Z' })
  })
})

describe('editShift', () => {
  const stored = { ...shift(), _rev: 'rev-4' }
  const LATER = new Date('2026-10-15T12:00:00.000Z') // 8:00 PM in Manila
  const fixed = { clockIn: '2026-10-14T23:44:00.000Z', clockOut: '2026-10-15T07:46:00.000Z' }

  it('sets the times, marks the shift edited and saves it at the revision read', async () => {
    read.mockResolvedValueOnce(stored).mockResolvedValueOnce([])
    const chain = patchChain({ ...stored, ...fixed, editedAt: LATER.toISOString() })
    patch.mockReturnValue(chain)
    const result = await editShift('shift-1', fixed, LATER)
    expect(chain.ifRevisionId).toHaveBeenCalledWith('rev-4')
    expect(chain.set).toHaveBeenCalledWith({ ...fixed, editedAt: '2026-10-15T12:00:00.000Z' })
    expect(result.ok && result.shift.editedAt).toBe('2026-10-15T12:00:00.000Z')
  })

  it('refuses times that overlap another of their shifts, before writing anything', async () => {
    read.mockResolvedValueOnce(stored).mockResolvedValueOnce([{ clockIn: '2026-10-15T08:00:00.000Z', clockOut: '2026-10-15T09:00:00.000Z' }])
    const result = await editShift('shift-1', { clockIn: '2026-10-14T23:44:00.000Z', clockOut: '2026-10-15T08:30:00.000Z' }, LATER)
    expect(result).toEqual({ ok: false, problem: 'invalid', message: 'That overlaps their shift from Thu, Oct 15, 4:00 PM.' })
    expect(patch).not.toHaveBeenCalled()
  })

  it('says when the shift is gone, or changed on another device since it was read', async () => {
    read.mockResolvedValueOnce(null)
    expect(await editShift('shift-1', fixed, LATER)).toEqual({ ok: false, problem: 'gone' })
    read.mockResolvedValueOnce(stored).mockResolvedValueOnce([])
    patch.mockReturnValue(patchChain(conflict()))
    expect(await editShift('shift-1', fixed, LATER)).toEqual({ ok: false, problem: 'changed' })
  })
})

describe('deleteShift', () => {
  it('deletes shifts only, and says when there was none', async () => {
    remove.mockResolvedValueOnce({ results: [{ id: 'shift-1' }] }).mockResolvedValueOnce({ results: [] })
    expect(await deleteShift('shift-1')).toBe(true)
    expect(remove.mock.calls[0][0]).toEqual({ query: '*[_type == "timeShift" && _id == $id]', params: { id: 'shift-1' } })
    expect(await deleteShift('a-sale')).toBe(false)
  })
})

describe('the staff list', () => {
  it('adds a name, cleaned up, with its PIN’s fingerprint', async () => {
    read.mockResolvedValueOnce({ name: 0, pin: 0 })
    expect(await addStaff('  Ana   Cruz ', 'ana-hash')).toEqual({ ok: true, row: { staffId: 'new-id', name: 'Ana Cruz', hasPin: true, openShift: null } })
    expect(create).toHaveBeenCalledWith({ _type: 'staffMember', name: 'Ana Cruz', active: true, pinHash: 'ana-hash' })
  })

  it('refuses a name or a PIN someone on the time clock has already', async () => {
    read.mockResolvedValueOnce({ name: 1, pin: 0 }).mockResolvedValueOnce({ name: 0, pin: 1 })
    expect(await addStaff('Ana Cruz', 'ana-hash')).toEqual({ ok: false, problem: 'duplicate' })
    expect(await addStaff('Ana Santos', 'john-hash')).toEqual({ ok: false, problem: 'pin-taken' })
    expect(create).not.toHaveBeenCalled()
  })

  it('changes a PIN, unless someone else has it or the person was removed', async () => {
    const chain = patchChain({})
    patch.mockReturnValue(chain)
    read.mockResolvedValueOnce({ name: 'Ana Cruz', taken: 0 })
    expect(await setStaffPin('ana', 'new-hash')).toEqual({ ok: true, name: 'Ana Cruz' })
    expect(patch).toHaveBeenCalledWith('ana')
    expect(chain.set).toHaveBeenCalledWith({ pinHash: 'new-hash' })
    read.mockResolvedValueOnce({ name: 'Ana Cruz', taken: 1 }).mockResolvedValueOnce({ name: null, taken: 0 })
    expect(await setStaffPin('ana', 'john-hash')).toEqual({ ok: false, problem: 'pin-taken' })
    expect(await setStaffPin('gone', 'new-hash')).toEqual({ ok: false, problem: 'gone' })
  })

  it('takes someone off the time clock and keeps their document, unless they are on shift', async () => {
    const chain = patchChain({})
    patch.mockReturnValue(chain)
    read.mockResolvedValueOnce({ staffId: 'john', name: 'John Reyes', hasPin: true, openShift: null })
    expect(await removeStaff('john')).toEqual({ ok: true, name: 'John Reyes' })
    expect(chain.set).toHaveBeenCalledWith({ active: false })
    read.mockResolvedValueOnce({ staffId: 'john', name: 'John Reyes', hasPin: true, openShift: { _id: 's', clockIn: NOW.toISOString() } })
    expect(await removeStaff('john')).toEqual({ ok: false, problem: 'on-shift', name: 'John Reyes' })
    read.mockResolvedValueOnce(null)
    expect(await removeStaff('john')).toEqual({ ok: false, problem: 'gone' })
  })
})
```

- [ ] **Step 4: Run it to see it fail**

Run: `npx vitest run lib/timeclock/store.test.ts`
Expected: FAIL. `Failed to resolve import "./store"`.

- [ ] **Step 5: Write the store**

```ts
import { client } from '@/sanity/lib/client'
import { getWriteClient } from '@/sanity/lib/writeClient'
import {
  cleanStaffName,
  shiftTimesProblem,
  type BoardRow,
  type ClockAction,
  type MyHours,
  type ShiftTimes,
  type TimeShift,
} from './rules'

// Server only: the staff on the time clock and their shifts. Every clock in and clock out is
// stamped here with the server's time, never the tablet's. PINs are checked by their fingerprint
// (lib/timeclock/pins.ts) inside the queries; no read here ever returns a fingerprint.

const fresh = client.withConfig({ useCdn: false })
const NO_STORE = { cache: 'no-store' } as const
/** The most shifts one read returns. Three people's shifts for a month come to about 80. */
export const MAX_SHIFTS_READ = 500
/** A Clock out this soon after the last one repeats it rather than failing: a double tap, or a retry after a lost reply. */
export const REPEAT_WINDOW_MS = 60 * 1000

const SHIFT_FIELDS = '_id, staffId, staffName, clockIn, "clockOut": coalesce(clockOut, null), "editedAt": coalesce(editedAt, null)'
const OPEN_SHIFT = '*[_type == "timeShift" && staffId == ^._id && !defined(clockOut)] | order(clockIn desc)[0]'
const ACTIVE_STAFF = '_type == "staffMember" && active != false'
const STAFF_ROW = `{ "staffId": _id, name, "hasPin": defined(pinHash), "openShift": ${OPEN_SHIFT}{ _id, clockIn } }`

type SanityDoc = Record<string, unknown> & { _id: string }

function toShift(doc: SanityDoc): TimeShift {
  return {
    _id: doc._id,
    staffId: String(doc.staffId),
    staffName: String(doc.staffName ?? ''),
    clockIn: String(doc.clockIn),
    clockOut: typeof doc.clockOut === 'string' ? doc.clockOut : null,
    editedAt: typeof doc.editedAt === 'string' ? doc.editedAt : null,
  }
}

const isConflict = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { statusCode?: unknown }).statusCode === 409

/** Everyone on the time clock, by name, each with the shift they are on. */
export async function fetchBoard(): Promise<BoardRow[]> {
  return fresh.fetch<BoardRow[]>(`*[${ACTIVE_STAFF}] | order(lower(name) asc)${STAFF_ROW}`, {}, NO_STORE)
}

/** Everyone's shifts that began in [from, to), newest first: the Manager page's Hours. */
export async function fetchShifts(from: string, to: string): Promise<TimeShift[]> {
  return fresh.fetch<TimeShift[]>(
    `*[_type == "timeShift" && dateTime(clockIn) >= dateTime($from) && dateTime(clockIn) < dateTime($to)] | order(clockIn desc)[0...${MAX_SHIFTS_READ}]{ ${SHIFT_FIELDS} }`,
    { from, to },
    NO_STORE,
  )
}

/** One person's own hours, found by their PIN's fingerprint: null when no one on the time clock has that PIN. */
export async function fetchMine(pinHash: string, from: string, to: string): Promise<MyHours | null> {
  return fresh.fetch<MyHours | null>(
    `*[${ACTIVE_STAFF} && pinHash == $pinHash][0]{
      name,
      "openShift": ${OPEN_SHIFT}{ _id, clockIn },
      "shifts": *[_type == "timeShift" && staffId == ^._id && dateTime(clockIn) >= dateTime($from) && dateTime(clockIn) < dateTime($to)] | order(clockIn desc)[0...${MAX_SHIFTS_READ}]{ ${SHIFT_FIELDS} }
    }`,
    { pinHash, from, to },
    NO_STORE,
  )
}

interface PunchRow {
  staffId: string
  name: string
  /** Whether the PIN given is this person's; compared in the query, so no fingerprint is read back. */
  pinMatches: boolean
  openShift: (TimeShift & { _rev: string }) | null
  lastShift: TimeShift | null
}

export type PunchResult =
  | { ok: true; action: ClockAction; name: string; shift: TimeShift; repeat: boolean }
  | { ok: false; problem: 'no-staff' }
  | { ok: false; problem: 'wrong-pin' }
  | { ok: false; problem: 'not-in'; name: string }
  | { ok: false; problem: 'changed' }

const withoutRev = ({ _id, staffId, staffName, clockIn, clockOut, editedAt }: TimeShift): TimeShift => ({ _id, staffId, staffName, clockIn, clockOut, editedAt })

/**
 * A Clock in or Clock out tapped on someone's name, with that person's PIN: the PIN must be theirs.
 * The time is the server's. Two people clocking in at the same moment each get their own shift
 * document, so neither waits for the other or overwrites it. A repeat never undoes anything: Clock
 * in for someone already on shift answers with that shift, and Clock out within REPEAT_WINDOW_MS
 * of their last clock-out answers with it, so a double tap or a retry after a lost reply is safe.
 */
export async function punch(staffId: string, pinHash: string, action: ClockAction, now: Date = new Date()): Promise<PunchResult> {
  const person = await fresh.fetch<PunchRow | null>(
    `*[${ACTIVE_STAFF} && _id == $id][0]{
      "staffId": _id, name,
      "pinMatches": defined(pinHash) && pinHash == $pinHash,
      "openShift": ${OPEN_SHIFT}{ _rev, ${SHIFT_FIELDS} },
      "lastShift": *[_type == "timeShift" && staffId == ^._id && defined(clockOut)] | order(clockOut desc)[0]{ ${SHIFT_FIELDS} }
    }`,
    { id: staffId, pinHash },
    NO_STORE,
  )
  if (!person) return { ok: false, problem: 'no-staff' }
  if (!person.pinMatches) return { ok: false, problem: 'wrong-pin' }
  const { name, openShift, lastShift } = person

  if (action === 'in') {
    if (openShift) return { ok: true, action: 'in', name, shift: withoutRev(openShift), repeat: true }
    const doc = await getWriteClient().create({ _type: 'timeShift', staffId: person.staffId, staffName: name, clockIn: now.toISOString() })
    return { ok: true, action: 'in', name, shift: toShift(doc), repeat: false }
  }

  if (openShift) {
    try {
      // Saved at the revision just read: of two clock-outs at once, only one lands.
      const doc = await getWriteClient().patch(openShift._id).ifRevisionId(openShift._rev).set({ clockOut: now.toISOString() }).commit()
      return { ok: true, action: 'out', name, shift: toShift(doc), repeat: false }
    } catch (error) {
      if (isConflict(error)) return { ok: false, problem: 'changed' }
      throw error
    }
  }
  if (lastShift?.clockOut && now.getTime() - Date.parse(lastShift.clockOut) < REPEAT_WINDOW_MS) {
    return { ok: true, action: 'out', name, shift: lastShift, repeat: true }
  }
  return { ok: false, problem: 'not-in', name }
}

export type EditResult =
  | { ok: true; shift: TimeShift }
  | { ok: false; problem: 'gone' }
  | { ok: false; problem: 'changed' }
  | { ok: false; problem: 'invalid'; message: string }

/** A manager's fix to a shift's times: checked against that person's other shifts, saved at the revision read. */
export async function editShift(id: string, times: ShiftTimes, now: Date = new Date()): Promise<EditResult> {
  const current = await fresh.fetch<(TimeShift & { _rev: string }) | null>(
    `*[_type == "timeShift" && _id == $id][0]{ _rev, ${SHIFT_FIELDS} }`,
    { id },
    NO_STORE,
  )
  if (!current) return { ok: false, problem: 'gone' }
  const wasOpen = current.clockOut === null
  const basic = shiftTimesProblem(times, { wasOpen, now: now.getTime(), others: [] })
  if (basic) return { ok: false, problem: 'invalid', message: basic }

  // Their other shifts that overlap the new times; one still open runs until now.
  const others = await fresh.fetch<Pick<TimeShift, 'clockIn' | 'clockOut'>[]>(
    `*[_type == "timeShift" && staffId == $staffId && _id != $id && dateTime(clockIn) < dateTime($end) && (!defined(clockOut) || dateTime(clockOut) > dateTime($start))]{ clockIn, "clockOut": coalesce(clockOut, null) }`,
    { staffId: current.staffId, id, start: times.clockIn, end: times.clockOut ?? now.toISOString() },
    NO_STORE,
  )
  const problem = shiftTimesProblem(times, { wasOpen, now: now.getTime(), others })
  if (problem) return { ok: false, problem: 'invalid', message: problem }

  try {
    const doc = await getWriteClient()
      .patch(id)
      .ifRevisionId(current._rev)
      .set({ clockIn: times.clockIn, ...(times.clockOut ? { clockOut: times.clockOut } : {}), editedAt: now.toISOString() })
      .commit()
    return { ok: true, shift: toShift(doc) }
  } catch (error) {
    if (isConflict(error)) return { ok: false, problem: 'changed' }
    throw error
  }
}

/** Deletes a shift. The query matches shifts only, so no other document can be deleted this way. */
export async function deleteShift(id: string): Promise<boolean> {
  const result = await getWriteClient().delete({ query: '*[_type == "timeShift" && _id == $id]', params: { id } })
  return result.results.length > 0
}

export type AddStaffResult =
  | { ok: true; row: BoardRow }
  | { ok: false; problem: 'duplicate' }
  | { ok: false; problem: 'pin-taken' }

/** Puts a name on the time clock with its PIN's fingerprint, unless the name or the PIN is someone else's already. */
export async function addStaff(rawName: string, pinHash: string): Promise<AddStaffResult> {
  const name = cleanStaffName(rawName)
  const taken = await fresh.fetch<{ name: number; pin: number }>(
    `{ "name": count(*[${ACTIVE_STAFF} && lower(name) == lower($name)]), "pin": count(*[${ACTIVE_STAFF} && pinHash == $pinHash]) }`,
    { name, pinHash },
    NO_STORE,
  )
  if (taken.name > 0) return { ok: false, problem: 'duplicate' }
  if (taken.pin > 0) return { ok: false, problem: 'pin-taken' }
  const doc = await getWriteClient().create({ _type: 'staffMember', name, active: true, pinHash })
  return { ok: true, row: { staffId: doc._id, name, hasPin: true, openShift: null } }
}

export type SetPinResult =
  | { ok: true; name: string }
  | { ok: false; problem: 'gone' }
  | { ok: false; problem: 'pin-taken' }

/** Gives someone a new PIN, unless another person on the time clock has it. */
export async function setStaffPin(staffId: string, pinHash: string): Promise<SetPinResult> {
  const found = await fresh.fetch<{ name: string | null; taken: number }>(
    `{ "name": *[${ACTIVE_STAFF} && _id == $id][0].name, "taken": count(*[${ACTIVE_STAFF} && _id != $id && pinHash == $pinHash]) }`,
    { id: staffId, pinHash },
    NO_STORE,
  )
  if (!found.name) return { ok: false, problem: 'gone' }
  if (found.taken > 0) return { ok: false, problem: 'pin-taken' }
  await getWriteClient().patch(staffId).set({ pinHash }).commit()
  return { ok: true, name: found.name }
}

export type RemoveStaffResult = { ok: true; name: string } | { ok: false; problem: 'gone' } | { ok: false; problem: 'on-shift'; name: string }

/** Takes someone off the time clock. Their shifts stay, under the name they clocked in with. */
export async function removeStaff(staffId: string): Promise<RemoveStaffResult> {
  const row = await fresh.fetch<BoardRow | null>(`*[${ACTIVE_STAFF} && _id == $id][0]${STAFF_ROW}`, { id: staffId }, NO_STORE)
  if (!row) return { ok: false, problem: 'gone' }
  if (row.openShift) return { ok: false, problem: 'on-shift', name: row.name }
  await getWriteClient().patch(staffId).set({ active: false }).commit()
  return { ok: true, name: row.name }
}
```

- [ ] **Step 6: Run it to see it pass**

Run: `npx vitest run lib/timeclock`
Expected: PASS, 58 tests.

### Task 4: Reading the time clock, punching, My records

**Files:**
- Create: `app/api/timeclock/route.ts`, `app/api/timeclock/punch/route.ts`, `app/api/timeclock/mine/route.ts`
- Modify: `proxy.ts:4`
- Test: `app/api/timeclock/route.test.ts`, `app/api/timeclock/punch/route.test.ts`, `app/api/timeclock/mine/route.test.ts`

**Interfaces:**
- Consumes: `readRange`, `isDocId` and `isStaffPin` (Task 2); `hasStaffPinSecret` and `hashStaffPin` (Task 2); `fetchBoard`, `fetchShifts`, `punch` and `fetchMine` (Task 3).
- Produces:
  - **`GET /api/timeclock`** answers `{ data: { board, shifts } }`. `?from&to` (UTC, at most 62 days apart) adds everyone's shifts in the range; without them, `shifts` is `[]`. A bad range answers 400.
  - **`POST /api/timeclock/punch`** takes `{ staffId, action: 'in' | 'out', pin }` and answers `{ data: { action, name, shift, repeat } }`.
    - 403: "Incorrect PIN. Try again." (not that person's PIN).
    - 404: someone no longer on the time clock.
    - 409: "X is not clocked in.", or changed on another device.
    - 400: no person, no action, or not 4 digits.
    - 500: "Server misconfiguration" without the secret.
  - **`POST /api/timeclock/mine`** takes `{ pin, from, to }` and answers `{ data: MyHours }`, 403 or 400.

- [ ] **Step 1: Write the three failing tests**

`app/api/timeclock/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { requirePosAuth, fetchBoard, fetchShifts } = vi.hoisted(() => ({ requirePosAuth: vi.fn(), fetchBoard: vi.fn(), fetchShifts: vi.fn() }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/lib/timeclock/store', () => ({ fetchBoard, fetchShifts }))

import { GET } from './route'
import { config } from '@/proxy'

const get = (query = '') => GET(new NextRequest(`http://pos.test/api/timeclock${query}`))
const WEEK = '?from=2026-10-11T16:00:00.000Z&to=2026-10-18T16:00:00.000Z'

beforeEach(() => {
  requirePosAuth.mockReset().mockResolvedValue(null)
  fetchBoard.mockReset().mockResolvedValue([])
  fetchShifts.mockReset().mockResolvedValue([])
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('GET /api/timeclock', () => {
  it('gives the staff on the time clock and everyone’s shifts in the range', async () => {
    fetchBoard.mockResolvedValue([{ staffId: 'john', name: 'John Reyes', hasPin: true, openShift: null }])
    const res = await get(WEEK)
    expect(res.status).toBe(200)
    expect(fetchShifts).toHaveBeenCalledWith('2026-10-11T16:00:00.000Z', '2026-10-18T16:00:00.000Z')
    expect((await res.json()).data.board).toHaveLength(1)
  })

  it('gives only the staff list when no range is asked for, as the header count needs', async () => {
    const res = await get()
    expect((await res.json()).data).toEqual({ board: [], shifts: [] })
    expect(fetchShifts).not.toHaveBeenCalled()
  })

  it('refuses a range that is half there, backwards, not UTC, impossible or longer than two months', async () => {
    const queries = [
      '?from=2026-10-11T16:00:00Z',
      '?from=2026-10-18T16:00:00Z&to=2026-10-11T16:00:00Z',
      '?from=2026-10-11&to=2026-10-18',
      '?from=2026-10-11T25:00:00Z&to=2026-10-18T16:00:00Z',
      '?from=2026-01-01T00:00:00Z&to=2026-10-01T00:00:00Z',
    ]
    for (const query of queries) expect((await get(query)).status).toBe(400)
    expect(fetchShifts).not.toHaveBeenCalled()
  })

  it('needs the POS session', async () => {
    requirePosAuth.mockResolvedValue(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    expect((await get(WEEK)).status).toBe(401)
    expect(fetchBoard).not.toHaveBeenCalled()
  })
})

describe('the POS login check', () => {
  it('covers the time clock routes, like the sales and loyalty ones', () => {
    expect(config.matcher).toEqual(expect.arrayContaining(['/api/timeclock', '/api/timeclock/(.+)']))
  })
})
```

`app/api/timeclock/punch/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { requirePosAuth, punch } = vi.hoisted(() => ({ requirePosAuth: vi.fn(), punch: vi.fn() }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/lib/timeclock/store', () => ({ punch }))

import { POST } from './route'
import { hashStaffPin } from '@/lib/timeclock/pins'

const SECRET = 'test-secret-that-is-long-enough-1234'
const post = (body: unknown) => POST(new NextRequest('http://pos.test/api/timeclock/punch', {
  method: 'POST',
  body: typeof body === 'string' ? body : JSON.stringify(body),
}))
const shift = { _id: 'shift-1', staffId: 'john', staffName: 'John Reyes', clockIn: '2026-10-15T01:58:00.000Z', clockOut: null, editedAt: null }
const johnIn = { staffId: 'john', action: 'in', pin: '2222' }

beforeEach(() => {
  vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token')
  vi.stubEnv('STAFF_PIN_SECRET', SECRET)
  requirePosAuth.mockReset().mockResolvedValue(null)
  punch.mockReset().mockResolvedValue({ ok: true, action: 'in', name: 'John Reyes', shift, repeat: false })
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/timeclock/punch', () => {
  it('clocks the person tapped, checking the PIN by its fingerprint, never passing the digits on', async () => {
    const res = await post(johnIn)
    expect(res.status).toBe(200)
    expect(punch).toHaveBeenCalledWith('john', hashStaffPin('2222', SECRET), 'in')
    expect(JSON.stringify(punch.mock.calls[0])).not.toContain('2222')
    expect((await res.json()).data).toEqual({ action: 'in', name: 'John Reyes', shift, repeat: false })
  })

  it('logs who clocked in or out, without the PIN', async () => {
    await post(johnIn)
    expect(console.info).toHaveBeenCalledWith('Clocked in', { staffId: 'john', shiftId: 'shift-1', repeat: false })
  })

  it('answers 403 to someone else’s PIN, so the POS does not take it for a lost session', async () => {
    punch.mockResolvedValue({ ok: false, problem: 'wrong-pin' })
    const res = await post({ ...johnIn, pin: '3333' })
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('Incorrect PIN. Try again.')
  })

  it('answers 409 to a Clock out for someone not clocked in, and 404 for someone removed', async () => {
    punch.mockResolvedValueOnce({ ok: false, problem: 'not-in', name: 'Ana Cruz' }).mockResolvedValueOnce({ ok: false, problem: 'no-staff' })
    const out = await post({ staffId: 'ana', action: 'out', pin: '3333' })
    expect(out.status).toBe(409)
    expect((await out.json()).error).toBe('Ana Cruz is not clocked in.')
    expect((await post(johnIn)).status).toBe(404)
  })

  it('refuses a body without a person, an action and a four-digit PIN, or that is not JSON', async () => {
    const bodies = [{}, { action: 'in', pin: '2222' }, { staffId: 'john', action: 'lunch', pin: '2222' }, { staffId: 'drafts.john', action: 'in', pin: '2222' }, { staffId: 'john', action: 'in', pin: '22' }, 'not json']
    for (const body of bodies) expect((await post(body)).status).toBe(400)
    expect(punch).not.toHaveBeenCalled()
  })

  it('stops with "Server misconfiguration" until STAFF_PIN_SECRET is set', async () => {
    vi.stubEnv('STAFF_PIN_SECRET', '')
    const res = await post(johnIn)
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('Server misconfiguration')
    expect(punch).not.toHaveBeenCalled()
  })

  it('needs the POS session before anything else', async () => {
    requirePosAuth.mockResolvedValue(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    expect((await post(johnIn)).status).toBe(401)
    expect(punch).not.toHaveBeenCalled()
  })
})
```

`app/api/timeclock/mine/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { requirePosAuth, fetchMine } = vi.hoisted(() => ({ requirePosAuth: vi.fn(), fetchMine: vi.fn() }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/lib/timeclock/store', () => ({ fetchMine }))

import { POST } from './route'
import { hashStaffPin } from '@/lib/timeclock/pins'

const SECRET = 'test-secret-that-is-long-enough-1234'
const WEEK = { from: '2026-10-11T16:00:00.000Z', to: '2026-10-18T16:00:00.000Z' }
const post = (body: unknown) => POST(new NextRequest('http://pos.test/api/timeclock/mine', {
  method: 'POST',
  body: typeof body === 'string' ? body : JSON.stringify(body),
}))
const mine = { name: 'John Reyes', openShift: null, shifts: [] }

beforeEach(() => {
  vi.stubEnv('STAFF_PIN_SECRET', SECRET)
  requirePosAuth.mockReset().mockResolvedValue(null)
  fetchMine.mockReset().mockResolvedValue(mine)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/timeclock/mine', () => {
  it('gives that person’s own hours, found by the PIN’s fingerprint', async () => {
    const res = await post({ pin: '2222', ...WEEK })
    expect(res.status).toBe(200)
    expect(fetchMine).toHaveBeenCalledWith(hashStaffPin('2222', SECRET), WEEK.from, WEEK.to)
    expect((await res.json()).data).toEqual(mine)
  })

  it('answers 403 to a PIN nobody has', async () => {
    fetchMine.mockResolvedValue(null)
    const res = await post({ pin: '9999', ...WEEK })
    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('PIN not recognised. Try again.')
  })

  it('refuses a PIN that is not four digits, or a range that is wrong', async () => {
    expect((await post({ pin: '22', ...WEEK })).status).toBe(400)
    expect((await post({ pin: '2222', from: WEEK.to, to: WEEK.from })).status).toBe(400)
    expect((await post({ pin: '2222' })).status).toBe(400)
    expect((await post('not json')).status).toBe(400)
    expect(fetchMine).not.toHaveBeenCalled()
  })

  it('stops until STAFF_PIN_SECRET is set, and needs the POS session', async () => {
    vi.stubEnv('STAFF_PIN_SECRET', '')
    expect((await post({ pin: '2222', ...WEEK })).status).toBe(500)
    vi.stubEnv('STAFF_PIN_SECRET', SECRET)
    requirePosAuth.mockResolvedValue(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    expect((await post({ pin: '2222', ...WEEK })).status).toBe(401)
    expect(fetchMine).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run app/api/timeclock`
Expected: FAIL. All three files fail with `Failed to resolve import "./route"`.

- [ ] **Step 3: Write the three routes**

`app/api/timeclock/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { readRange } from '@/lib/timeclock/rules'
import { fetchBoard, fetchShifts } from '@/lib/timeclock/store'

export const dynamic = 'force-dynamic'

// Everyone on the time clock, with no PINs: the POS header counts who is on shift from it, and
// the Manager page lists the staff. With ?from=&to= it adds everyone's shifts that began in that
// range, for Hours. The manager PIN is asked on the Manager page; like the menu routes, this
// route takes any signed-in POS.
export async function GET(request: NextRequest) {
  const authError = await requirePosAuth()
  if (authError) return authError

  const params = request.nextUrl.searchParams
  const wantsShifts = params.has('from') || params.has('to')
  const range = wantsShifts ? readRange(params.get('from'), params.get('to')) : null
  if (wantsShifts && !range) {
    return NextResponse.json({ success: false, error: 'Give from and to as UTC times, at most two months apart.' }, { status: 400 })
  }

  try {
    const [board, shifts] = await Promise.all([fetchBoard(), range ? fetchShifts(range.from, range.to) : Promise.resolve([])])
    return NextResponse.json({ success: true, data: { board, shifts } })
  } catch (error) {
    console.error('Time clock could not be read', error)
    return NextResponse.json({ success: false, error: 'Failed to load the time clock.' }, { status: 500 })
  }
}
```

`app/api/timeclock/punch/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { hasStaffPinSecret, hashStaffPin } from '@/lib/timeclock/pins'
import { isDocId, isStaffPin } from '@/lib/timeclock/rules'
import { punch } from '@/lib/timeclock/store'

export const dynamic = 'force-dynamic'

// Clock in or Clock out, tapped on someone's name on the Time clock page:
// { staffId, action: 'in' | 'out', pin }. The PIN must be that person's; the server picks the
// time. A wrong PIN answers 403, not 401: a 401 tells the POS its session has ended.
export async function POST(request: NextRequest) {
  const authError = await requirePosAuth()
  if (authError) return authError

  if (!process.env.SANITY_API_WRITE_TOKEN || !hasStaffPinSecret()) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }
  const { staffId, action, pin } = body
  if (!isDocId(staffId) || (action !== 'in' && action !== 'out')) {
    return NextResponse.json({ success: false, error: 'Send staffId, and action "in" or "out".' }, { status: 400 })
  }
  if (!isStaffPin(pin)) {
    return NextResponse.json({ success: false, error: 'Enter your 4-digit PIN.' }, { status: 400 })
  }

  try {
    const result = await punch(staffId, hashStaffPin(pin), action)
    if (!result.ok) {
      switch (result.problem) {
        case 'no-staff':
          return NextResponse.json({ success: false, error: 'That person is not on the time clock any more.' }, { status: 404 })
        case 'wrong-pin':
          return NextResponse.json({ success: false, error: 'Incorrect PIN. Try again.' }, { status: 403 })
        case 'not-in':
          return NextResponse.json({ success: false, error: `${result.name} is not clocked in.` }, { status: 409 })
        case 'changed':
          return NextResponse.json({ success: false, error: 'That changed on another device. Try again.' }, { status: 409 })
      }
    }
    console.info(result.action === 'in' ? 'Clocked in' : 'Clocked out', { staffId, shiftId: result.shift._id, repeat: result.repeat })
    const { name, shift, repeat } = result
    return NextResponse.json({ success: true, data: { action: result.action, name, shift, repeat } })
  } catch (error) {
    console.error('Clock in or out could not be saved', error)
    return NextResponse.json({ success: false, error: 'Failed to save. Try again.' }, { status: 500 })
  }
}
```

`app/api/timeclock/mine/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { hasStaffPinSecret, hashStaffPin } from '@/lib/timeclock/pins'
import { isStaffPin, readRange } from '@/lib/timeclock/rules'
import { fetchMine } from '@/lib/timeclock/store'

export const dynamic = 'force-dynamic'

// My records on the Time clock page: { pin, from, to } gives that person's own shifts in the range,
// and nobody else's. A POST, so the PIN travels in the body rather than in a URL that gets logged.
export async function POST(request: NextRequest) {
  const authError = await requirePosAuth()
  if (authError) return authError

  if (!hasStaffPinSecret()) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }
  if (!isStaffPin(body.pin)) {
    return NextResponse.json({ success: false, error: 'Enter your 4-digit PIN.' }, { status: 400 })
  }
  const range = readRange(body.from, body.to)
  if (!range) {
    return NextResponse.json({ success: false, error: 'Give from and to as UTC times, at most two months apart.' }, { status: 400 })
  }

  try {
    const mine = await fetchMine(hashStaffPin(body.pin), range.from, range.to)
    if (!mine) return NextResponse.json({ success: false, error: 'PIN not recognised. Try again.' }, { status: 403 })
    return NextResponse.json({ success: true, data: mine })
  } catch (error) {
    console.error('My records could not be read', error)
    return NextResponse.json({ success: false, error: 'Failed to load your records.' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run them again**

Run: `npx vitest run app/api/timeclock`
Expected: FAIL, 1 test: "covers the time clock routes, like the sales and loyalty ones". The other 15 pass.

- [ ] **Step 5: Put the time clock behind the POS login check**

```diff
--- a/proxy.ts
+++ b/proxy.ts
@@ -1,7 +1,7 @@
 import { NextRequest, NextResponse } from 'next/server'
 
 export const config = {
-  matcher: ['/pos', '/pos/(.+)', '/api/sales', '/api/sales/(.+)', '/api/loyalty/(.+)'],
+  matcher: ['/pos', '/pos/(.+)', '/api/sales', '/api/sales/(.+)', '/api/loyalty/(.+)', '/api/timeclock', '/api/timeclock/(.+)'],
 }
 
 async function hashPin(pin: string): Promise<string> {
```

- [ ] **Step 6: Run them to see them pass**

Run: `npx vitest run app/api/timeclock`
Expected: PASS, 16 tests.

### Task 5: The manager's routes

**Files:**
- Create: `app/api/timeclock/shifts/[id]/route.ts`, `app/api/timeclock/staff/route.ts`, `app/api/timeclock/staff/[id]/route.ts`
- Test: `app/api/timeclock/shifts/[id]/route.test.ts`, `app/api/timeclock/staff/route.test.ts`, `app/api/timeclock/staff/[id]/route.test.ts`

**Interfaces:**
- Consumes: `isDocId`, `readInstant`, `cleanStaffName` and `staffNameProblem` (Task 2); `hasStaffPinSecret`, `hashStaffPin` and `staffPinRefusal` (Task 2); `editShift`, `deleteShift`, `addStaff`, `setStaffPin` and `removeStaff` (Task 3).
- Produces:
  - **`PATCH /api/timeclock/shifts/[id]`** takes `{ clockIn, clockOut | null }`. It answers 200; 400 with the rule's own sentence; 404 when the shift is gone; or 409 when it changed on another device.
  - **`DELETE /api/timeclock/shifts/[id]`** answers 200, or 404 when the shift is gone.
  - **`POST /api/timeclock/staff`** takes `{ name, pin }`.
    - 201: `data: BoardRow`.
    - 400: a bad name, a PIN that is not 4 digits, or "That's the manager PIN. Choose another."
    - 409: the name or the PIN is taken.
  - **`PATCH /api/timeclock/staff/[id]`** takes `{ pin }`. It answers 200; 400; 404 when they were removed already; or 409 when the PIN is taken.
  - **`DELETE /api/timeclock/staff/[id]`** answers 200, 404, or 409 "X is on shift. Clock them out first."

- [ ] **Step 1: Write the three failing tests**

`app/api/timeclock/shifts/[id]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { requirePosAuth, editShift, deleteShift } = vi.hoisted(() => ({ requirePosAuth: vi.fn(), editShift: vi.fn(), deleteShift: vi.fn() }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/lib/timeclock/store', () => ({ editShift, deleteShift }))

import { DELETE, PATCH } from './route'

const url = (id: string) => `http://pos.test/api/timeclock/shifts/${id}`
const context = (id: string) => ({ params: Promise.resolve({ id }) })
const patch = (id: string, body: unknown) =>
  PATCH(new NextRequest(url(id), { method: 'PATCH', body: typeof body === 'string' ? body : JSON.stringify(body) }), context(id))
const remove = (id: string) => DELETE(new NextRequest(url(id), { method: 'DELETE' }), context(id))
const times = { clockIn: '2026-10-14T23:44:00.000Z', clockOut: '2026-10-15T07:46:00.000Z' }

beforeEach(() => {
  vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token')
  requirePosAuth.mockReset().mockResolvedValue(null)
  editShift.mockReset().mockResolvedValue({ ok: true, shift: { _id: 'shift-1', staffId: 'john', staffName: 'John Reyes', ...times, editedAt: '2026-10-15T12:00:00.000Z' } })
  deleteShift.mockReset().mockResolvedValue(true)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('PATCH /api/timeclock/shifts/[id]', () => {
  it('saves a manager’s fix and logs it', async () => {
    const res = await patch('shift-1', times)
    expect(res.status).toBe(200)
    expect(editShift).toHaveBeenCalledWith('shift-1', times)
    expect(console.info).toHaveBeenCalledWith('Shift edited', { id: 'shift-1', ...times })
  })

  it('keeps an open shift open when the time out is null', async () => {
    await patch('shift-1', { clockIn: times.clockIn, clockOut: null })
    expect(editShift).toHaveBeenCalledWith('shift-1', { clockIn: times.clockIn, clockOut: null })
  })

  it('passes on why the times were refused, such as an overlap', async () => {
    editShift.mockResolvedValue({ ok: false, problem: 'invalid', message: 'That overlaps their shift from Thu, Oct 15, 4:00 PM.' })
    const res = await patch('shift-1', times)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('That overlaps their shift from Thu, Oct 15, 4:00 PM.')
  })

  it('answers 404 for a deleted shift and 409 for one changed on another device', async () => {
    editShift.mockResolvedValueOnce({ ok: false, problem: 'gone' }).mockResolvedValueOnce({ ok: false, problem: 'changed' })
    expect((await patch('shift-1', times)).status).toBe(404)
    expect((await patch('shift-1', times)).status).toBe(409)
  })

  it('refuses times that are missing or not UTC, a bad id, and a body that is not JSON', async () => {
    for (const body of [{}, { clockIn: times.clockIn }, { clockIn: '2026-10-15 09:00', clockOut: null }, { clockIn: times.clockIn, clockOut: 'later' }, 'not json']) {
      expect((await patch('shift-1', body)).status).toBe(400)
    }
    expect((await patch('drafts.shift-1', times)).status).toBe(400)
    expect(editShift).not.toHaveBeenCalled()
  })

  it('needs the POS session', async () => {
    requirePosAuth.mockResolvedValue(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    expect((await patch('shift-1', times)).status).toBe(401)
    expect(editShift).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/timeclock/shifts/[id]', () => {
  it('deletes the shift, and says when it was gone already', async () => {
    expect((await remove('shift-1')).status).toBe(200)
    expect(deleteShift).toHaveBeenCalledWith('shift-1')
    deleteShift.mockResolvedValue(false)
    expect((await remove('shift-1')).status).toBe(404)
  })

  it('refuses an id that is not a document id', async () => {
    expect((await remove('drafts.shift-1')).status).toBe(400)
    expect(deleteShift).not.toHaveBeenCalled()
  })
})
```

`app/api/timeclock/staff/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { requirePosAuth, addStaff } = vi.hoisted(() => ({ requirePosAuth: vi.fn(), addStaff: vi.fn() }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/lib/timeclock/store', () => ({ addStaff }))

import { POST } from './route'
import { hashStaffPin } from '@/lib/timeclock/pins'

const SECRET = 'test-secret-that-is-long-enough-1234'
const post = (body: unknown) => POST(new NextRequest('http://pos.test/api/timeclock/staff', {
  method: 'POST',
  body: typeof body === 'string' ? body : JSON.stringify(body),
}))

beforeEach(() => {
  vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token')
  vi.stubEnv('STAFF_PIN_SECRET', SECRET)
  vi.stubEnv('POS_PIN', '2468')
  requirePosAuth.mockReset().mockResolvedValue(null)
  addStaff.mockReset().mockImplementation(async (name: string) => ({ ok: true, row: { staffId: 'new-id', name, hasPin: true, openShift: null } }))
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('POST /api/timeclock/staff', () => {
  it('puts the name, cleaned up, on the time clock with its PIN’s fingerprint', async () => {
    const res = await post({ name: '  Ana   Cruz ', pin: '3333' })
    expect(res.status).toBe(201)
    expect(addStaff).toHaveBeenCalledWith('Ana Cruz', hashStaffPin('3333', SECRET))
    expect((await res.json()).data).toEqual({ staffId: 'new-id', name: 'Ana Cruz', hasPin: true, openShift: null })
  })

  it('refuses a bad name, a PIN that is not four digits, and the manager PIN', async () => {
    const short = await post({ name: 'A', pin: '3333' })
    expect((await short.json()).error).toBe('Enter a name: 2 to 60 characters.')
    const pin = await post({ name: 'Ana Cruz', pin: '33' })
    expect((await pin.json()).error).toBe('A PIN is 4 digits.')
    const manager = await post({ name: 'Ana Cruz', pin: '2468' })
    expect(manager.status).toBe(400)
    expect((await manager.json()).error).toBe("That's the manager PIN. Choose another.")
    expect((await post('not json')).status).toBe(400)
    expect(addStaff).not.toHaveBeenCalled()
  })

  it('answers 409 when the name or the PIN is someone else’s already', async () => {
    addStaff.mockResolvedValueOnce({ ok: false, problem: 'duplicate' }).mockResolvedValueOnce({ ok: false, problem: 'pin-taken' })
    const name = await post({ name: 'Ana Cruz', pin: '3333' })
    expect(name.status).toBe(409)
    expect((await name.json()).error).toBe('Ana Cruz is already on the time clock.')
    const pin = await post({ name: 'Ana Santos', pin: '2222' })
    expect((await pin.json()).error).toBe('Someone else has that PIN. Choose another.')
  })

  it('stops until STAFF_PIN_SECRET is set, and needs the POS session', async () => {
    vi.stubEnv('STAFF_PIN_SECRET', '')
    expect((await post({ name: 'Ana Cruz', pin: '3333' })).status).toBe(500)
    vi.stubEnv('STAFF_PIN_SECRET', SECRET)
    requirePosAuth.mockResolvedValue(NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }))
    expect((await post({ name: 'Ana Cruz', pin: '3333' })).status).toBe(401)
    expect(addStaff).not.toHaveBeenCalled()
  })
})
```

`app/api/timeclock/staff/[id]/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const { requirePosAuth, removeStaff, setStaffPin } = vi.hoisted(() => ({ requirePosAuth: vi.fn(), removeStaff: vi.fn(), setStaffPin: vi.fn() }))
vi.mock('@/lib/requirePosAuth', () => ({ requirePosAuth }))
vi.mock('@/lib/timeclock/store', () => ({ removeStaff, setStaffPin }))

import { DELETE, PATCH } from './route'
import { hashStaffPin } from '@/lib/timeclock/pins'

const SECRET = 'test-secret-that-is-long-enough-1234'
const url = (id: string) => `http://pos.test/api/timeclock/staff/${id}`
const context = (id: string) => ({ params: Promise.resolve({ id }) })
const patch = (id: string, body: unknown) =>
  PATCH(new NextRequest(url(id), { method: 'PATCH', body: typeof body === 'string' ? body : JSON.stringify(body) }), context(id))
const remove = (id: string) => DELETE(new NextRequest(url(id), { method: 'DELETE' }), context(id))
const signedOut = () => NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

beforeEach(() => {
  vi.stubEnv('SANITY_API_WRITE_TOKEN', 'test-token')
  vi.stubEnv('STAFF_PIN_SECRET', SECRET)
  vi.stubEnv('POS_PIN', '2468')
  requirePosAuth.mockReset().mockResolvedValue(null)
  removeStaff.mockReset().mockResolvedValue({ ok: true, name: 'Ana Cruz' })
  setStaffPin.mockReset().mockResolvedValue({ ok: true, name: 'Ana Cruz' })
  vi.spyOn(console, 'info').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('PATCH /api/timeclock/staff/[id]', () => {
  it('gives them a new PIN, stored as its fingerprint', async () => {
    expect((await patch('ana', { pin: '4321' })).status).toBe(200)
    expect(setStaffPin).toHaveBeenCalledWith('ana', hashStaffPin('4321', SECRET))
  })

  it('refuses a PIN that is not four digits, the manager PIN, and a bad id', async () => {
    expect((await patch('ana', { pin: '43' })).status).toBe(400)
    const manager = await patch('ana', { pin: '2468' })
    expect((await manager.json()).error).toBe("That's the manager PIN. Choose another.")
    expect((await patch('drafts.ana', { pin: '4321' })).status).toBe(400)
    expect(setStaffPin).not.toHaveBeenCalled()
  })

  it('answers 409 for a PIN someone else has, and 404 for someone removed', async () => {
    setStaffPin.mockResolvedValueOnce({ ok: false, problem: 'pin-taken' }).mockResolvedValueOnce({ ok: false, problem: 'gone' })
    const taken = await patch('ana', { pin: '2222' })
    expect(taken.status).toBe(409)
    expect((await taken.json()).error).toBe('Someone else has that PIN. Choose another.')
    expect((await patch('ana', { pin: '4321' })).status).toBe(404)
  })

  it('needs the POS session', async () => {
    requirePosAuth.mockResolvedValue(signedOut())
    expect((await patch('ana', { pin: '4321' })).status).toBe(401)
    expect(setStaffPin).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/timeclock/staff/[id]', () => {
  it('takes them off the time clock', async () => {
    expect((await remove('ana')).status).toBe(200)
    expect(removeStaff).toHaveBeenCalledWith('ana')
  })

  it('refuses while they are on shift, and says what to do', async () => {
    removeStaff.mockResolvedValue({ ok: false, problem: 'on-shift', name: 'John Reyes' })
    const res = await remove('john')
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('John Reyes is on shift. Clock them out first.')
  })

  it('answers 404 when they were removed already, and 400 for an id that is not a document id', async () => {
    removeStaff.mockResolvedValue({ ok: false, problem: 'gone' })
    expect((await remove('ana')).status).toBe(404)
    expect((await remove('drafts.ana')).status).toBe(400)
  })

  it('needs the POS session', async () => {
    requirePosAuth.mockResolvedValue(signedOut())
    expect((await remove('ana')).status).toBe(401)
    expect(removeStaff).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run app/api/timeclock/shifts app/api/timeclock/staff`
Expected: FAIL. All three files fail with `Failed to resolve import "./route"`.

- [ ] **Step 3: Write the three routes**

`app/api/timeclock/shifts/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { isDocId, readInstant } from '@/lib/timeclock/rules'
import { deleteShift, editShift } from '@/lib/timeclock/store'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const misconfigured = () => NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
const badId = () => NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
const gone = () => NextResponse.json({ success: false, error: 'That shift was deleted already.' }, { status: 404 })

// A manager's fix to a shift from Records: { clockIn, clockOut }, with clockOut null to keep an
// open shift open. Like menu editing, the manager PIN is asked on the POS; this route, like the
// menu routes, takes any signed-in POS.
export async function PATCH(request: NextRequest, { params }: Params) {
  const authError = await requirePosAuth()
  if (authError) return authError
  if (!process.env.SANITY_API_WRITE_TOKEN) return misconfigured()

  const { id } = await params
  if (!isDocId(id)) return badId()

  let body: Record<string, unknown>
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }
  const clockIn = readInstant(body.clockIn)
  const clockOut = body.clockOut === null ? null : readInstant(body.clockOut)
  if (clockIn === null || (body.clockOut !== null && clockOut === null)) {
    return NextResponse.json({ success: false, error: 'Send the time in, and the time out or null.' }, { status: 400 })
  }

  try {
    const result = await editShift(id, { clockIn, clockOut })
    if (result.ok) {
      console.info('Shift edited', { id, clockIn, clockOut })
      return NextResponse.json({ success: true, data: result.shift })
    }
    if (result.problem === 'gone') return gone()
    if (result.problem === 'changed') {
      return NextResponse.json({ success: false, error: 'This shift changed on another device. Check it and try again.' }, { status: 409 })
    }
    return NextResponse.json({ success: false, error: result.message }, { status: 400 })
  } catch (error) {
    console.error('Shift could not be edited', error)
    return NextResponse.json({ success: false, error: 'Failed to save the shift.' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const authError = await requirePosAuth()
  if (authError) return authError
  if (!process.env.SANITY_API_WRITE_TOKEN) return misconfigured()

  const { id } = await params
  if (!isDocId(id)) return badId()

  try {
    if (!(await deleteShift(id))) return gone()
    console.info('Shift deleted', { id })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Shift could not be deleted', error)
    return NextResponse.json({ success: false, error: 'Failed to delete the shift.' }, { status: 500 })
  }
}
```

`app/api/timeclock/staff/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { hasStaffPinSecret, hashStaffPin, staffPinRefusal } from '@/lib/timeclock/pins'
import { cleanStaffName, staffNameProblem } from '@/lib/timeclock/rules'
import { addStaff } from '@/lib/timeclock/store'

export const dynamic = 'force-dynamic'

// Putting someone on the time clock, from the Manager page: { name, pin }. The manager PIN is
// asked on that page.
export async function POST(request: NextRequest) {
  const authError = await requirePosAuth()
  if (authError) return authError

  if (!process.env.SANITY_API_WRITE_TOKEN || !hasStaffPinSecret()) {
    return NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? cleanStaffName(body.name) : ''
  const problem = staffNameProblem(name) ?? staffPinRefusal(body.pin)
  if (problem) return NextResponse.json({ success: false, error: problem }, { status: 400 })

  try {
    const result = await addStaff(name, hashStaffPin(body.pin as string))
    if (!result.ok) {
      const error = result.problem === 'duplicate' ? `${name} is already on the time clock.` : 'Someone else has that PIN. Choose another.'
      return NextResponse.json({ success: false, error }, { status: 409 })
    }
    console.info('Staff added to the time clock', { id: result.row.staffId })
    return NextResponse.json({ success: true, data: result.row }, { status: 201 })
  } catch (error) {
    console.error('Staff could not be added to the time clock', error)
    return NextResponse.json({ success: false, error: 'Failed to add them.' }, { status: 500 })
  }
}
```

`app/api/timeclock/staff/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { requirePosAuth } from '@/lib/requirePosAuth'
import { hasStaffPinSecret, hashStaffPin, staffPinRefusal } from '@/lib/timeclock/pins'
import { isDocId } from '@/lib/timeclock/rules'
import { removeStaff, setStaffPin } from '@/lib/timeclock/store'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

const misconfigured = () => NextResponse.json({ success: false, error: 'Server misconfiguration' }, { status: 500 })
const badId = () => NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 })
const gone = () => NextResponse.json({ success: false, error: 'They are off the time clock already.' }, { status: 404 })

// A new PIN for someone, from the Manager page: { pin }. Nobody can read a PIN back, so a
// forgotten one is replaced here.
export async function PATCH(request: NextRequest, { params }: Params) {
  const authError = await requirePosAuth()
  if (authError) return authError
  if (!process.env.SANITY_API_WRITE_TOKEN || !hasStaffPinSecret()) return misconfigured()

  const { id } = await params
  if (!isDocId(id)) return badId()

  let body: Record<string, unknown>
  try {
    body = ((await request.json()) ?? {}) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }
  const problem = staffPinRefusal(body.pin)
  if (problem) return NextResponse.json({ success: false, error: problem }, { status: 400 })

  try {
    const result = await setStaffPin(id, hashStaffPin(body.pin as string))
    if (result.ok) {
      console.info('Staff PIN changed', { id })
      return NextResponse.json({ success: true })
    }
    if (result.problem === 'gone') return gone()
    return NextResponse.json({ success: false, error: 'Someone else has that PIN. Choose another.' }, { status: 409 })
  } catch (error) {
    console.error('Staff PIN could not be changed', error)
    return NextResponse.json({ success: false, error: 'Failed to change the PIN.' }, { status: 500 })
  }
}

// Taking someone off the time clock, from the Manager page. Their shifts stay; someone on shift
// has to clock out first, so no shift is left open with nobody to close it.
export async function DELETE(_request: NextRequest, { params }: Params) {
  const authError = await requirePosAuth()
  if (authError) return authError
  if (!process.env.SANITY_API_WRITE_TOKEN) return misconfigured()

  const { id } = await params
  if (!isDocId(id)) return badId()

  try {
    const result = await removeStaff(id)
    if (result.ok) {
      console.info('Staff removed from the time clock', { id })
      return NextResponse.json({ success: true })
    }
    if (result.problem === 'gone') return gone()
    return NextResponse.json({ success: false, error: `${result.name} is on shift. Clock them out first.` }, { status: 409 })
  } catch (error) {
    console.error('Staff could not be removed from the time clock', error)
    return NextResponse.json({ success: false, error: 'Failed to remove them.' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run app/api/timeclock lib/timeclock`
Expected: PASS, 94 tests.

### Task 6: POS helpers

**Files:**
- Create:
  - `app/pos/timeclock/sendTimeClock.ts`, `app/pos/timeclock/latestOnly.ts`, `app/pos/timeclock/useNow.ts`;
  - `app/pos/menuHandoff.ts`, `app/pos/useIdleLock.ts`, `app/pos/PageChrome.tsx`.
- Modify: `app/pos/navigation.ts`
- Test: `app/pos/timeclock/sendTimeClock.test.ts`, `app/pos/timeclock/latestOnly.test.ts`, `app/pos/navigation.test.ts`, `app/pos/menuHandoff.test.ts`

**Interfaces:**
- Consumes: `BoardRow`, `MyHours` and `TimeShift` (Task 2), `IsoRange` (Task 1), the routes (Tasks 4 and 5), and `watchIdle` (`app/pos/watchIdle.ts`).
- Produces:
  - **Sending and reading** (`sendTimeClock.ts`):
    - `TIME_CLOCK_MESSAGES`;
    - `sendTimeClock<T>(url, method, body?, fetchImpl?)`, which resolves to `{ message; data?; unsure?; gone? }`;
    - `readMyHours(pin, range, fetchImpl?)`;
    - `interface TimeClockData { board; shifts }`;
    - `readTimeClock(range?, fetchImpl?)`, which resolves to `TimeClockData | null` and never throws.
  - **Keeping the latest read:** `latestOnly(read)`.
  - **Ticking:** `useNow(everyMs = 1000)`.
  - **Leaving the POS:** `LEAVE_ORDER_MESSAGE` and `openPosPage(path, itemCount, confirmLeave?, go?): boolean`.
  - **The menu hand-off:** `HANDOFF_MS`, `handOffMenuEditing(storage?, now?)` and `takeMenuEditing(storage?, now?): boolean`.
  - **Idle lock:** `MANAGER_IDLE_LOCK_MS` and `useIdleLock(active, lock, ms?)`.
  - **Page chrome:** `PageHeader({ title, note?, children? })` and `PageTabs({ label, tabs, value, onChange })`.

- [ ] **Step 1: Write the failing tests**

`app/pos/timeclock/sendTimeClock.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { TIME_CLOCK_MESSAGES, readMyHours, readTimeClock, sendTimeClock } from './sendTimeClock'

const reply = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe('sendTimeClock', () => {
  it('sends the change as JSON and gives back the saved data', async () => {
    const fetchImpl = reply(201, { success: true, data: { _id: 'shift-1' } })
    const result = await sendTimeClock('/api/timeclock', 'POST', { staffId: 'john', action: 'in' }, fetchImpl)
    expect(result).toEqual({ message: null, data: { _id: 'shift-1' } })
    expect(fetchImpl).toHaveBeenCalledWith('/api/timeclock', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"staffId":"john","action":"in"}',
    })
  })

  it('shows the route’s own reason, such as someone already clocked in', async () => {
    const result = await sendTimeClock('/api/timeclock', 'POST', {}, reply(409, { success: false, error: 'John Reyes is already clocked in.' }))
    expect(result).toEqual({ message: 'John Reyes is already clocked in.' })
  })

  it('marks a 404 as gone, so a shift deleted elsewhere counts as deleted', async () => {
    const result = await sendTimeClock('/api/timeclock/shifts/s1', 'DELETE', undefined, reply(404, { success: false, error: 'That shift was deleted already.' }))
    expect(result).toEqual({ message: 'That shift was deleted already.', gone: true })
  })

  it('says signed out on a 401, unsure when no reply came, and failed on a stranger’s reply', async () => {
    expect(await sendTimeClock('/x', 'DELETE', undefined, reply(401, {}))).toEqual({ message: TIME_CLOCK_MESSAGES.signedOut })
    const offline = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    expect(await sendTimeClock('/x', 'DELETE', undefined, offline)).toEqual({ message: TIME_CLOCK_MESSAGES.noReply, unsure: true })
    const gateway = vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 }))
    expect(await sendTimeClock('/x', 'DELETE', undefined, gateway)).toEqual({ message: TIME_CLOCK_MESSAGES.failed })
  })
})

describe('readMyHours', () => {
  it('sends the PIN in the body, never in the URL', async () => {
    const fetchImpl = reply(200, { success: true, data: { name: 'John Reyes', openShift: null, shifts: [] } })
    const result = await readMyHours('2222', { from: '2026-10-11T16:00:00.000Z', to: '2026-10-18T16:00:00.000Z' }, fetchImpl)
    expect(result).toEqual({ message: null, data: { name: 'John Reyes', openShift: null, shifts: [] } })
    expect(fetchImpl).toHaveBeenCalledWith('/api/timeclock/mine', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"pin":"2222","from":"2026-10-11T16:00:00.000Z","to":"2026-10-18T16:00:00.000Z"}',
    })
  })
})

describe('readTimeClock', () => {
  const data = { board: [{ staffId: 'john', name: 'John Reyes', openShift: null }], shifts: [] }

  it('reads the staff and the shifts in the range', async () => {
    const fetchImpl = reply(200, { success: true, data })
    expect(await readTimeClock({ from: '2026-10-04T16:00:00.000Z', to: '2026-10-18T16:00:00.000Z' }, fetchImpl)).toEqual(data)
    expect((fetchImpl.mock.calls[0] as unknown[])[0]).toBe('/api/timeclock?from=2026-10-04T16%3A00%3A00.000Z&to=2026-10-18T16%3A00%3A00.000Z')
  })

  it('reads the staff alone when no range is given', async () => {
    const fetchImpl = reply(200, { success: true, data })
    await readTimeClock(undefined, fetchImpl)
    expect((fetchImpl.mock.calls[0] as unknown[])[0]).toBe('/api/timeclock')
  })

  it('gives null, never throws, when the read fails or the reply is not the time clock', async () => {
    expect(await readTimeClock(undefined, reply(500, { success: false }))).toBeNull()
    expect(await readTimeClock(undefined, reply(200, { success: true, data: { board: 'x' } }))).toBeNull()
    expect(await readTimeClock(undefined, vi.fn(async () => { throw new TypeError('Failed to fetch') }))).toBeNull()
  })
})
```

`app/pos/timeclock/latestOnly.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { latestOnly } from './latestOnly'

// A read whose answer the test hands over when it chooses.
function deferredRead() {
  const pending: (() => void)[] = []
  const read = (label: string) => new Promise<string>(resolve => pending.push(() => resolve(label)))
  return { read, answer: (index: number) => pending[index]() }
}

describe('latestOnly', () => {
  it('drops an earlier read that answers after a later one', async () => {
    const { read, answer } = deferredRead()
    const latest = latestOnly(read)
    const first = latest('after John clocked in')
    const second = latest('after Ana clocked in')
    answer(1)
    answer(0)
    expect(await second).toEqual({ latest: true, value: 'after Ana clocked in' })
    expect(await first).toEqual({ latest: false })
  })

  it('uses each read when they answer in order', async () => {
    const latest = latestOnly(async (n: number) => n * 2)
    expect(await latest(1)).toEqual({ latest: true, value: 2 })
    expect(await latest(2)).toEqual({ latest: true, value: 4 })
  })
})
```

`app/pos/navigation.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { LEAVE_ORDER_MESSAGE, openPosPage } from './navigation'

describe('openPosPage', () => {
  it('goes straight there when no order is on screen', () => {
    const ask = vi.fn(() => true)
    const go = vi.fn()
    expect(openPosPage('/pos/timeclock', 0, ask, go)).toBe(true)
    expect(ask).not.toHaveBeenCalled()
    expect(go).toHaveBeenCalledWith('/pos/timeclock')
  })

  it('asks first when the order on screen would be lost, and stays when told to', () => {
    const go = vi.fn()
    expect(openPosPage('/pos/manager', 2, () => false, go)).toBe(false)
    expect(go).not.toHaveBeenCalled()
    const ask = vi.fn(() => true)
    expect(openPosPage('/pos/manager', 2, ask, go)).toBe(true)
    expect(ask).toHaveBeenCalledWith(LEAVE_ORDER_MESSAGE)
    expect(go).toHaveBeenCalledWith('/pos/manager')
  })
})
```

`app/pos/menuHandoff.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { HANDOFF_MS, handOffMenuEditing, takeMenuEditing } from './menuHandoff'

// A stand-in for sessionStorage.
function memoryStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    size: () => items.size,
  }
}

describe('the menu editing hand-over', () => {
  it('turns editing on for the next POS load only', () => {
    const storage = memoryStorage()
    handOffMenuEditing(storage, 1000)
    expect(takeMenuEditing(storage, 1500)).toBe(true)
    expect(takeMenuEditing(storage, 1600)).toBe(false)
    expect(storage.size()).toBe(0)
  })

  it('lapses when the POS loads too late, and is used up anyway', () => {
    const storage = memoryStorage()
    handOffMenuEditing(storage, 1000)
    expect(takeMenuEditing(storage, 1000 + HANDOFF_MS)).toBe(false)
    expect(storage.size()).toBe(0)
  })

  it('keeps the POS locked when nothing was handed over, or storage is refused', () => {
    expect(takeMenuEditing(memoryStorage(), 1000)).toBe(false)
    const refusing = { getItem: () => { throw new Error('denied') }, removeItem: () => {}, setItem: () => { throw new Error('denied') } }
    expect(() => handOffMenuEditing(refusing, 1000)).not.toThrow()
    expect(takeMenuEditing(refusing, 1000)).toBe(false)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run app/pos/timeclock app/pos/navigation.test.ts app/pos/menuHandoff.test.ts`
Expected: FAIL. `sendTimeClock`, `latestOnly` and `menuHandoff` fail to resolve. `navigation.test.ts` fails with `openPosPage is not a function`.

- [ ] **Step 3: Write the time clock helpers**

`app/pos/timeclock/sendTimeClock.ts`:

```ts
import type { BoardRow, MyHours, TimeShift } from '@/lib/timeclock/rules'
import type { IsoRange } from '@/lib/timeclock/time'

/** What the time clock says when a change did not go through. */
export const TIME_CLOCK_MESSAGES = {
  signedOut: 'Signed out. Reload the page.',
  // The change may have been saved before the reply was lost; the time clock is read again to show it.
  noReply: 'No reply. Check the list before trying again.',
  // The reply was not the POS's own, such as a gateway error page.
  failed: 'The server could not be reached. Try again.',
} as const

export interface TimeClockReply<T> {
  /** null when the change was saved, else what to show. */
  message: string | null
  data?: T
  /** No reply came, so the change may or may not have been saved. */
  unsure?: true
  /** The server has no such shift or person: deleted or removed already, on another device say. */
  gone?: true
}

/** Sends one change: a clock in or out, a shift fixed or deleted, someone added or removed. */
export async function sendTimeClock<T = unknown>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<TimeClockReply<T>> {
  let res: Response
  try {
    res = await fetchImpl(url, body
      ? { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { method })
  } catch {
    return { message: TIME_CLOCK_MESSAGES.noReply, unsure: true }
  }
  const json = (await res.json().catch(() => null)) as { success?: unknown; error?: unknown; data?: unknown } | null
  if (res.ok && json?.success === true) return { message: null, data: json.data as T }
  if (res.status === 401) return { message: TIME_CLOCK_MESSAGES.signedOut }
  // Anything else: the route's own reason when there is one, such as "Incorrect PIN. Try again."
  const reason = typeof json?.error === 'string' && json.error ? json.error : null
  if (res.status === 404 && reason) return { message: reason, gone: true }
  return { message: reason ?? TIME_CLOCK_MESSAGES.failed }
}

/** One person's own hours in `range`, by their PIN: My records on the Time clock page. */
export function readMyHours(pin: string, range: IsoRange, fetchImpl: typeof fetch = fetch): Promise<TimeClockReply<MyHours>> {
  return sendTimeClock<MyHours>('/api/timeclock/mine', 'POST', { pin, from: range.from, to: range.to }, fetchImpl)
}

export interface TimeClockData {
  board: BoardRow[]
  /** The shifts that began in the range asked for; none when no range was asked for. */
  shifts: TimeShift[]
}

/** How long a read may take: the panel says it could not load rather than spin. */
export const READ_TIMEOUT_MS = 6000

/**
 * Everyone on the time clock, plus the shifts that began in `range` when one is given. Never
 * throws: null when the time clock could not be read in time.
 */
export async function readTimeClock(range?: IsoRange, fetchImpl: typeof fetch = fetch): Promise<TimeClockData | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS)
  try {
    const query = range ? `?${new URLSearchParams({ from: range.from, to: range.to })}` : ''
    const res = await fetchImpl(`/api/timeclock${query}`, { cache: 'no-store', signal: controller.signal })
    const json = (await res.json()) as { success?: unknown; data?: Partial<TimeClockData> } | null
    const data = res.ok && json?.success === true ? json.data : undefined
    return data && Array.isArray(data.board) && Array.isArray(data.shifts) ? { board: data.board, shifts: data.shifts } : null
  } catch {
    // The request failed or timed out, or the reply was not JSON.
    return null
  } finally {
    clearTimeout(timer)
  }
}
```

`app/pos/timeclock/latestOnly.ts`:

```ts
export type LatestAnswer<T> = { latest: true; value: T } | { latest: false }

/**
 * Wraps a read so that only the latest call's answer is used. Two people clocking in a second
 * apart each make the panel read the time clock again; if the first read answered last, it
 * would show the second person off the clock again.
 */
export function latestOnly<Args extends unknown[], T>(read: (...args: Args) => Promise<T>): (...args: Args) => Promise<LatestAnswer<T>> {
  let calls = 0
  return async (...args: Args) => {
    const call = ++calls
    const value = await read(...args)
    return call === calls ? { latest: true, value } : { latest: false }
  }
}
```

`app/pos/timeclock/useNow.ts` (no test: it only ticks; the Appendix click-throughs cover it):

```ts
'use client'

import { useEffect, useState } from 'react'

/** The time now, updated every `everyMs` while the component is on screen. Drives the running timers. */
export function useNow(everyMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(timer)
  }, [everyMs])
  return now
}
```

- [ ] **Step 4: Leave the POS only after asking, when an order is on screen**

```diff
--- a/app/pos/navigation.ts
+++ b/app/pos/navigation.ts
@@ -5,3 +5,21 @@
 export function leaveFor(path: string): void {
   window.location.replace(path)
 }
+
+/** What the POS asks before another page takes its place while an order is on screen. */
+export const LEAVE_ORDER_MESSAGE = 'Leave the POS? The order in progress will be cleared.'
+
+/**
+ * Opens another POS page (Time clock, Manager) with a full page load, which clears the order on
+ * screen: with items in it, it asks first, the same way Reload does. Returns whether it went.
+ */
+export function openPosPage(
+  path: string,
+  itemCount: number,
+  confirmLeave: (message: string) => boolean = message => window.confirm(message),
+  go: (target: string) => void = target => window.location.assign(target),
+): boolean {
+  if (itemCount > 0 && !confirmLeave(LEAVE_ORDER_MESSAGE)) return false
+  go(path)
+  return true
+}
```

- [ ] **Step 5: Write the menu hand-off, the idle lock and the page chrome**

`app/pos/menuHandoff.ts`:

```ts
// "Edit the menu" on the Manager page hands menu editing over to the POS for the next page load
// in this tab, so the manager doesn't type the PIN twice. Like manager mode itself, this is a
// screen-side gate: the menu routes take any signed-in POS.

const KEY = 'unwnd.pos.editMenu'
/** The hand-over is good for this long: the /pos page load follows straight away. */
export const HANDOFF_MS = 30 * 1000

/** Marks this tab's next /pos load to start with menu editing on. */
export function handOffMenuEditing(storage: Pick<Storage, 'setItem'> = sessionStorage, now: number = Date.now()): void {
  try {
    storage.setItem(KEY, String(now))
  } catch {
    // Storage refused (a private window): the POS then starts locked, as it always did.
  }
}

/** Read once by the POS on load: whether menu editing was just handed over. The mark is used up either way. */
export function takeMenuEditing(storage: Pick<Storage, 'getItem' | 'removeItem'> = sessionStorage, now: number = Date.now()): boolean {
  try {
    const at = Number(storage.getItem(KEY))
    storage.removeItem(KEY)
    return at > 0 && now >= at && now - at < HANDOFF_MS
  } catch {
    return false
  }
}
```

`app/pos/useIdleLock.ts`, the POS's own idle-lock effect moved into a hook so the Manager page and My records share it (no test of its own: `watchIdle` has tests, and Task 9 swaps the POS onto it):

```ts
'use client'

import { useEffect } from 'react'
import { watchIdle } from './watchIdle'

/** Manager mode, on the POS and on the Manager page, locks itself after this long with no tap or key press. */
export const MANAGER_IDLE_LOCK_MS = 2 * 60 * 1000

/**
 * While `active`, calls `lock` after `ms` with no tap or key press, or as soon as the screen goes
 * off or another app comes forward, so an unlocked screen is never left behind. `lock` should be
 * stable (useCallback).
 */
export function useIdleLock(active: boolean, lock: () => void, ms: number = MANAGER_IDLE_LOCK_MS): void {
  useEffect(() => {
    if (!active) return
    const stopWatching = watchIdle(window, ms, lock)
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') lock()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      stopWatching()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [active, lock, ms])
}
```

`app/pos/PageChrome.tsx`:

```tsx
import type { ReactNode } from 'react'

interface PageHeaderProps {
  /** The page's wordmark, such as "unwnd. time clock". */
  title: string
  /** A small line beside it on wider screens, such as today's date. */
  note?: string
  /** Controls placed before ← POS, such as the Manager page's Lock. */
  children?: ReactNode
}

// The header of the pages the POS header opens (Time clock, Manager), the same as Sales: the
// wordmark, and ← POS back to the till with a full page load.
export function PageHeader({ title, note, children }: PageHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3 bg-foreground px-6 py-4">
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="font-logo text-2xl lowercase tracking-tight text-cream">{title}</span>
        {note && <span className="hidden text-[10px] uppercase tracking-[0.25em] text-cream/40 sm:inline" suppressHydrationWarning>{note}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {children}
        <a href="/pos" className="text-xs uppercase tracking-[0.2em] text-cream/50 transition-colors hover:text-cream">
          ← POS
        </a>
      </div>
    </header>
  )
}

export interface PageTab<T extends string> {
  key: T
  label: ReactNode
}

interface PageTabsProps<T extends string> {
  /** What the tabs switch between, for screen readers. */
  label: string
  tabs: readonly PageTab<T>[]
  value: T
  onChange: (key: T) => void
}

/** A row of tabs styled like Sales' views: the picked one dark green. */
export function PageTabs<T extends string>({ label, tabs, value, onChange }: PageTabsProps<T>) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg bg-foreground/6 p-1">
      {tabs.map(tab => (
        <button
          key={tab.key}
          type="button"
          aria-pressed={value === tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
            value === tab.key ? 'bg-foreground text-cream shadow-sm' : 'text-foreground/55 hover:bg-white/70 hover:text-foreground'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Run them to see them pass**

Run: `npx vitest run app/pos/timeclock app/pos/navigation.test.ts app/pos/menuHandoff.test.ts`
Expected: PASS, 15 tests.

### Task 7: The Time clock page

**Files:**
- Create: `app/pos/timeclock/PadCard.tsx`, `app/pos/timeclock/PinDialog.tsx`, `app/pos/timeclock/ClockView.tsx`, `app/pos/timeclock/MyRecordsView.tsx`, `app/pos/timeclock/TimeClockClient.tsx`, `app/pos/timeclock/page.tsx`
- Test: `app/pos/timeclock/TimeClock.test.tsx`

**Interfaces:**
- Consumes:
  - `PinPad` (`app/pos/PinPad.tsx`; `onComplete(pin) => Promise<string | null>`, which locks its keys after an accepted PIN);
  - Task 6's helpers;
  - the rules and time writers (Tasks 1 and 2);
  - `ActionButton`, `Badge`, `EmptyState`, `ErrorBanner` and `Skeleton` from `app/pos/sales/ui.tsx`.
- Produces:
  - `ClockView({ now })`, `ClockRow({ row, now, onTap })` and `punchLine(punch)`;
  - `NOTICE_MS` and `NO_REPLY_PUNCH`;
  - `PinDialog({ title, name, note, onPin, onClose })`;
  - `MyRecordsView({ now })`, `MyRecordsCard(props)`, `RecordsTable({ shifts, now })` and `MY_RECORDS_IDLE_MS`;
  - `TimeClockClient()`, and the page at `/pos/timeclock`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { BoardRow, MyHours, TimeShift } from '@/lib/timeclock/rules'
import ClockView, { ClockRow, punchLine, type Punch } from './ClockView'
import { MyRecordsCard, RecordsTable } from './MyRecordsView'
import PinDialog from './PinDialog'
import TimeClockClient from './TimeClockClient'

const NOW = Date.parse('2026-10-15T04:12:05Z') // Thu, Oct 15, 12:12:05 PM in Manila
const noop = () => {}
const done = async () => null

const shift = (over: Partial<TimeShift> = {}): TimeShift => ({
  _id: 's1', staffId: 'john', staffName: 'John Reyes', clockIn: '2026-10-15T01:58:00Z', clockOut: null, editedAt: null, ...over,
})
const john: BoardRow = { staffId: 'john', name: 'John Reyes', hasPin: true, openShift: { _id: 's1', clockIn: '2026-10-15T01:58:00Z' } }
const ana: BoardRow = { staffId: 'ana', name: 'Ana Cruz', hasPin: true, openShift: null }
const row = (r: BoardRow) => renderToStaticMarkup(<ClockRow row={r} now={NOW} onTap={noop} />)

describe('the Time clock page', () => {
  it('opens on Clock in or out, with My records beside it and the way back to the POS', () => {
    const html = renderToStaticMarkup(<TimeClockClient />)
    expect(html).toContain('unwnd. time clock')
    expect(html).toContain('href="/pos"')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Clock in or out</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>My records</)
  })

  it('waits for the staff list, with the tip for arriving together', () => {
    const html = renderToStaticMarkup(<ClockView now={NOW} />)
    expect(html).toContain('animate-pulse')
    expect(html).toContain('Thursday, October 15')
    expect(html).toContain('12:12:05 PM')
    expect(html).toContain('Arriving together? Each person taps their own button and enters their own PIN, one after the other.')
  })
})

describe('Clock in or out', () => {
  it('shows someone off the clock with Clock in', () => {
    const html = row(ana)
    expect(html).toContain('Ana Cruz')
    expect(html).toContain('Off the clock')
    expect(html).toContain('>Clock in</button>')
  })

  it('shows someone on shift with a running timer and Clock out', () => {
    const html = row(john)
    expect(html).toContain('On shift since 9:58 AM')
    expect(html).toContain('2:14:05')
    expect(html).toContain('>Clock out</button>')
    expect(html).not.toContain('Clock in')
  })

  it('keeps Clock in off for someone with no PIN yet, and says why', () => {
    const html = row({ ...ana, hasPin: false })
    expect(html).toContain('No PIN yet · ask the manager')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Clock in<\/button>/)
  })

  it('flags a shift still open from yesterday and says what to do', () => {
    const html = row({ ...john, openShift: { _id: 'old', clockIn: '2026-10-14T01:51:00Z' } })
    expect(html).toContain('Clocked in since yesterday, 9:51 AM. Clock out now, then ask the manager to set the real time out.')
  })

  it('asks for the PIN of the person tapped', () => {
    const html = renderToStaticMarkup(<PinDialog title="Clock in" name="Ana Cruz" note="Enter your PIN to clock in." onPin={done} onClose={noop} />)
    expect(html).toContain('Clock in')
    expect(html).toContain('Ana Cruz')
    expect(html).toContain('Enter your PIN to clock in.')
    expect(html.match(/data-pin-dot/g)).toHaveLength(4)
    expect(html).toContain('aria-label="Close"')
  })

  it('says who clocked in or out, and when, including a repeat', () => {
    const punch = (over: Partial<Punch> = {}): Punch => ({ action: 'in', name: 'John Reyes', shift: shift(), repeat: false, ...over })
    expect(punchLine(punch())).toBe('John Reyes clocked in at 9:58 AM.')
    expect(punchLine(punch({ repeat: true }))).toBe('John Reyes was already clocked in, since 9:58 AM.')
    const out = shift({ clockOut: '2026-10-15T10:02:00Z' })
    expect(punchLine(punch({ action: 'out', shift: out }))).toBe('John Reyes clocked out at 6:02 PM · 8h 04m on this shift.')
    expect(punchLine(punch({ action: 'out', shift: out, repeat: true }))).toBe('John Reyes already clocked out at 6:02 PM · 8h 04m on this shift.')
  })
})

describe('My records', () => {
  const records: MyHours = {
    name: 'John Reyes',
    openShift: { _id: 's1', clockIn: '2026-10-15T01:58:00Z' },
    shifts: [
      shift(),
      shift({ _id: 's3', clockIn: '2026-10-13T23:43:00Z', clockOut: '2026-10-14T07:46:00Z', editedAt: '2026-10-14T12:00:00Z' }),
      shift({ _id: 's2', clockIn: '2026-10-11T23:45:00Z', clockOut: '2026-10-12T07:44:00Z' }),
    ],
  }
  const card = (over: Partial<Parameters<typeof MyRecordsCard>[0]> = {}) =>
    renderToStaticMarkup(<MyRecordsCard records={records} period="week" now={NOW} error={null} onPeriod={noop} onDone={noop} {...over} />)

  it('lists each shift on one line, oldest first: the date, time in – time out, and the hours', () => {
    const html = renderToStaticMarkup(<RecordsTable shifts={records.shifts} now={NOW} />)
    expect(html).toContain('>Date<')
    expect(html).toContain('Time in – Time out')
    expect(html).toContain('Total hours')
    const at = (text: string) => html.indexOf(text)
    expect(at('Monday, October 12')).toBeGreaterThan(-1)
    expect(at('Monday, October 12')).toBeLessThan(at('Wednesday, October 14'))
    expect(at('Wednesday, October 14')).toBeLessThan(at('Thursday, October 15'))
    expect(html).toContain('7:45 AM – ')
    expect(html).toContain('3:44 PM')
    expect(html).toContain('7h 59m')
    expect(html).toContain('>Edited</span>')
    expect(html).toContain('on shift')
  })

  it('totals the shifts at the foot', () => {
    const html = renderToStaticMarkup(<RecordsTable shifts={records.shifts} now={NOW} />)
    expect(html).toContain('Total · 3 shifts')
    expect(html).toContain('18h 16m')
  })

  it('shows the person and their running shift, with nothing to edit', () => {
    const html = card()
    expect(html).toContain('John Reyes')
    expect(html).toContain('On shift since 9:58 AM')
    expect(html).toContain('2:14:05')
    expect(html).not.toContain('>Edit</button>')
    expect(html).not.toContain('>Delete</button>')
    expect(html).toContain('>Done</button>')
  })

  it('shows the period picked, why another could not be read, and an empty period', () => {
    const html = card({ period: 'lastweek', error: 'Incorrect PIN. Try again.' })
    expect(html).toMatch(/aria-pressed="true"[^>]*>Last week</)
    expect(html).toContain('Mon, Oct 5 – Sun, Oct 11')
    expect(html).toContain('Incorrect PIN. Try again.')
    expect(card({ records: { name: 'Ana Cruz', openShift: null, shifts: [] } })).toContain('No shifts in this period.')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run app/pos/timeclock/TimeClock.test.tsx`
Expected: FAIL. `Failed to resolve import "./ClockView"`.

- [ ] **Step 3: Write the PIN card and the PIN dialog**

`app/pos/timeclock/PadCard.tsx`, the dark panel My records shows its PIN pad on:

```tsx
import type { ReactNode } from 'react'

interface PadCardProps {
  /** The small capitals line at the top, such as "Enter your PIN". */
  title: string
  /** One plain line under it. */
  note?: string
  /** A quiet line under the keys. */
  hint?: string
  /** The PinPad. */
  children: ReactNode
}

// The POS's dark PIN panel, as on the login screen, holding a PinPad on the Time clock page.
export default function PadCard({ title, note, hint, children }: PadCardProps) {
  return (
    <section aria-label={title} className="w-full max-w-sm rounded-sm bg-foreground px-6 pb-7 pt-5 text-cream shadow-xl">
      <p className="text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-cream/60">{title}</p>
      {note && <p className="mt-1.5 text-center text-xs text-cream/55">{note}</p>}
      <div className="mt-6">{children}</div>
      {hint && <p className="mt-5 text-center text-xs text-cream/45">{hint}</p>}
    </section>
  )
}
```

`app/pos/timeclock/PinDialog.tsx`, one person's PIN over the staff list:

```tsx
'use client'

import { useEffect } from 'react'
import PinPad from '../PinPad'

interface PinDialogProps {
  /** The small capitals line at the top, such as "Clock in". */
  title: string
  /** Whose PIN it asks for. */
  name: string
  /** One line under the name, such as "Enter your PIN to clock in." */
  note: string
  /** Checks the PIN and acts on it: resolves null when done, else the message for the pad. */
  onPin: (pin: string) => Promise<string | null>
  onClose: () => void
}

// One person's PIN, over the Time clock page, before their clock in or out: dark like the POS
// login pad. ✕, the backdrop or Escape closes it.
export default function PinDialog({ title, name, note, onPin, onClose }: PinDialogProps) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-dialog-name"
        className="relative z-50 flex max-h-[90vh] w-full max-w-sm select-none flex-col items-center overflow-y-auto rounded-sm bg-foreground px-6 pb-8 pt-4 text-cream shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between self-stretch">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-cream/60">{title}</p>
          <button
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-xl leading-none text-cream/50 transition-colors hover:bg-cream/10 hover:text-cream"
          >
            ✕
          </button>
        </div>
        <p id="pin-dialog-name" className="text-lg font-semibold">{name}</p>
        <p className="mb-6 mt-1 text-xs text-cream/55">{note}</p>
        <PinPad onComplete={onPin} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Write Clock in or out**

The list reads the board once, then updates the tapped row from the punch's own answer, so two quick punches never race each other's reads. A refusal, or no reply, reads the board again so the buttons catch up.

```tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { startedBeforeToday, type BoardRow, type ClockAction, type TimeShift } from '@/lib/timeclock/rules'
import { formatClock, formatClockSeconds, formatHours, formatLongDay, formatSince, formatTimer } from '@/lib/timeclock/time'
import { ActionButton, EmptyState, ErrorBanner, Skeleton } from '../sales/ui'
import { latestOnly } from './latestOnly'
import PinDialog from './PinDialog'
import { TIME_CLOCK_MESSAGES, readTimeClock, sendTimeClock } from './sendTimeClock'

/** What the punch route answers. */
export interface Punch {
  action: ClockAction
  name: string
  shift: TimeShift
  /** Clocked in already, or clocked out within the last minute: shown again, nothing changed. */
  repeat: boolean
}

/** How long "John Reyes clocked in at 9:58 AM." stays at the top. */
export const NOTICE_MS = 8 * 1000
/** With no reply, the punch may or may not have landed; entering the PIN again can't clock anyone twice. */
export const NO_REPLY_PUNCH = "No reply. Enter your PIN again: it won't clock you twice."

// Clock in or out: everyone on the time clock, each with one button. Tapping it asks for that
// person's PIN; once it is taken, the button turns into the other one. Each person has their own
// button, PIN and shift, so two people arriving together tap one after the other.
export default function ClockView({ now }: { now: number }) {
  const [board, setBoard] = useState<BoardRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [asking, setAsking] = useState<{ row: BoardRow; action: ClockAction } | null>(null)
  const [notice, setNotice] = useState<{ punch: Punch; at: number } | null>(null)
  // Reads started close together: only the last one asked for is shown.
  const read = useMemo(() => latestOnly(() => readTimeClock()), [])

  const load = useCallback(() => read().then(answer => {
    if (!answer.latest) return
    if (answer.value) setBoard(answer.value.board)
    setFailed(answer.value === null)
  }), [read])

  useEffect(() => {
    void load()
  }, [load])

  const closeDialog = useCallback(() => setAsking(null), [])

  async function punch(pin: string): Promise<string | null> {
    if (!asking) return null
    const { row, action } = asking
    const reply = await sendTimeClock<Punch>('/api/timeclock/punch', 'POST', { staffId: row.staffId, action, pin })
    if (reply.unsure) {
      void load()
      return NO_REPLY_PUNCH
    }
    if (reply.message !== null || !reply.data) {
      // Someone removed, or clocked out on another device: the list catches up.
      void load()
      return reply.message ?? TIME_CLOCK_MESSAGES.failed
    }
    const done = reply.data
    const openShift = done.shift.clockOut ? null : { _id: done.shift._id, clockIn: done.shift.clockIn }
    setBoard(rows => rows && rows.map(r => (r.staffId === row.staffId ? { ...r, openShift } : r)))
    setNotice({ punch: done, at: Date.now() })
    setAsking(null)
    return null
  }

  const verb = asking?.action === 'out' ? 'clock out' : 'clock in'
  return (
    <div className="space-y-3">
      {failed && (
        <ErrorBanner
          message={board ? 'Could not refresh the time clock. Showing it as last read.' : 'Could not load the time clock.'}
          actionLabel="Try again"
          onDismiss={() => void load()}
        />
      )}
      {notice && now - notice.at < NOTICE_MS && (
        <p
          role="status"
          className={`rounded-md border px-4 py-3 text-sm font-medium ${notice.punch.action === 'in' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-border bg-white/80 text-foreground'}`}
        >
          {punchLine(notice.punch)}
        </p>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60" suppressHydrationWarning>{formatLongDay(now)}</p>
        <p className="font-display text-xl font-semibold tabular-nums" suppressHydrationWarning>{formatClockSeconds(now)}</p>
      </div>
      {board === null ? (
        !failed && <Skeleton rows={3} height="h-16" />
      ) : board.length === 0 ? (
        <EmptyState title="No staff on the time clock yet." hint="The manager adds names and PINs on the Manager page." />
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border bg-white/80">
          {board.map(row => (
            <ClockRow key={row.staffId} row={row} now={now} onTap={() => setAsking({ row, action: row.openShift ? 'out' : 'in' })} />
          ))}
        </ul>
      )}
      <p className="px-0.5 text-xs leading-relaxed text-foreground/45">
        Arriving together? Each person taps their own button and enters their own PIN, one after the other. Each shift keeps its own time.
      </p>
      {asking && (
        <PinDialog
          title={asking.action === 'out' ? 'Clock out' : 'Clock in'}
          name={asking.row.name}
          note={`Enter your PIN to ${verb}.`}
          onPin={punch}
          onClose={closeDialog}
        />
      )}
    </div>
  )
}

/** One person: on shift or not, a running timer while they are, and the one button. */
export function ClockRow({ row, now, onTap }: { row: BoardRow; now: number; onTap: () => void }) {
  const open = row.openShift
  const status = open ? `On shift since ${formatSince(open.clockIn, now)}` : row.hasPin ? 'Off the clock' : 'No PIN yet · ask the manager'
  return (
    <li className={`border-t border-border/70 px-4 py-3.5 first:border-t-0 ${open ? 'bg-emerald-50/70' : ''}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            aria-hidden="true"
            className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 ${open ? 'border-emerald-600 bg-emerald-600 ring-4 ring-emerald-600/15' : 'border-foreground/25'}`}
          />
          <div className="min-w-0">
            <p className="break-words text-base font-semibold">{row.name}</p>
            <p className="text-xs text-foreground/60">{status}</p>
          </div>
        </div>
        {open && (
          <p
            title="Time on this shift"
            className="order-last w-full pl-5.5 font-display text-xl font-semibold tabular-nums text-emerald-800 sm:order-none sm:w-auto sm:pl-0 sm:text-2xl"
          >
            {formatTimer(now - Date.parse(open.clockIn))}
          </p>
        )}
        {open
          ? <ActionButton tone="danger" className="min-w-32 bg-white" onClick={onTap}>Clock out</ActionButton>
          : <ActionButton tone="primary" className="min-w-32" disabled={!row.hasPin} onClick={onTap}>Clock in</ActionButton>}
      </div>
      {open && startedBeforeToday(open.clockIn, now) && (
        <p className="ml-5.5 mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
          {`Clocked in since ${formatSince(open.clockIn, now)}. Clock out now, then ask the manager to set the real time out.`}
        </p>
      )}
    </li>
  )
}

/** "John Reyes clocked in at 9:58 AM.", "… clocked out at 6:02 PM · 8h 04m on this shift.", or the repeat of either. */
export function punchLine(punch: Punch): string {
  const { name, shift, repeat } = punch
  if (punch.action === 'in' || !shift.clockOut) {
    return repeat ? `${name} was already clocked in, since ${formatClock(shift.clockIn)}.` : `${name} clocked in at ${formatClock(shift.clockIn)}.`
  }
  const hours = formatHours(Date.parse(shift.clockOut) - Date.parse(shift.clockIn))
  return `${name} ${repeat ? 'already clocked out' : 'clocked out'} at ${formatClock(shift.clockOut)} · ${hours} on this shift.`
}
```

- [ ] **Step 5: Write My records**

`RecordsTable` sorts oldest first and keeps one line per shift (date · time in – time out · hours). On a phone, the times go under the date.

```tsx
'use client'

import { useCallback, useMemo, useState } from 'react'
import { shiftMs, type MyHours, type TimeShift } from '@/lib/timeclock/rules'
import {
  PERIOD_LABELS,
  TIMECLOCK_PERIODS,
  formatClock,
  formatDay,
  formatEnd,
  formatHours,
  formatLongDay,
  formatSince,
  formatTimer,
  periodRange,
  type TimeclockPeriod,
} from '@/lib/timeclock/time'
import PinPad from '../PinPad'
import { ActionButton, Badge, EmptyState } from '../sales/ui'
import { useIdleLock } from '../useIdleLock'
import { latestOnly } from './latestOnly'
import PadCard from './PadCard'
import { TIME_CLOCK_MESSAGES, readMyHours } from './sendTimeClock'

/** My records closes after this long without a tap, so the next person can't read them. */
export const MY_RECORDS_IDLE_MS = 60 * 1000

// My records: a staff member's own shifts, after their PIN, as a plain timesheet. View only,
// with nobody else's hours; it closes on Done, after a minute without a tap, or when the screen
// goes off.
export default function MyRecordsView({ now }: { now: number }) {
  const [pin, setPin] = useState<string | null>(null)
  const [period, setPeriod] = useState<TimeclockPeriod>('week')
  const [records, setRecords] = useState<MyHours | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Tapping through the periods quickly: only the last one asked for is shown.
  const readPeriod = useMemo(() => latestOnly(readMyHours), [])

  const close = useCallback(() => {
    setPin(null)
    setRecords(null)
    setError(null)
    setPeriod('week')
  }, [])
  useIdleLock(pin !== null, close, MY_RECORDS_IDLE_MS)

  async function open(typed: string): Promise<string | null> {
    const reply = await readMyHours(typed, periodRange('week', Date.now()))
    if (reply.message !== null || !reply.data) return reply.message ?? TIME_CLOCK_MESSAGES.failed
    setPin(typed)
    setPeriod('week')
    setRecords(reply.data)
    setError(null)
    return null
  }

  async function changePeriod(next: TimeclockPeriod) {
    if (pin === null) return
    setPeriod(next)
    const answer = await readPeriod(pin, periodRange(next, Date.now()))
    if (!answer.latest) return
    const reply = answer.value
    if (reply.message !== null || !reply.data) {
      setError(reply.message ?? TIME_CLOCK_MESSAGES.failed)
      return
    }
    setRecords(reply.data)
    setError(null)
  }

  if (pin === null || records === null) {
    return (
      <PadCard title="My records" note="Enter your PIN to see your own records." hint="View only. Ask the manager to fix a time.">
        <PinPad onComplete={open} />
      </PadCard>
    )
  }
  return <MyRecordsCard records={records} period={period} now={now} error={error} onPeriod={next => void changePeriod(next)} onDone={close} />
}

interface MyRecordsCardProps {
  records: MyHours
  period: TimeclockPeriod
  now: number
  /** Why the last period could not be read; the records shown are the ones before it. */
  error: string | null
  onPeriod: (period: TimeclockPeriod) => void
  onDone: () => void
}

/** One person's status and their shifts for a period, read only. */
export function MyRecordsCard({ records, period, now, error, onPeriod, onDone }: MyRecordsCardProps) {
  const range = periodRange(period, now)
  const open = records.openShift
  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border px-4 py-3.5 ${open ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-white/80'}`}>
        <div className="min-w-0 flex-1">
          <p className="break-words text-lg font-semibold">{records.name}</p>
          <p className="text-[13px] text-foreground/60">{open ? `On shift since ${formatSince(open.clockIn, now)}` : 'Off the clock'}</p>
        </div>
        {open && (
          <p title="Time on this shift" className="font-display text-2xl font-semibold tabular-nums text-emerald-800">
            {formatTimer(now - Date.parse(open.clockIn))}
          </p>
        )}
        <ActionButton tone="primary" onClick={onDone}>Done</ActionButton>
      </div>

      <div role="group" aria-label="Period" className="flex flex-wrap gap-1.5">
        {TIMECLOCK_PERIODS.map(key => (
          <button
            key={key}
            type="button"
            aria-pressed={period === key}
            onClick={() => onPeriod(key)}
            className={`h-9 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
              period === key ? 'border-foreground bg-foreground text-cream' : 'border-foreground/20 bg-white text-foreground/65 hover:text-foreground'
            }`}
          >
            {PERIOD_LABELS[key]}
          </button>
        ))}
      </div>
      <p className="-mt-2 text-xs text-foreground/45">{`${formatDay(range.from)} – ${formatDay(Date.parse(range.to) - 1)}`}</p>
      {error && <p role="alert" className="text-[13px] text-red-700">{error}</p>}

      {records.shifts.length === 0 ? <EmptyState title="No shifts in this period." /> : <RecordsTable shifts={records.shifts} now={now} />}
      <p className="text-xs text-foreground/45">Only your own records show here, with nothing to edit. This closes by itself after a minute without a tap.</p>
    </div>
  )
}

const COLUMNS = 'grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1.35fr)_7rem]'

/**
 * Shifts as a timesheet, oldest first: the date, time in – time out, and the hours, one line each,
 * with the total at the foot. On a phone the times go under the date.
 */
export function RecordsTable({ shifts, now }: { shifts: TimeShift[]; now: number }) {
  const rows = [...shifts].sort((a, b) => Date.parse(a.clockIn) - Date.parse(b.clockIn))
  const total = rows.reduce((sum, shift) => sum + shiftMs(shift, now), 0)
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white/80">
      <div aria-hidden="true" className={`hidden ${COLUMNS} border-b border-border/70 bg-foreground/3 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/60 sm:grid`}>
        <span>Date</span>
        <span>Time in – Time out</span>
        <span className="text-right">Total hours</span>
      </div>
      <ul>
        {rows.map(shift => (
          <li key={shift._id} className={`${COLUMNS} items-center border-b border-border/70 px-4 py-3 text-[15px] tabular-nums last:border-b-0`}>
            <span className="font-semibold">{formatLongDay(shift.clockIn)}</span>
            <span className="col-start-1 row-start-2 text-foreground/65 sm:col-start-auto sm:row-start-auto">
              {`${formatClock(shift.clockIn)} – `}
              {shift.clockOut ? formatEnd(shift.clockOut, shift.clockIn) : <span className="font-semibold text-emerald-800">on shift</span>}
              {shift.editedAt && <Badge tone="neutral" className="ml-1.5" title="The manager changed this shift">Edited</Badge>}
            </span>
            <span className="row-span-2 text-right font-display font-semibold sm:row-span-1">{formatHours(shiftMs(shift, now))}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-3 border-t border-border bg-foreground/3 px-4 py-3 font-bold">
        <span className="text-sm">{`Total · ${rows.length} shift${rows.length === 1 ? '' : 's'}`}</span>
        <span className="font-display text-xl tabular-nums">{formatHours(total)}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Write the page**

`app/pos/timeclock/TimeClockClient.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { formatLongDay } from '@/lib/timeclock/time'
import { PageHeader, PageTabs } from '../PageChrome'
import ClockView from './ClockView'
import MyRecordsView from './MyRecordsView'
import { useNow } from './useNow'

type Tab = 'clock' | 'records'

const TABS = [
  { key: 'clock', label: 'Clock in or out' },
  { key: 'records', label: 'My records' },
] as const

// The Time clock page, opened from the POS header. Staff clock in or out on their own name with
// their own PIN, or see their own records under My records. Nothing here needs the manager PIN,
// and nothing here shows anyone else's records: those are on the Manager page.
export default function TimeClockClient() {
  const now = useNow()
  const [tab, setTab] = useState<Tab>('clock')
  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader title="unwnd. time clock" note={formatLongDay(now)} />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        <PageTabs label="Time clock" tabs={TABS} value={tab} onChange={setTab} />
        {tab === 'clock' ? <ClockView now={now} /> : <MyRecordsView now={now} />}
      </main>
    </div>
  )
}
```

`app/pos/timeclock/page.tsx`. It is rendered per request because the header shows today's date; built once, it would show the build day.

```tsx
import type { Metadata } from 'next'
import TimeClockClient from './TimeClockClient'

export const metadata: Metadata = {
  title: 'Time clock — unwnd.',
  robots: { index: false, follow: false },
}

// Rendered per request, not at build time: the header shows today's date.
export const dynamic = 'force-dynamic'

export default function TimeClockPage() {
  return <TimeClockClient />
}
```

- [ ] **Step 7: Run it to see it pass**

Run: `npx vitest run app/pos/timeclock`
Expected: PASS, 22 tests.

### Task 8: The Manager page

**Files:**
- Create: `app/pos/manager/ShiftEditor.tsx`, `app/pos/manager/RecordsView.tsx`, `app/pos/manager/StaffAdmin.tsx`, `app/pos/manager/ManagerClient.tsx`, `app/pos/manager/page.tsx`
- Test: `app/pos/manager/Manager.test.tsx`

**Interfaces:**
- Consumes:
  - Tasks 1, 2 and 6;
  - `verifyPosPin` and `PIN_CHECK_MESSAGES` (`app/pos/verifyPosPin.ts`);
  - `PinPad`;
  - `UnlockIcon` (`app/pos/sales/icons.tsx`);
  - `app/pos/sales/ui.tsx`.
- Produces:
  - `ManagerClient()`, `ManagerPinGate({ onUnlock })` and `MenuTab({ onEdit? })`;
  - `RecordsView({ now })`, `ShiftRow` and `TotalCard`;
  - `ShiftEditor({ shift, now, busy, onSave, onCancel })`;
  - `StaffAdmin({ board, onAdd(name, pin), onChangePin(row, pin), onRemove(row) })`;
  - the page at `/pos/manager`.

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { BoardRow, TimeShift } from '@/lib/timeclock/rules'
import ManagerClient, { MenuTab } from './ManagerClient'
import RecordsView, { ShiftRow, TotalCard } from './RecordsView'
import ShiftEditor from './ShiftEditor'
import StaffAdmin from './StaffAdmin'

const NOW = Date.parse('2026-10-15T12:00:00Z') // Thu, Oct 15, 8:00 PM in Manila
const noop = () => {}
const done = async () => null

const shift = (over: Partial<TimeShift> = {}): TimeShift => ({
  _id: 's1', staffId: 'john', staffName: 'John Reyes', clockIn: '2026-10-14T23:44:00Z', clockOut: '2026-10-15T07:46:00Z', editedAt: null, ...over,
})

describe('the Manager page', () => {
  it('asks for the manager PIN before showing anything', () => {
    const html = renderToStaticMarkup(<ManagerClient />)
    expect(html).toContain('unwnd. manager')
    expect(html).toContain('Manager PIN')
    expect(html).toContain('Same PIN as the POS login.')
    expect(html.match(/data-pin-dot/g)).toHaveLength(4)
    expect(html).not.toContain('>Hours<')
    expect(html).not.toContain('>Lock<')
  })

  it('takes menu editing back to the POS from the Menu tab', () => {
    const html = renderToStaticMarkup(<MenuTab onEdit={noop} />)
    expect(html).toContain('>Edit the menu</button>')
    expect(html).toContain('Takes you back to the POS with editing on.')
  })
})

describe('Hours', () => {
  it('opens on This week, waiting for its first read', () => {
    const html = renderToStaticMarkup(<RecordsView now={NOW} />)
    expect(html).toMatch(/aria-pressed="true"[^>]*>This week</)
    expect(html).toContain('Mon, Oct 12 – Sun, Oct 18')
    expect(html).toContain('animate-pulse')
  })

  it('shows each shift with who, when and how long, and Edit and Delete', () => {
    const html = renderToStaticMarkup(<ShiftRow shift={shift()} now={NOW} onEdit={noop} onDelete={noop} />)
    expect(html).toContain('John Reyes')
    expect(html).toContain('7:44 AM – ')
    expect(html).toContain('3:46 PM')
    expect(html).toContain('8h 02m')
    expect(html).toContain('>Edit</button>')
    expect(html).toContain('>Delete</button>')
  })

  it('marks an edited shift, and flags one over 16 hours for checking', () => {
    const html = renderToStaticMarkup(
      <ShiftRow shift={shift({ clockIn: '2026-10-14T01:51:00Z', clockOut: '2026-10-15T03:00:00Z', editedAt: '2026-10-15T04:00:00Z' })} now={NOW} onEdit={noop} onDelete={noop} />,
    )
    expect(html).toContain('>Edited</span>')
    expect(html).toContain('Over 16h · check')
    expect(html).toContain('Thu, Oct 15, 11:00 AM')
  })

  it('shows a person’s total, whether they are on shift, and when they were removed', () => {
    const html = renderToStaticMarkup(
      <TotalCard total={{ staffId: 'ana', name: 'Ana Cruz', ms: 26 * 3600e3 + 54 * 60e3, count: 3, openSince: '2026-10-15T04:00:00Z' }} removed />,
    )
    expect(html).toContain('26h 54m')
    expect(html).toContain('3 shifts')
    expect(html).toContain(' · on shift')
    expect(html).toContain('>Removed</span>')
  })

  it('edits a shift in Manila time, and lets the time out of an open one stay empty', () => {
    const closed = renderToStaticMarkup(<ShiftEditor shift={shift()} now={NOW} busy={false} onSave={done} onCancel={noop} />)
    expect(closed).toContain('value="2026-10-15T07:44"')
    expect(closed).toContain('value="2026-10-15T15:46"')
    expect(closed).toContain('max="2026-10-15T20:00"')
    const open = renderToStaticMarkup(<ShiftEditor shift={shift({ clockOut: null })} now={NOW} busy={false} onSave={done} onCancel={noop} />)
    expect(open).toContain('Time out · empty while on shift')
  })
})

describe('Staff', () => {
  const board: BoardRow[] = [
    { staffId: 'john', name: 'John Reyes', hasPin: true, openShift: { _id: 's1', clockIn: '2026-10-15T10:00:00Z' } },
    { staffId: 'ana', name: 'Ana Cruz', hasPin: false, openShift: null },
  ]
  const html = renderToStaticMarkup(<StaffAdmin board={board} onAdd={done} onChangePin={done} onRemove={done} />)

  it('lists everyone with whether they are on shift and have a PIN, never the PIN', () => {
    expect(html).toContain('on shift · ')
    expect(html).toContain('PIN set')
    expect(html).toContain('No PIN yet')
    expect(html).toContain('>Change PIN</button>')
    expect(html).toContain('>Set PIN</button>')
    expect(html.match(/>Remove<\/button>/g)).toHaveLength(2)
  })

  it('adds someone with a name and a PIN', () => {
    expect(html).toContain('placeholder="Full name"')
    expect(html).toContain('placeholder="PIN"')
    expect(html).toContain('inputMode="numeric"')
    expect(html).toContain('Add staff')
    expect(html).toContain('it can’t be the manager PIN')
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run app/pos/manager`
Expected: FAIL. `Failed to resolve import "./ManagerClient"`.

- [ ] **Step 3: Write the shift editor**

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import { shiftTimesProblem, type ShiftTimes, type TimeShift } from '@/lib/timeclock/rules'
import { formatDay, fromManilaInput, toManilaInput } from '@/lib/timeclock/time'
import { ActionButton } from '../sales/ui'

interface ShiftEditorProps {
  shift: TimeShift
  now: number
  busy: boolean
  /** Saves the times; resolves to null when saved, else why not. */
  onSave: (times: ShiftTimes) => Promise<string | null>
  onCancel: () => void
}

const FIELD = 'grid gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/60'
const INPUT = 'h-10 rounded-md border border-foreground/25 bg-white px-2.5 text-sm normal-case tracking-normal text-foreground'

// A manager's fix to one shift, in Manila time: most often the real time out of a forgotten
// clock-out. The server runs the same checks, and also looks for overlaps with their other shifts.
export default function ShiftEditor({ shift, now, busy, onSave, onCancel }: ShiftEditorProps) {
  const [inValue, setInValue] = useState(() => toManilaInput(shift.clockIn))
  const [outValue, setOutValue] = useState(() => (shift.clockOut ? toManilaInput(shift.clockOut) : ''))
  const [problem, setProblem] = useState<string | null>(null)
  const wasOpen = shift.clockOut === null
  const latest = toManilaInput(now)

  async function save(e: FormEvent) {
    e.preventDefault()
    const clockIn = fromManilaInput(inValue)
    if (clockIn === null) {
      setProblem('Enter the time in.')
      return
    }
    const clockOut = outValue ? fromManilaInput(outValue) : null
    if (outValue && clockOut === null) {
      setProblem('Enter the whole time out, or clear it.')
      return
    }
    const local = shiftTimesProblem({ clockIn, clockOut }, { wasOpen, now: Date.now(), others: [] })
    setProblem(local ?? (await onSave({ clockIn, clockOut })))
  }

  return (
    <form onSubmit={save} aria-label={`Edit the shift of ${shift.staffName}`} className="grid gap-2.5 border-t border-border/70 bg-white px-3.5 py-3">
      <p className="text-[13.5px] font-semibold">{`${shift.staffName} · ${formatDay(shift.clockIn)}`}</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,210px),1fr))] gap-2.5">
        <label className={FIELD}>
          Time in
          <input
            type="datetime-local"
            value={inValue}
            max={latest}
            onChange={e => {
              setInValue(e.target.value)
              setProblem(null)
            }}
            className={INPUT}
          />
        </label>
        <label className={FIELD}>
          {wasOpen ? 'Time out · empty while on shift' : 'Time out'}
          <input
            type="datetime-local"
            value={outValue}
            max={latest}
            onChange={e => {
              setOutValue(e.target.value)
              setProblem(null)
            }}
            className={INPUT}
          />
        </label>
      </div>
      {problem && <p role="alert" className="text-[13px] text-red-700">{problem}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <ActionButton tone="ghost" onClick={onCancel}>Cancel</ActionButton>
        <ActionButton tone="primary" type="submit" busy={busy}>Save</ActionButton>
      </div>
      <p className="text-xs text-foreground/45">A saved change shows as Edited to the staff member too.</p>
    </form>
  )
}
```

- [ ] **Step 4: Write Hours**

A forgotten clock-out is edited inside its amber alert, so the list below skips editing that shift (`forgottenIds`). That way one shift never shows two editors with the same fields.

```tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MAX_SHIFT_MS,
  groupByDay,
  shiftMs,
  startedBeforeToday,
  totalsByStaff,
  type ShiftTimes,
  type StaffTotal,
  type TimeShift,
} from '@/lib/timeclock/rules'
import {
  PERIOD_LABELS,
  TIMECLOCK_PERIODS,
  formatClock,
  formatDay,
  formatEnd,
  formatHours,
  formatLongDay,
  formatSince,
  periodRange,
  type TimeclockPeriod,
} from '@/lib/timeclock/time'
import { ActionButton, Badge, EmptyState, ErrorBanner, InlineConfirm, Skeleton } from '../sales/ui'
import { latestOnly } from '../timeclock/latestOnly'
import { readTimeClock, sendTimeClock, type TimeClockData } from '../timeclock/sendTimeClock'
import ShiftEditor from './ShiftEditor'

type LoadState = 'loading' | 'ready' | 'failed'

const shiftUrl = (id: string) => `/api/timeclock/shifts/${encodeURIComponent(id)}`

// Hours on the Manager page: everyone's hours for a week or a month, every shift with Edit and
// Delete, and a forgotten clock-out flagged at the top with Set time out.
export default function RecordsView({ now }: { now: number }) {
  const [period, setPeriod] = useState<TimeclockPeriod>('week')
  const [data, setData] = useState<TimeClockData | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tapping through the periods quickly: only the last one asked for is shown.
  const read = useMemo(() => latestOnly(readTimeClock), [])

  const load = useCallback((which: TimeclockPeriod) => read(periodRange(which, Date.now())).then(answer => {
    if (!answer.latest) return
    if (answer.value) setData(answer.value)
    setLoadState(answer.value ? 'ready' : 'failed')
  }), [read])

  useEffect(() => {
    void load(period)
  }, [load, period])

  function changePeriod(next: TimeclockPeriod) {
    setPeriod(next)
    setLoadState('loading')
    setEditingId(null)
    setDeletingId(null)
  }

  async function saveShift(shift: TimeShift, times: ShiftTimes): Promise<string | null> {
    setBusy(true)
    const reply = await sendTimeClock(shiftUrl(shift._id), 'PATCH', { clockIn: times.clockIn, clockOut: times.clockOut })
    setBusy(false)
    if (reply.message === null) setEditingId(null)
    if (reply.message === null || reply.unsure || reply.gone) await load(period)
    return reply.message
  }

  async function deleteShift(shift: TimeShift) {
    setBusy(true)
    setError(null)
    const reply = await sendTimeClock(shiftUrl(shift._id), 'DELETE')
    setBusy(false)
    setDeletingId(null)
    if (reply.message !== null && !reply.gone) setError(`Not deleted: ${reply.message}`)
    await load(period)
  }

  const range = periodRange(period, now)
  const board = data?.board ?? null
  const shifts = data?.shifts ?? []
  // Shifts still open from an earlier day: most likely forgotten clock-outs. Each is fixed in
  // its own alert, so the list below leaves it out of editing.
  const forgotten: TimeShift[] = (board ?? []).flatMap(row => (row.openShift && startedBeforeToday(row.openShift.clockIn, now)
    ? [{ _id: row.openShift._id, staffId: row.staffId, staffName: row.name, clockIn: row.openShift.clockIn, clockOut: null, editedAt: null }]
    : []))
  const forgottenIds = new Set(forgotten.map(shift => shift._id))

  function shiftLine(shift: TimeShift) {
    if (editingId === shift._id && !forgottenIds.has(shift._id)) {
      return <ShiftEditor key={shift._id} shift={shift} now={now} busy={busy} onSave={times => saveShift(shift, times)} onCancel={() => setEditingId(null)} />
    }
    if (deletingId === shift._id) {
      return (
        <div key={shift._id} className="border-t border-border/70 bg-white px-3.5 py-3">
          <InlineConfirm
            message={`Delete ${shift.staffName}’s shift on ${formatDay(shift.clockIn)} (${formatHours(shiftMs(shift, now))})? It comes off their hours.`}
            confirmLabel="Delete"
            onCancel={() => setDeletingId(null)}
            onConfirm={() => void deleteShift(shift)}
          />
        </div>
      )
    }
    return (
      <ShiftRow
        key={shift._id}
        shift={shift}
        now={now}
        onEdit={() => {
          setDeletingId(null)
          setEditingId(shift._id)
        }}
        onDelete={() => {
          setEditingId(null)
          setDeletingId(shift._id)
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Period" className="flex flex-wrap gap-1.5">
        {TIMECLOCK_PERIODS.map(key => (
          <button
            key={key}
            type="button"
            aria-pressed={period === key}
            onClick={() => changePeriod(key)}
            className={`h-9 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
              period === key ? 'border-foreground bg-foreground text-cream' : 'border-foreground/20 bg-white text-foreground/65 hover:text-foreground'
            }`}
          >
            {PERIOD_LABELS[key]}
          </button>
        ))}
      </div>
      <p className="-mt-2 text-xs text-foreground/45">{`${formatDay(range.from)} – ${formatDay(Date.parse(range.to) - 1)}`}</p>

      {loadState === 'failed' && (
        <ErrorBanner
          message={data ? 'Could not refresh the hours. Showing them as last read.' : 'Could not load the hours.'}
          actionLabel="Try again"
          onDismiss={() => {
            setLoadState('loading')
            void load(period)
          }}
        />
      )}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {forgotten.map(shift => (
        <div key={shift._id} role="status" className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
            <span>{`${shift.staffName} is still clocked in from ${formatSince(shift.clockIn, now)}.`}</span>
            {editingId !== shift._id && <ActionButton tone="neutral" onClick={() => setEditingId(shift._id)}>Set time out</ActionButton>}
          </div>
          {editingId === shift._id && (
            <ShiftEditor shift={shift} now={now} busy={busy} onSave={times => saveShift(shift, times)} onCancel={() => setEditingId(null)} />
          )}
        </div>
      ))}

      {!data ? (
        loadState === 'loading' && <Skeleton rows={2} height="h-20" />
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-2.5">
            {totalsByStaff(shifts, data.board, now).map(total => (
              <TotalCard key={total.staffId} total={total} removed={!data.board.some(row => row.staffId === total.staffId)} />
            ))}
          </div>

          <section className="space-y-2">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60">Shifts</h3>
            {shifts.length === 0 ? (
              <EmptyState title="No shifts in this period." />
            ) : (
              <div className="overflow-hidden rounded-lg border border-border bg-white/80">
                {groupByDay(shifts).map(day => (
                  <section key={day.day} className="border-t border-border/70 first:border-t-0">
                    <h4 className="bg-foreground/3 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/60">
                      {formatLongDay(day.shifts[0].clockIn)}
                    </h4>
                    {day.shifts.map(shiftLine)}
                  </section>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

/** One person's hours in the period. */
export function TotalCard({ total, removed }: { total: StaffTotal; removed: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-white/80 px-3.5 py-3">
      <p className="break-words text-[13px] font-semibold">
        {total.name}
        {removed && <Badge tone="neutral" className="ml-1.5">Removed</Badge>}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{formatHours(total.ms)}</p>
      <p className="text-xs text-foreground/60">
        {`${total.count} shift${total.count === 1 ? '' : 's'}`}
        {total.openSince && <span className="font-semibold text-emerald-800"> · on shift</span>}
      </p>
    </div>
  )
}

interface ShiftRowProps {
  shift: TimeShift
  now: number
  onEdit: () => void
  onDelete: () => void
}

/** One shift in the list: who, when, how long, and Edit and Delete. */
export function ShiftRow({ shift, now, onEdit, onDelete }: ShiftRowProps) {
  const length = shiftMs(shift, now)
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-border/70 px-3.5 py-2.5 text-[13.5px] tabular-nums sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_4.5rem_auto]">
      <span className="break-words font-semibold">{shift.staffName}</span>
      <span className="col-span-2 row-start-2 text-foreground/65 sm:col-span-1 sm:row-start-auto">
        {`${formatClock(shift.clockIn)} – `}
        {shift.clockOut ? formatEnd(shift.clockOut, shift.clockIn) : <span className="font-semibold text-emerald-800">on shift</span>}
        {shift.editedAt && <Badge tone="neutral" className="ml-1.5">Edited</Badge>}
        {length > MAX_SHIFT_MS && <Badge tone="pending" className="ml-1.5">Over 16h · check</Badge>}
      </span>
      <span className="text-right font-display font-semibold">{formatHours(length)}</span>
      <span className="col-span-2 flex gap-1.5 sm:col-span-1 sm:justify-end">
        <ActionButton tone="neutral" onClick={onEdit}>Edit</ActionButton>
        <ActionButton tone="danger" onClick={onDelete}>Delete</ActionButton>
      </span>
    </div>
  )
}
```

- [ ] **Step 5: Write Staff**

```tsx
'use client'

import { useState, type FormEvent } from 'react'
import {
  MAX_STAFF_NAME_LENGTH,
  STAFF_PIN_LENGTH,
  cleanStaffName,
  staffNameProblem,
  staffPinProblem,
  type BoardRow,
} from '@/lib/timeclock/rules'
import { ActionButton, InlineConfirm } from '../sales/ui'

interface StaffAdminProps {
  board: BoardRow[]
  /** Each resolves to null when it worked, else why not. */
  onAdd: (name: string, pin: string) => Promise<string | null>
  onChangePin: (row: BoardRow, pin: string) => Promise<string | null>
  onRemove: (row: BoardRow) => Promise<string | null>
}

const PIN_INPUT = 'h-10 w-28 rounded-md border border-foreground/25 bg-white px-2.5 text-sm tracking-[0.3em] tabular-nums'
const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, STAFF_PIN_LENGTH)

// Staff on the Manager page: who is on the time clock, and their PINs. A PIN can't be read back,
// only replaced. Removing someone keeps their shifts; someone on shift clocks out first.
export default function StaffAdmin({ board, onAdd, onChangePin, onRemove }: StaffAdminProps) {
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [adding, setAdding] = useState(false)
  // The person whose PIN is being changed, and the new one typed.
  const [pinFor, setPinFor] = useState<string | null>(null)
  const [newPin, setNewPin] = useState('')
  const [savingPin, setSavingPin] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    const cleaned = cleanStaffName(name)
    const problem = staffNameProblem(cleaned) ?? staffPinProblem(pin)
    if (problem) {
      setError(problem)
      return
    }
    setAdding(true)
    setNotice(null)
    const failed = await onAdd(cleaned, pin)
    setAdding(false)
    setError(failed)
    if (failed === null) {
      setName('')
      setPin('')
      setNotice(`${cleaned} can clock in now. Tell them their PIN.`)
    }
  }

  function startPinChange(row: BoardRow) {
    setPinFor(row.staffId)
    setNewPin('')
    setConfirmingId(null)
    setError(null)
    setNotice(null)
  }

  async function savePin(e: FormEvent, row: BoardRow) {
    e.preventDefault()
    const problem = staffPinProblem(newPin)
    if (problem) {
      setError(problem)
      return
    }
    setSavingPin(true)
    const failed = await onChangePin(row, newPin)
    setSavingPin(false)
    setError(failed)
    if (failed === null) {
      setPinFor(null)
      setNewPin('')
      setNotice(`${row.name}’s PIN is changed. Tell them the new one.`)
    }
  }

  function askToRemove(row: BoardRow) {
    if (row.openShift) {
      setError(`${row.name} is on shift. Clock them out first.`)
      return
    }
    setError(null)
    setNotice(null)
    setPinFor(null)
    setConfirmingId(row.staffId)
  }

  async function remove(row: BoardRow) {
    setRemovingId(row.staffId)
    const failed = await onRemove(row)
    setRemovingId(null)
    setConfirmingId(null)
    setError(failed)
    if (failed === null) setNotice(`${row.name} is off the time clock. Their records stay.`)
  }

  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60">Staff on the time clock</h3>
      {notice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
      <div className="grid gap-2.5 rounded-lg border border-border bg-white/80 px-3.5 py-3">
        <ul className="grid">
          {board.length === 0 && <li className="py-1.5 text-sm text-foreground/60">Nobody yet. Add the first name and PIN below.</li>}
          {board.map(row => (
            <li key={row.staffId} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 py-2 text-sm last:border-b-0">
              {confirmingId === row.staffId ? (
                <div className="w-full">
                  <InlineConfirm
                    message={`Remove ${row.name} from the time clock? Their records stay.`}
                    confirmLabel="Remove"
                    onCancel={() => setConfirmingId(null)}
                    onConfirm={() => void remove(row)}
                  />
                </div>
              ) : pinFor === row.staffId ? (
                <form onSubmit={e => void savePin(e, row)} className="flex w-full flex-wrap items-center gap-2">
                  <span className="font-semibold">{row.name}</span>
                  <label htmlFor={`pin-${row.staffId}`} className="sr-only">{`New PIN for ${row.name}`}</label>
                  <input
                    id={`pin-${row.staffId}`}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="New PIN"
                    value={newPin}
                    onChange={e => {
                      setNewPin(digitsOnly(e.target.value))
                      setError(null)
                    }}
                    className={PIN_INPUT}
                  />
                  <ActionButton tone="ghost" onClick={() => setPinFor(null)}>Cancel</ActionButton>
                  <ActionButton tone="primary" type="submit" busy={savingPin}>Save PIN</ActionButton>
                </form>
              ) : (
                <>
                  <span>
                    <span className="font-semibold">{row.name}</span>
                    <span className="ml-2 text-xs text-foreground/60">
                      {row.openShift && <span className="font-semibold text-emerald-800">on shift · </span>}
                      {row.hasPin ? 'PIN set' : <span className="font-semibold text-amber-700">No PIN yet</span>}
                    </span>
                  </span>
                  <span className="flex gap-1.5">
                    <ActionButton tone="neutral" onClick={() => startPinChange(row)}>{row.hasPin ? 'Change PIN' : 'Set PIN'}</ActionButton>
                    <ActionButton tone="danger" busy={removingId === row.staffId} onClick={() => askToRemove(row)}>Remove</ActionButton>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={e => void add(e)} className="flex flex-wrap gap-2">
          <label htmlFor="add-staff-name" className="sr-only">Full name</label>
          <input
            id="add-staff-name"
            value={name}
            maxLength={MAX_STAFF_NAME_LENGTH}
            autoComplete="off"
            placeholder="Full name"
            onChange={e => {
              setName(e.target.value)
              setError(null)
            }}
            className="h-10 min-w-0 flex-1 basis-52 rounded-md border border-foreground/25 bg-white px-2.5 text-sm"
          />
          <label htmlFor="add-staff-pin" className="sr-only">Their PIN, 4 digits</label>
          <input
            id="add-staff-pin"
            inputMode="numeric"
            autoComplete="off"
            placeholder="PIN"
            value={pin}
            onChange={e => {
              setPin(digitsOnly(e.target.value))
              setError(null)
            }}
            className={PIN_INPUT}
          />
          <ActionButton tone="primary" type="submit" busy={adding} disabled={!name.trim() || pin === ''}>Add staff</ActionButton>
        </form>
        {error && <p role="alert" className="text-[13px] text-red-700">{error}</p>}
        <p className="text-xs text-foreground/45">
          Each PIN is 4 digits and belongs to one person, and it can’t be the manager PIN. The POS keeps only a fingerprint of it, so a forgotten PIN gets a new one here.
        </p>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Write the page**

`app/pos/manager/ManagerClient.tsx`:

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { BoardRow } from '@/lib/timeclock/rules'
import { handOffMenuEditing } from '../menuHandoff'
import { PageHeader, PageTabs } from '../PageChrome'
import PinPad from '../PinPad'
import { UnlockIcon } from '../sales/icons'
import { ActionButton, ErrorBanner, Skeleton } from '../sales/ui'
import { readTimeClock, sendTimeClock } from '../timeclock/sendTimeClock'
import { useNow } from '../timeclock/useNow'
import { useIdleLock } from '../useIdleLock'
import { PIN_CHECK_MESSAGES, verifyPosPin } from '../verifyPosPin'
import RecordsView from './RecordsView'
import StaffAdmin from './StaffAdmin'

type ManagerTab = 'hours' | 'staff' | 'menu'

const TABS = [
  { key: 'hours', label: 'Hours' },
  { key: 'staff', label: 'Staff' },
  { key: 'menu', label: 'Menu' },
] as const

// The Manager page, opened from the POS header. It asks for the manager PIN (the POS login PIN)
// first, then holds what a manager does: everyone's hours, the staff and their PINs, and the way
// into menu editing. Like manager mode on the POS, it locks after two idle minutes or as soon as
// the screen goes off. The routes behind it take any signed-in POS.
export default function ManagerClient() {
  const [unlocked, setUnlocked] = useState(false)
  const [tab, setTab] = useState<ManagerTab>('hours')
  const lock = useCallback(() => setUnlocked(false), [])
  useIdleLock(unlocked, lock)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader title="unwnd. manager" note="hours · staff · menu">
        {unlocked && (
          <button
            type="button"
            onClick={lock}
            className="flex h-9 items-center gap-2 rounded-full bg-amber-400 px-3 text-xs font-bold uppercase tracking-[0.2em] text-foreground transition-colors hover:bg-amber-300"
          >
            <UnlockIcon width={14} height={14} />
            Lock
          </button>
        )}
      </PageHeader>
      {unlocked ? (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
          <PageTabs label="Manager" tabs={TABS} value={tab} onChange={setTab} />
          {tab === 'hours' ? <HoursTab /> : tab === 'staff' ? <StaffTab /> : <MenuTab />}
        </main>
      ) : (
        <ManagerPinGate onUnlock={() => setUnlocked(true)} />
      )}
    </div>
  )
}

/** The manager PIN, checked on the server by the POS login route, before anything shows. */
export function ManagerPinGate({ onUnlock }: { onUnlock: () => void }) {
  async function check(pin: string): Promise<string | null> {
    const result = await verifyPosPin(pin)
    if (result !== 'ok') return PIN_CHECK_MESSAGES[result]
    onUnlock()
    return null
  }

  return (
    <main className="flex min-h-[calc(100vh-4.5rem)] flex-col items-center justify-center bg-foreground px-4 py-10 text-cream">
      <p className="mb-10 text-[10px] font-semibold uppercase tracking-[0.3em] text-cream/60">Manager PIN</p>
      <PinPad onComplete={check} />
      <p className="mt-8 text-center text-xs text-cream/45">Same PIN as the POS login.</p>
    </main>
  )
}

// Its own component, so the once-a-second tick that keeps open shifts counting stays inside Hours.
function HoursTab() {
  const now = useNow()
  return <RecordsView now={now} />
}

const staffUrl = (row: BoardRow) => `/api/timeclock/staff/${encodeURIComponent(row.staffId)}`

function StaffTab() {
  const [board, setBoard] = useState<BoardRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => readTimeClock().then(data => {
    if (data) setBoard(data.board)
    setFailed(data === null)
  }), [])

  useEffect(() => {
    void load()
  }, [load])

  async function add(name: string, pin: string): Promise<string | null> {
    const reply = await sendTimeClock('/api/timeclock/staff', 'POST', { name, pin })
    if (reply.message === null || reply.unsure) await load()
    return reply.message
  }

  async function changePin(row: BoardRow, pin: string): Promise<string | null> {
    const reply = await sendTimeClock(staffUrl(row), 'PATCH', { pin })
    if (reply.message === null || reply.unsure || reply.gone) await load()
    return reply.message
  }

  async function remove(row: BoardRow): Promise<string | null> {
    const reply = await sendTimeClock(staffUrl(row), 'DELETE')
    if (reply.message === null || reply.unsure || reply.gone) await load()
    return reply.gone ? null : reply.message
  }

  if (board === null) {
    return failed
      ? <ErrorBanner message="Could not load the staff list." actionLabel="Try again" onDismiss={() => void load()} />
      : <Skeleton rows={3} height="h-12" />
  }
  return (
    <div className="space-y-3">
      {failed && <ErrorBanner message="Could not refresh the staff list. Showing it as last read." actionLabel="Try again" onDismiss={() => void load()} />}
      <StaffAdmin board={board} onAdd={add} onChangePin={changePin} onRemove={remove} />
    </div>
  )
}

/** "Edit the menu": back to the POS, with menu editing handed over so the PIN isn't asked again. */
function openMenuEditing() {
  handOffMenuEditing()
  window.location.assign('/pos')
}

export function MenuTab({ onEdit = openMenuEditing }: { onEdit?: () => void }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground/60">Menu</h3>
      <div className="grid gap-3 rounded-lg border border-border bg-white/80 px-4 py-4">
        <p className="max-w-[60ch] text-sm leading-relaxed text-foreground/65">
          Menu editing happens on the POS itself, where the items are: add, edit and delete items, add or remove categories, and drag the tabs into order.
        </p>
        <div>
          <ActionButton tone="primary" onClick={onEdit}>Edit the menu</ActionButton>
        </div>
        <p className="text-xs text-foreground/45">Takes you back to the POS with editing on. Tap Lock there when you’re done; it also locks after two idle minutes.</p>
      </div>
    </section>
  )
}
```

`app/pos/manager/page.tsx`:

```tsx
import type { Metadata } from 'next'
import ManagerClient from './ManagerClient'

export const metadata: Metadata = {
  title: 'Manager — unwnd.',
  robots: { index: false, follow: false },
}

export default function ManagerPage() {
  return <ManagerClient />
}
```

- [ ] **Step 7: Run it to see it pass**

Run: `npx vitest run app/pos/manager`
Expected: PASS, 9 tests.

### Task 9: The POS header

**Files:**
- Modify: `app/pos/sales/icons.tsx`, `app/pos/POSClient.tsx`, `app/pos/POSClient.test.tsx`
- Delete: `app/pos/ManagerPinModal.tsx`

**Interfaces:**
- Consumes:
  - `openPosPage` and `takeMenuEditing`, `useIdleLock` (Task 6);
  - `readTimeClock` (Task 6) and `countOnShift` (Task 2);
  - the two pages (Tasks 7 and 8).
- Produces:
  - `ClockIcon`;
  - the header **Time clock** (with the on-shift count) and **Manager** buttons, each opening its page;
  - the amber **Lock** while the menu is being edited;
  - menu editing turned on by the Manager page's hand-off, read after the first paint.

- [ ] **Step 1: Change the header tests first**

```diff
--- a/app/pos/POSClient.test.tsx
+++ b/app/pos/POSClient.test.tsx
@@ -57,9 +57,21 @@ describe('POSClient first paint', () => {
     }
   })
 
-  it('offers the Manager unlock only when there is a live menu to edit', () => {
-    expect(firstPaint(live)).toContain('>Manager</span>')
-    expect(firstPaint(null)).not.toContain('>Manager</span>')
+  it('offers Manager with or without the live menu: its page holds the staff hours too', () => {
+    for (const html of [firstPaint(live), firstPaint(null)]) {
+      expect(html).toContain('>Manager</span>')
+      expect(html).toContain('aria-label="Manager"')
+      // Menu editing is turned on from the Manager page, never on first paint.
+      expect(html).not.toContain('>Lock</span>')
+    }
+  })
+
+  it('puts Time clock in the header just before Manager, with no count until someone is on shift', () => {
+    const html = firstPaint(live)
+    expect(html.indexOf('>Time clock</span>')).toBeGreaterThan(-1)
+    expect(html.indexOf('>Time clock</span>')).toBeLessThan(html.indexOf('>Manager</span>'))
+    expect(html).toContain('aria-label="Time clock"')
+    expect(firstPaint(null)).toContain('>Time clock</span>')
   })
 
   it('puts Loyalty in the header between Manager and Sales, with or without the live menu', () => {
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run app/pos/POSClient.test.tsx`
Expected: FAIL. "offers Manager with or without the live menu…" fails, since the fallback menu has no Manager yet, and "puts Time clock in the header just before Manager…" fails.

- [ ] **Step 3: Add the clock icon**

```diff
--- a/app/pos/sales/icons.tsx
+++ b/app/pos/sales/icons.tsx
@@ -1,7 +1,7 @@
 import type { SVGProps } from 'react'
 
 // Small stroke icons for the sales screen's action buttons and the POS header's
-// manager lock and loyalty button. Inline SVG rather than emoji so they render
+// time clock, manager lock and loyalty button. Inline SVG rather than emoji so they render
 // identically on every device and inherit the button's text colour.
 
 type IconProps = SVGProps<SVGSVGElement>
@@ -156,3 +156,13 @@ export function StampCardIcon(props: IconProps) {
     </Icon>
   )
 }
+
+/** A clock face: the time clock. */
+export function ClockIcon(props: IconProps) {
+  return (
+    <Icon {...props}>
+      <circle cx="12" cy="12" r="9" />
+      <path d="M12 7v5l3 2" />
+    </Icon>
+  )
+}
```

- [ ] **Step 4: Change the POS**

What this diff does:
- The idle-lock effect becomes `useIdleLock`.
- The Manager button opens the Manager page, or is the amber Lock while the menu is being edited.
- `showManagerPin` and the `ManagerPinModal` block go.
- Two effects read the hand-off and the on-shift count after the first paint. The hand-off is read inside `Promise.resolve().then` because eslint's `react-hooks/set-state-in-effect` refuses a `setState` called straight in an effect body.

```diff
--- a/app/pos/POSClient.tsx
+++ b/app/pos/POSClient.tsx
@@ -22,12 +22,14 @@ import CardActions from './CardActions'
 import OrderReviewModal from './OrderReviewModal'
 import ReceiptPreviewModal from './ReceiptPreviewModal'
 import ItemActionModal, { type ItemModalMode } from './ItemActionModal'
-import ManagerPinModal from './ManagerPinModal'
 import { canEditMenu } from './canEditMenu'
 import CustomerNameField from './CustomerNameField'
-import { watchIdle } from './watchIdle'
-import { LockIcon, StampCardIcon, UnlockIcon } from './sales/icons'
+import { useIdleLock } from './useIdleLock'
+import { takeMenuEditing } from './menuHandoff'
+import { ClockIcon, LockIcon, StampCardIcon, UnlockIcon } from './sales/icons'
 import LoyaltyCardsModal from './LoyaltyCardsModal'
+import { readTimeClock } from './timeclock/sendTimeClock'
+import { countOnShift } from '@/lib/timeclock/rules'
 import {
   NO_LOYALTY,
   buildDiscountLines,
@@ -51,7 +53,7 @@ import { resolveLoyaltyOrder, sameLoyaltyChoice } from './loyaltyOrder'
 import { refetchCardHolders } from './refetchCardHolders'
 import { blockedRewards, buildAddItemsBody, nameAfterRefresh, newLineSuffix, openOrderFromSale, reviewLockedBy, savedState, type OpenOrder } from './addToOrder'
 import { postAddItems } from './postAddItems'
-import { leaveFor } from './navigation'
+import { leaveFor, openPosPage } from './navigation'
 import { AddingBanner, OpenOrderNotice } from './AddingBanner'
 import SavedOrderLines from './SavedOrderLines'
 
@@ -66,9 +68,6 @@ interface POSClientProps {
   openOrderProblem?: OpenSaleProblem | null
 }
 
-/** Manager mode locks itself after this long with no tap or key press. */
-const MANAGER_IDLE_LOCK_MS = 2 * 60 * 1000
-
 export default function POSClient({ initialMenu, initialCardHolders, initialOpenOrder = null, openOrderProblem = null }: POSClientProps) {
   const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
   const [orderItems, setOrderItems]             = useState<OrderItem[]>([])
@@ -103,6 +102,8 @@ export default function POSClient({ initialMenu, initialCardHolders, initialOpen
   const [choosingTen, setChoosingTen]           = useState(false)
   // The loyalty cards panel, opened from the header over the order on screen.
   const [showLoyalty, setShowLoyalty]           = useState(false)
+  // How many staff are on shift, for the count on the header's Time clock.
+  const [onShiftCount, setOnShiftCount]         = useState(0)
   // The per-item modal (Customize / Add-ons / Discount): which line it is for and which
   // section it shows; null when closed. One at a time, opened from that line's buttons.
   const [itemModal, setItemModal]               = useState<{ lineId: string; mode: ItemModalMode } | null>(null)
@@ -120,10 +121,10 @@ export default function POSClient({ initialMenu, initialCardHolders, initialOpen
   const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null)
   const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null)
   // Manager mode unlocks every menu edit: adding, editing and deleting items, the
-  // category manager, and dragging tabs to reorder. It takes the POS PIN; Lock, a
-  // reload, two idle minutes or the screen going off lock it again.
+  // category manager, and dragging tabs to reorder. It is turned on from the Manager page
+  // (Menu → Edit the menu, after the manager PIN); Lock, a reload, two idle minutes or the
+  // screen going off lock it again.
   const [managerUnlocked, setManagerUnlocked]   = useState(false)
-  const [showManagerPin, setShowManagerPin]     = useState(false)
   const menuEditable = canEditMenu(managerUnlocked, initialMenu)
 
   // Locking also closes any menu form left open, so it cannot be saved by someone else.
@@ -136,18 +137,26 @@ export default function POSClient({ initialMenu, initialCardHolders, initialOpen
     setDragOverCategoryId(null)
   }, [])
 
+  useIdleLock(managerUnlocked, lockManager)
+
+  // "Edit the menu" on the Manager page opens the POS with menu editing on, once. Read after
+  // the first paint, which the server rendered locked; the built-in menu has nothing to edit.
   useEffect(() => {
-    if (!managerUnlocked) return
-    const stopWatching = watchIdle(window, MANAGER_IDLE_LOCK_MS, lockManager)
-    function onVisibilityChange() {
-      if (document.visibilityState === 'hidden') lockManager()
-    }
-    document.addEventListener('visibilitychange', onVisibilityChange)
+    void Promise.resolve().then(() => {
+      if (takeMenuEditing() && initialMenu) setManagerUnlocked(true)
+    })
+  }, [initialMenu])
+
+  // Who is on shift, for the count on the header's Time clock.
+  useEffect(() => {
+    let current = true
+    void readTimeClock().then(data => {
+      if (current && data) setOnShiftCount(countOnShift(data.board))
+    })
     return () => {
-      stopWatching()
-      document.removeEventListener('visibilitychange', onVisibilityChange)
+      current = false
     }
-  }, [managerUnlocked, lockManager])
+  }, [])
 
   // Close all modals when the page is restored from the browser's back-forward cache.
   // Without this, any overlay that was open before navigating away blocks all clicks.
@@ -159,7 +168,6 @@ export default function POSClient({ initialMenu, initialCardHolders, initialOpen
         setMobileDrawer(false)
         setItemModal(null)
         setSalePrints(null)
-        setShowManagerPin(false)
         setShowLoyalty(false)
         lockManager()
       }
@@ -726,24 +734,44 @@ export default function POSClient({ initialMenu, initialCardHolders, initialOpen
       {/* ── Header ── */}
       <header className="bg-foreground flex items-center justify-between px-6 py-4 shrink-0">
         <Link href="/" className="font-logo text-2xl lowercase tracking-tight text-cream hover:text-cream/70 transition-colors">unwnd. pos</Link>
-        {/* Tighter on phones, where Manager and Loyalty show as icons beside the Order button. */}
+        {/* Tighter on phones, where Time clock, Manager and Loyalty show as icons beside the Order button. */}
         <div className="flex items-center gap-1 sm:gap-4">
-          {/* Manager mode: the PIN unlocks menu editing; tapping again locks it away. Not offered
-              on the built-in fallback menu, which has nothing to edit. */}
-          {initialMenu && (
+          {/* Time clock and Manager open their own pages, asking first when an order is on screen. */}
+          <button
+            onClick={() => openPosPage('/pos/timeclock', itemCount)}
+            aria-label={onShiftCount > 0 ? `Time clock, ${onShiftCount} on shift` : 'Time clock'}
+            title="Time clock: clock in or out with your PIN"
+            className="h-9 px-2 sm:px-3 flex items-center gap-2 rounded-full text-xs uppercase tracking-[0.2em] text-cream/55 hover:text-cream/85 hover:bg-cream/10 transition-colors"
+          >
+            <ClockIcon width={14} height={14} />
+            <span className="hidden sm:inline">Time clock</span>
+            {onShiftCount > 0 && (
+              <span className="min-w-4.5 h-4.5 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold tracking-normal flex items-center justify-center">
+                {onShiftCount}
+              </span>
+            )}
+          </button>
+          {/* While the menu is being edited, Manager is its Lock; otherwise it opens the Manager page. */}
+          {managerUnlocked ? (
+            <button
+              onClick={lockManager}
+              aria-pressed="true"
+              aria-label="Lock menu editing"
+              title="Lock menu editing"
+              className="h-9 px-2 sm:px-3 flex items-center gap-2 rounded-full text-xs uppercase tracking-[0.2em] transition-colors bg-amber-400 text-foreground font-bold hover:bg-amber-300"
+            >
+              <UnlockIcon width={14} height={14} />
+              <span className="hidden sm:inline">Lock</span>
+            </button>
+          ) : (
             <button
-              onClick={() => (managerUnlocked ? lockManager() : setShowManagerPin(true))}
-              aria-pressed={managerUnlocked}
-              aria-label="Manager mode"
-              title={managerUnlocked ? 'Lock menu editing' : 'Manager PIN: add, edit, delete and reorder the menu'}
-              className={`h-9 px-2 sm:px-3 flex items-center gap-2 rounded-full text-xs uppercase tracking-[0.2em] transition-colors ${
-                managerUnlocked
-                  ? 'bg-amber-400 text-foreground font-bold hover:bg-amber-300'
-                  : 'text-cream/55 hover:text-cream/85 hover:bg-cream/10'
-              }`}
+              onClick={() => openPosPage('/pos/manager', itemCount)}
+              aria-label="Manager"
+              title="Manager: hours, staff and PINs, menu editing"
+              className="h-9 px-2 sm:px-3 flex items-center gap-2 rounded-full text-xs uppercase tracking-[0.2em] text-cream/55 hover:text-cream/85 hover:bg-cream/10 transition-colors"
             >
-              {managerUnlocked ? <UnlockIcon width={14} height={14} /> : <LockIcon width={14} height={14} />}
-              <span className="hidden sm:inline">{managerUnlocked ? 'Lock' : 'Manager'}</span>
+              <LockIcon width={14} height={14} />
+              <span className="hidden sm:inline">Manager</span>
             </button>
           )}
           {/* Loyalty cards: see a card's stamps, and give or remove a card (no PIN). */}
@@ -1036,15 +1064,6 @@ export default function POSClient({ initialMenu, initialCardHolders, initialOpen
         <LoyaltyCardsModal holders={cardHolders} onHoldersChange={setCardHolders} onClose={() => setShowLoyalty(false)} />
       )}
 
-      {/* ── Manager PIN, before any menu editing shows ── */}
-      {showManagerPin && (
-        <ManagerPinModal
-          hint="Same PIN as the POS login. Unlocks menu editing: add, edit and delete items, add or remove categories, and reorder tabs."
-          onSuccess={() => { setManagerUnlocked(true); setShowManagerPin(false) }}
-          onClose={() => setShowManagerPin(false)}
-        />
-      )}
-
       {/* ── Per-item modal: Customize / Add-ons / Discount for one line, above either order panel ── */}
       {itemModal && modalItem && (
         <ItemActionModal
```

- [ ] **Step 5: Delete the old PIN modal**

Nothing imports `ManagerPinModal` any more. Delete it:

```bash
git rm app/pos/ManagerPinModal.tsx
```

- [ ] **Step 6: Run them to see them pass**

Run: `npx vitest run app/pos/POSClient.test.tsx`
Expected: PASS, 11 tests.

### Task 10: Verify, set the secret, check it on the tablet, commit

**Files:** none new.

- [ ] **Step 1: Run the whole suite, the type check and the linter**

Run: `npx vitest run`
Expected: PASS, 577 tests in 64 files.

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output.

Run: `npx eslint app/pos/timeclock app/pos/manager app/api/timeclock lib/timeclock sanity/schemaTypes app/pos/POSClient.tsx app/pos/POSClient.test.tsx app/pos/sales/icons.tsx app/pos/PageChrome.tsx app/pos/navigation.ts app/pos/navigation.test.ts app/pos/menuHandoff.ts app/pos/menuHandoff.test.ts app/pos/useIdleLock.ts proxy.ts`
Expected: no output.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: `✓ Compiled successfully`. The route list includes:
- `ƒ /api/timeclock`, `ƒ /api/timeclock/mine`, `ƒ /api/timeclock/punch`, `ƒ /api/timeclock/shifts/[id]`, `ƒ /api/timeclock/staff` and `ƒ /api/timeclock/staff/[id]`;
- `○ /pos/manager` and `ƒ /pos/timeclock`.

- [ ] **Step 3: Set `STAFF_PIN_SECRET`**

Make a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`.

Put it in `.env.local` as `STAFF_PIN_SECRET=<that value>`. The owner adds the same value in Vercel, for Production and Preview, before deploying.

- [ ] **Step 4 (optional): Click through in jsdom**

Run the Appendix click-throughs. Expected: PASS, 8 tests.

- [ ] **Step 5: Check it in the app**

`npm run dev`, sign in at `/pos`. These steps write to the live `production` dataset, so use test names and delete them afterwards.

1. **Leaving with an order.** Add a drink, then tap Time clock: the browser asks "Leave the POS? The order in progress will be cleared." Cancel stays on the POS.
2. **Adding staff.** Clear the order. Manager → enter the manager PIN → Staff:
   - Add "Test One" with PIN 4821 and "Test Two" with PIN 4822.
   - Then try to add "Test Three" with 4821 ("Someone else has that PIN") and with the manager PIN ("That's the manager PIN").
3. **Two people clocking in, one after the other.** ← POS → Time clock.
   - Tap Clock in on Test One and enter 4821, then Clock in on Test Two and enter 4822. Both rows turn green with Clock out.
   - Tap Clock out on Test One and enter 4822: "Incorrect PIN". Close it; Test One is still on shift.
4. **A repeat.** On a second tablet or browser tab still showing Test Two as off the clock, tap Clock in and enter 4822: "Test Two was already clocked in, since …".
5. **The header count.** ← POS: the header shows **2**.
6. **My records.** Time clock → My records → 4821:
   - One line per shift (date · time in – time out · hours), with the total at the foot, and only Test One's shifts.
   - Done goes back to the pad. Leave it untouched for a minute and it closes by itself.
7. **Clocking out.** Clock out on Test One → 4821: "Test One clocked out at … on this shift.", and the button is Clock in again.
8. **Fixing and locking.** Manager → Hours:
   - Edit Test One's shift to end two minutes earlier: it shows **Edited**, and Test One's My records shows it too.
   - Leave the page two minutes: it locks.
9. **Editing the menu.** Manager → Menu → Edit the menu: the POS opens with editing on and the amber Lock. Tap Lock.
10. **Clean up.** Delete both test shifts on Hours, then remove both test staff (Test Two must clock out first). In Studio (`/studio`), delete the two inactive "Staff member" documents.

- [ ] **Step 6: Commit, once the owner says so**

```bash
git add proxy.ts sanity/schemaTypes app/pos/sales/icons.tsx app/pos/POSClient.tsx app/pos/POSClient.test.tsx app/pos/navigation.ts app/pos/navigation.test.ts app/pos/menuHandoff.ts app/pos/menuHandoff.test.ts app/pos/useIdleLock.ts app/pos/PageChrome.tsx lib/timeclock app/pos/timeclock app/pos/manager app/api/timeclock docs/superpowers/plans/2026-10-15-staff-time-clock.md
git commit -m "feat(pos): staff time clock with PINs, a Time clock page and a Manager page" -m "Owner feedback. Staff time in and out on the café tablet without user accounts: each name has a Clock in button that asks for that person's PIN, then turns into Clock out, which asks for it again. My records shows each person only their own shifts, one line each with the date, time in - time out and total hours. Manager now opens its own page behind the manager PIN, with everyone's hours, Set time out for a forgotten clock-out, staff and their PINs, and Menu > Edit the menu. PINs are stored only as an HMAC fingerprint (STAFF_PIN_SECRET), since the dataset is public." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push origin main
```

`git rm` in Task 9 already staged the deleted `ManagerPinModal.tsx`.

## Appendix: jsdom click-throughs (optional, not committed)

jsdom is not one of the repo's dev dependencies, so these run from a scratch folder with an isolated `npx`.

1. Put the files below in `<scratch>/tc-click2/`, with the three stubs in `<scratch>/tc-click2/stubs/`. `<scratch>` is any folder outside the repo; on this machine, use the long form of the temp path, not `GENESS~1`.
2. From `<scratch>`, run:

```bash
npx -y -p vitest@4.1.11 -p jsdom@26 vitest run --config tc-click2/vitest.config.mts --root "<scratch>"
```

Expected: PASS, 8 tests in 2 files.

`tc-click2/vitest.config.mts`:

```ts
// jsdom click-throughs of the Time clock and Manager pages, with one React for everything.
// ROOT is the project folder. A plain object: vitest/config can't be imported from out here.
const ROOT = 'C:/unwnd.cafe/unwnd'
const NM = `${ROOT}/node_modules`
const STUBS = `${import.meta.dirname}/stubs`

export default {
  resolve: {
    alias: [
      // Next's own modules work only inside a running app: plain stand-ins here.
      { find: /^next\/font\/google$/, replacement: `${STUBS}/font.ts` },
      { find: /^next\/navigation$/, replacement: `${STUBS}/navigation.ts` },
      { find: /^next\/link$/, replacement: `${STUBS}/link.tsx` },
      { find: /^@\//, replacement: `${ROOT}/` },
      { find: /^react$/, replacement: `${NM}/react/index.js` },
      { find: /^react\/jsx-runtime$/, replacement: `${NM}/react/jsx-runtime.js` },
      { find: /^react\/jsx-dev-runtime$/, replacement: `${NM}/react/jsx-dev-runtime.js` },
      { find: /^react-dom$/, replacement: `${NM}/react-dom/index.js` },
      { find: /^react-dom\/client$/, replacement: `${NM}/react-dom/client.js` },
    ],
  },
  test: {
    environment: 'jsdom',
    include: ['tc-click2/**/*.test.tsx'],
  },
}
```

`tc-click2/stubs/font.ts`:

```ts
// next/font/google only works inside a running Next app.
export const IBM_Plex_Mono = () => ({ className: '' })
```

`tc-click2/stubs/navigation.ts`:

```ts
// next/navigation without a Next router.
export const useRouter = () => ({ push() {}, replace() {} })
export const useSearchParams = () => new URLSearchParams()
```

`tc-click2/stubs/link.tsx`:

```tsx
import type { AnchorHTMLAttributes } from 'react'
// next/link as a plain anchor.
export default function Link({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={href} {...rest}>{children}</a>
}
```

`tc-click2/fakeServer.ts`:

```ts
import { vi } from 'vitest'

// A stand-in for the time clock and login routes, keeping its own staff (with PINs) and shifts.
export interface FakeStaff { staffId: string; name: string; pin: string }
export interface FakeShift { _id: string; staffId: string; staffName: string; clockIn: string; clockOut: string | null; editedAt: string | null }

const MANAGER_PIN = '2468'
const REPEAT_MS = 60 * 1000
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function fakeServer(staff: FakeStaff[], shifts: FakeShift[] = []) {
  const calls: { method: string; url: string; body: unknown }[] = []
  let made = 0
  const openOf = (id: string) => shifts.find(s => s.staffId === id && s.clockOut === null) ?? null
  const board = () => staff.map(p => ({ staffId: p.staffId, name: p.name, hasPin: true, openShift: openOf(p.staffId) && { _id: openOf(p.staffId)!._id, clockIn: openOf(p.staffId)!.clockIn } }))

  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, url, body })
    await wait(5)
    if (url === '/api/pos-auth') return body.pin === MANAGER_PIN ? json(200, { ok: true }) : json(401, { error: 'Incorrect PIN' })
    if (method === 'GET' && url.startsWith('/api/timeclock')) return json(200, { success: true, data: { board: board(), shifts: url.includes('from=') ? shifts : [] } })
    if (url === '/api/timeclock/punch') {
      const person = staff.find(p => p.staffId === body.staffId)
      if (!person) return json(404, { success: false, error: 'That person is not on the time clock any more.' })
      if (person.pin !== body.pin) return json(403, { success: false, error: 'Incorrect PIN. Try again.' })
      const now = Date.now()
      const open = openOf(person.staffId)
      if (body.action === 'in') {
        if (open) return json(200, { success: true, data: { action: 'in', name: person.name, shift: open, repeat: true } })
        const shift: FakeShift = { _id: `new-${++made}`, staffId: person.staffId, staffName: person.name, clockIn: new Date(now).toISOString(), clockOut: null, editedAt: null }
        shifts.unshift(shift)
        return json(200, { success: true, data: { action: 'in', name: person.name, shift, repeat: false } })
      }
      if (open) {
        open.clockOut = new Date(now).toISOString()
        return json(200, { success: true, data: { action: 'out', name: person.name, shift: open, repeat: false } })
      }
      const last = shifts.find(s => s.staffId === person.staffId && s.clockOut !== null)
      if (last && now - Date.parse(last.clockOut!) < REPEAT_MS) return json(200, { success: true, data: { action: 'out', name: person.name, shift: last, repeat: true } })
      return json(409, { success: false, error: `${person.name} is not clocked in.` })
    }
    if (url === '/api/timeclock/mine') {
      const person = staff.find(p => p.pin === body.pin)
      if (!person) return json(403, { success: false, error: 'PIN not recognised. Try again.' })
      const open = openOf(person.staffId)
      return json(200, { success: true, data: { name: person.name, openShift: open && { _id: open._id, clockIn: open.clockIn }, shifts: shifts.filter(s => s.staffId === person.staffId) } })
    }
    if (method === 'POST' && url === '/api/timeclock/staff') {
      if (staff.some(p => p.pin === body.pin)) return json(409, { success: false, error: 'Someone else has that PIN. Choose another.' })
      const added = { staffId: `staff-${++made}`, name: body.name, pin: body.pin }
      staff.push(added)
      return json(201, { success: true, data: { staffId: added.staffId, name: added.name, hasPin: true, openShift: null } })
    }
    return json(404, { success: false, error: 'Not found' })
  })

  return { fetchImpl, calls }
}
```

`tc-click2/harness.tsx`:

```tsx
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

export interface Mounted {
  container: HTMLDivElement
  root: Root
}

export async function mount(element: ReactElement): Promise<Mounted> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => root.render(element))
  return { container, root }
}

export async function unmount(m: Mounted) {
  await act(async () => m.root.unmount())
  m.container.remove()
}

export const settle = (ms = 60) => act(() => new Promise<void>(resolve => setTimeout(resolve, ms)))

export const buttons = (scope: ParentNode, text: string) =>
  [...scope.querySelectorAll('button')].filter(b => b.textContent?.trim() === text)

export async function click(el: Element | undefined) {
  if (!el) throw new Error('Nothing to click')
  await act(async () => (el as HTMLElement).click())
}

/** Taps a PIN on the PinPad's keys, then lets its check answer. */
export async function typePin(scope: ParentNode, pin: string) {
  for (const digit of pin) await click(buttons(scope, digit)[0])
  await settle()
}

/** Types into a controlled input the way a person does, so React's onChange runs. */
export async function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
```

`tc-click2/timeclock.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fakeServer, type FakeStaff } from './fakeServer'
import { buttons, click, mount, settle, typeInto, typePin, unmount, type Mounted } from './harness'
import TimeClockClient from '@/app/pos/timeclock/TimeClockClient'
import ManagerClient from '@/app/pos/manager/ManagerClient'

const staff = (): FakeStaff[] => [
  { staffId: 'genessis', name: 'Genessis Contreras', pin: '1111' },
  { staffId: 'john', name: 'John Reyes', pin: '2222' },
  { staffId: 'ana', name: 'Ana Cruz', pin: '3333' },
]

// The row of the staff list that has this name.
const rowOf = (container: ParentNode, name: string) => {
  const row = [...container.querySelectorAll('li')].find(li => li.querySelector('p')?.textContent === name)
  if (!row) throw new Error(`No row for ${name}`)
  return row
}

let mounted: Mounted | null = null
afterEach(async () => {
  if (mounted) await unmount(mounted)
  mounted = null
  vi.unstubAllGlobals()
})

async function openTimeClock(server: ReturnType<typeof fakeServer>) {
  vi.stubGlobal('fetch', server.fetchImpl)
  mounted = await mount(<TimeClockClient />)
  await settle()
  return mounted
}

describe('Clock in or out, clicked through', () => {
  it('clocks two people in one after the other, each on their own name with their own PIN', async () => {
    const server = fakeServer(staff())
    const { container } = await openTimeClock(server)

    await click(buttons(rowOf(container, 'John Reyes'), 'Clock in')[0])
    expect(container.textContent).toContain('Enter your PIN to clock in.')
    await typePin(container, '2222')
    await click(buttons(rowOf(container, 'Ana Cruz'), 'Clock in')[0])
    await typePin(container, '3333')

    expect(buttons(rowOf(container, 'John Reyes'), 'Clock out')).toHaveLength(1)
    expect(buttons(rowOf(container, 'Ana Cruz'), 'Clock out')).toHaveLength(1)
    expect(container.textContent).toContain('Ana Cruz clocked in at')
    expect(server.calls.filter(c => c.url === '/api/timeclock/punch').map(c => c.body)).toEqual([
      { staffId: 'john', action: 'in', pin: '2222' },
      { staffId: 'ana', action: 'in', pin: '3333' },
    ])
  })

  it('refuses someone else’s PIN on a name, and keeps them off the clock', async () => {
    const { container } = await openTimeClock(fakeServer(staff()))
    await click(buttons(rowOf(container, 'John Reyes'), 'Clock in')[0])
    await typePin(container, '3333')
    expect(container.textContent).toContain('Incorrect PIN. Try again.')
    await click(container.querySelector('[aria-label="Close"]') ?? undefined)
    expect(buttons(rowOf(container, 'John Reyes'), 'Clock in')).toHaveLength(1)
  })

  it('asks for the PIN again to clock out, then shows them off the clock', async () => {
    const { container } = await openTimeClock(fakeServer(staff()))
    await click(buttons(rowOf(container, 'John Reyes'), 'Clock in')[0])
    await typePin(container, '2222')
    await click(buttons(rowOf(container, 'John Reyes'), 'Clock out')[0])
    expect(container.textContent).toContain('Enter your PIN to clock out.')
    await typePin(container, '2222')
    expect(buttons(rowOf(container, 'John Reyes'), 'Clock in')).toHaveLength(1)
    expect(container.textContent).toContain('John Reyes clocked out at')
  })
})

describe('My records, clicked through', () => {
  it('shows a person only their own shifts, one line each, then closes on Done', async () => {
    const server = fakeServer(staff(), [
      { _id: 'j1', staffId: 'john', staffName: 'John Reyes', clockIn: new Date(Date.now() - 26 * 3600e3).toISOString(), clockOut: new Date(Date.now() - 18 * 3600e3).toISOString(), editedAt: null },
      { _id: 'a1', staffId: 'ana', staffName: 'Ana Cruz', clockIn: new Date(Date.now() - 30 * 3600e3).toISOString(), clockOut: new Date(Date.now() - 22 * 3600e3).toISOString(), editedAt: null },
    ])
    const { container } = await openTimeClock(server)
    await click(buttons(container, 'My records')[0])
    await typePin(container, '2222')

    const text = container.textContent ?? ''
    expect(text).toContain('John Reyes')
    expect(text).toContain('Time in – Time out')
    expect(text).toContain('8h 00m')
    expect(text).toContain('Total · 1 shift')
    expect(text).not.toContain('Ana Cruz')
    expect(buttons(container, 'Edit')).toHaveLength(0)
    await click(buttons(container, 'Done')[0])
    expect(container.textContent).toContain('Enter your PIN to see your own records.')
    expect(container.textContent).not.toContain('John Reyes')
  })
})

describe('the Manager page, clicked through', () => {
  it('opens only for the manager PIN, then adds someone with a PIN', async () => {
    const server = fakeServer(staff())
    vi.stubGlobal('fetch', server.fetchImpl)
    mounted = await mount(<ManagerClient />)

    await typePin(mounted.container, '2222')
    expect(mounted.container.textContent).toContain('Manager PIN')
    expect(buttons(mounted.container, 'Hours')).toHaveLength(0)

    await typePin(mounted.container, '2468')
    await settle()
    expect(buttons(mounted.container, 'Hours')).toHaveLength(1)
    expect(mounted.container.textContent).toContain('John Reyes')

    await click(buttons(mounted.container, 'Staff')[0])
    await settle()
    await typeInto(mounted.container.querySelector<HTMLInputElement>('#add-staff-name')!, 'Mika Santos')
    await typeInto(mounted.container.querySelector<HTMLInputElement>('#add-staff-pin')!, '4444')
    await click(buttons(mounted.container, 'Add staff')[0])
    await settle()
    expect(server.calls.find(c => c.url === '/api/timeclock/staff')?.body).toEqual({ name: 'Mika Santos', pin: '4444' })
    expect(mounted.container.textContent).toContain('Mika Santos can clock in now. Tell them their PIN.')

    await click(buttons(mounted.container, 'Lock')[0])
    expect(mounted.container.textContent).toContain('Manager PIN')
    expect(mounted.container.textContent).not.toContain('Mika Santos')
  })

  it('refuses a PIN someone already has, with the reason', async () => {
    vi.stubGlobal('fetch', fakeServer(staff()).fetchImpl)
    mounted = await mount(<ManagerClient />)
    await typePin(mounted.container, '2468')
    await settle()
    await click(buttons(mounted.container, 'Staff')[0])
    await settle()
    await typeInto(mounted.container.querySelector<HTMLInputElement>('#add-staff-name')!, 'Mika Santos')
    await typeInto(mounted.container.querySelector<HTMLInputElement>('#add-staff-pin')!, '2222')
    await click(buttons(mounted.container, 'Add staff')[0])
    await settle()
    expect(mounted.container.textContent).toContain('Someone else has that PIN. Choose another.')
  })
})
```

`tc-click2/posHandoff.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, settle, unmount, type Mounted } from './harness'
// Next's font loader, router and Link come from the stubs in vitest.config.mts.
import POSClient from '@/app/pos/POSClient'
import { handOffMenuEditing } from '@/app/pos/menuHandoff'
import type { PosMenu } from '@/lib/posMenu'

const live: PosMenu = {
  categories: [{ id: 'signature', label: 'Signature', type: 'drink', order: 1, isBuiltIn: true }],
  items: [{ _id: 'sanity-ube', name: 'Ube Cream Latte', subtitle: null, category: 'signature', priceHot: null, priceIce: 170, priceFixed: null, addonType: null, hiddenFromPos: false, applicableCategories: null }],
  hiddenItemIds: [],
  categoryOrder: ['signature'],
}
const board = [{ staffId: 'john', name: 'John Reyes', hasPin: true, openShift: { _id: 's1', clockIn: new Date().toISOString() } }]

let mounted: Mounted | null = null
afterEach(async () => {
  if (mounted) await unmount(mounted)
  mounted = null
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('the POS after "Edit the menu" on the Manager page', () => {
  it('opens with menu editing on, once, and counts who is on shift', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, data: { board, shifts: [] } }))))
    handOffMenuEditing()
    mounted = await mount(<POSClient initialMenu={live} initialCardHolders={[]} />)
    await settle()
    expect(mounted.container.querySelector('[aria-label="Lock menu editing"]')).not.toBeNull()
    expect(mounted.container.querySelector('[title="Edit item"]')).not.toBeNull()
    expect(mounted.container.querySelector('[aria-label="Time clock, 1 on shift"]')).not.toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it('opens locked without the hand-over', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, data: { board: [], shifts: [] } }))))
    mounted = await mount(<POSClient initialMenu={live} initialCardHolders={[]} />)
    await settle()
    expect(mounted.container.querySelector('[aria-label="Manager"]')).not.toBeNull()
    expect(mounted.container.querySelector('[title="Edit item"]')).toBeNull()
  })
})
```
