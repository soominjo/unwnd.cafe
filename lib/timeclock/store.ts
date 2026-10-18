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
