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
