import { createHmac } from 'crypto'
import { staffPinProblem } from './rules'

// Server only. Staff PINs are stored as a keyed fingerprint, never as digits. The dataset can be
// read by anyone with the project ID, and a 4-digit PIN has only 10,000 values, so a plain hash
// would be undone in a moment. The key is the server's Sanity write token, which every time clock
// write needs anyway and which never leaves the server, so there is no setting of its own to add;
// whoever holds that token could change any PIN already. A new token makes every staff PIN stop
// working until the manager sets new ones on the Manager page.

/** The shortest key accepted. Sanity tokens are far longer. */
export const MIN_PIN_KEY_LENGTH = 32

/** Whether SANITY_API_WRITE_TOKEN, the PIN key, is set. Until it is, the PIN routes answer "Server misconfiguration". */
export function hasStaffPinKey(key: string | undefined = process.env.SANITY_API_WRITE_TOKEN): boolean {
  return typeof key === 'string' && key.length >= MIN_PIN_KEY_LENGTH
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
export function hashStaffPin(pin: string, key: string | undefined = process.env.SANITY_API_WRITE_TOKEN): string {
  if (!hasStaffPinKey(key)) throw new Error(`SANITY_API_WRITE_TOKEN must be set, at least ${MIN_PIN_KEY_LENGTH} characters, to fingerprint staff PINs`)
  return createHmac('sha256', key as string).update(`unwnd-staff-pin:${pin}`).digest('hex')
}
