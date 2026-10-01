export type PinCheck = 'ok' | 'wrong' | 'unreachable'

/** What the keypad says after a PIN that did not get through. */
export const PIN_CHECK_MESSAGES: Record<Exclude<PinCheck, 'ok'>, string> = {
  wrong: 'incorrect pin',
  unreachable: 'could not check · try again',
}

/**
 * Checks a PIN with the POS login route, which compares it to POS_PIN on the
 * server — the PIN itself never ships in the page's code. Used by the login
 * screen and by the manager unlock, which takes the same PIN.
 */
export async function verifyPosPin(pin: string, fetchImpl: typeof fetch = fetch): Promise<PinCheck> {
  try {
    const res = await fetchImpl('/api/pos-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    if (res.status === 401) return 'wrong'
    // A pass is the login route's own `{ ok: true }`, not just any 200 from whatever answered.
    const body = res.ok ? ((await res.json()) as { ok?: unknown } | null) : null
    return body?.ok === true ? 'ok' : 'unreachable'
  } catch {
    // The request failed, or the reply was not JSON.
    return 'unreachable'
  }
}
