import { createHash, timingSafeEqual } from 'crypto'

// Server only. The manager PIN is the POS PIN (POS_PIN), so every change that needs it
// (adding or removing a loyalty card holder) is checked here, never in page code.

function digest(pin: string): Buffer {
  return createHash('sha256').update(pin).digest()
}

/** Whether `pin` is the POS PIN, compared in constant time. False when POS_PIN is not set. */
export function isPosPin(pin: unknown): boolean {
  const posPin = process.env.POS_PIN
  if (!posPin || typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)) return false
  return timingSafeEqual(digest(pin), digest(posPin))
}
