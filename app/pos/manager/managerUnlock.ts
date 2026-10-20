// Manager unlocks last until their Lock button, through reloads, Back and trips between pages.
// Two cookies remember them, each read on the server so a reload opens as it was left:
// - the Manager page, unlocked by the manager PIN;
// - menu editing on the POS, turned on by the Manager page's "Edit the menu".
// Each Lock clears only its own. Like the PIN gate itself, this is a screen-side gate: the routes
// behind both screens take any signed-in POS.

export const MANAGER_UNLOCK_COOKIE = 'pos_manager_unlocked'
export const MENU_EDITING_COOKIE = 'pos_menu_unlocked'
const MANAGER_PATH = '/pos/manager'
const POS_PATH = '/pos'
/** A year: in practice, until Lock. */
const REMEMBER_FOR_S = 365 * 24 * 60 * 60

interface CookieJar {
  cookie: string
}

const onHttps = (): boolean => typeof location !== 'undefined' && location.protocol === 'https:'

/** The cookie text that remembers an unlock, or forgets it. Secure on https only, so localhost works too. */
function unlockCookie(name: string, path: string, unlocked: boolean, secure: boolean): string {
  const parts = [
    `${name}=${unlocked ? '1' : ''}`,
    `Path=${path}`,
    `Max-Age=${unlocked ? REMEMBER_FOR_S : 0}`,
    'SameSite=Strict',
  ]
  return (secure ? [...parts, 'Secure'] : parts).join('; ')
}

/** The Manager page's cookie text. */
export function managerUnlockCookie(unlocked: boolean, secure: boolean): string {
  return unlockCookie(MANAGER_UNLOCK_COOKIE, MANAGER_PATH, unlocked, secure)
}

/** Whether a cookie says it was left unlocked. */
export function isUnlockCookieOn(value: string | undefined): boolean {
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

/** "Edit the menu": the POS opens with menu editing on from now on. */
export function rememberMenuEditing(jar: CookieJar = document, secure: boolean = onHttps()): void {
  jar.cookie = unlockCookie(MENU_EDITING_COOKIE, POS_PATH, true, secure)
}

/** The POS Lock: the POS opens locked again. */
export function forgetMenuEditing(jar: CookieJar = document, secure: boolean = onHttps()): void {
  jar.cookie = unlockCookie(MENU_EDITING_COOKIE, POS_PATH, false, secure)
}
