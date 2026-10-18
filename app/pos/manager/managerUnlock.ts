// The Manager page stays unlocked after the manager PIN, through reloads, Back and trips to the
// POS, until its Lock button. A cookie remembers it, and the page reads that cookie on the server,
// so a reload opens unlocked with no PIN pad first. Like the PIN gate itself, this is a screen-side
// gate: the routes behind the page take any signed-in POS.

export const MANAGER_UNLOCK_COOKIE = 'pos_manager_unlocked'
const COOKIE_PATH = '/pos/manager'
/** A year: in practice, until Lock. */
const REMEMBER_FOR_S = 365 * 24 * 60 * 60

interface CookieJar {
  cookie: string
}

const onHttps = (): boolean => typeof location !== 'undefined' && location.protocol === 'https:'

/** The cookie text that remembers the unlock, or forgets it. Secure on https only, so localhost works too. */
export function managerUnlockCookie(unlocked: boolean, secure: boolean): string {
  const parts = [
    `${MANAGER_UNLOCK_COOKIE}=${unlocked ? '1' : ''}`,
    `Path=${COOKIE_PATH}`,
    `Max-Age=${unlocked ? REMEMBER_FOR_S : 0}`,
    'SameSite=Strict',
  ]
  return (secure ? [...parts, 'Secure'] : parts).join('; ')
}

/** Whether the cookie says the Manager page was left unlocked. */
export function isManagerUnlocked(value: string | undefined): boolean {
  return value === '1'
}

/** After the manager PIN: the Manager page opens unlocked from now on. */
export function rememberManagerUnlock(jar: CookieJar = document, secure: boolean = onHttps()): void {
  jar.cookie = managerUnlockCookie(true, secure)
}

/** Lock: the Manager page asks for the PIN again. */
export function forgetManagerUnlock(jar: CookieJar = document, secure: boolean = onHttps()): void {
  jar.cookie = managerUnlockCookie(false, secure)
}
