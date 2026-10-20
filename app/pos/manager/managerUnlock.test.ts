import { describe, it, expect } from 'vitest'
import {
  MANAGER_UNLOCK_COOKIE,
  MENU_EDITING_COOKIE,
  forgetManagerUnlock,
  forgetMenuEditing,
  isUnlockCookieOn,
  managerUnlockCookie,
  rememberManagerUnlock,
  rememberMenuEditing,
} from './managerUnlock'

describe('remembering that the Manager page is unlocked', () => {
  it('keeps it in a cookie for the Manager page only, until Lock clears it', () => {
    const jar = { cookie: '' }
    rememberManagerUnlock(jar, true)
    expect(jar.cookie).toBe(`${MANAGER_UNLOCK_COOKIE}=1; Path=/pos/manager; Max-Age=31536000; SameSite=Strict; Secure`)
    forgetManagerUnlock(jar, true)
    expect(jar.cookie).toBe(`${MANAGER_UNLOCK_COOKIE}=; Path=/pos/manager; Max-Age=0; SameSite=Strict; Secure`)
  })

  it('leaves Secure off on plain http, so it works on localhost too', () => {
    expect(managerUnlockCookie(true, false)).not.toContain('Secure')
  })

  it('reads only its own "1" as unlocked', () => {
    expect(isUnlockCookieOn('1')).toBe(true)
    expect(isUnlockCookieOn(undefined)).toBe(false)
    expect(isUnlockCookieOn('')).toBe(false)
    expect(isUnlockCookieOn('true')).toBe(false)
  })
})

describe('remembering that the POS menu is being edited', () => {
  it('keeps it in a cookie the POS reads, until the POS Lock clears it', () => {
    const jar = { cookie: '' }
    rememberMenuEditing(jar, true)
    expect(jar.cookie).toBe(`${MENU_EDITING_COOKIE}=1; Path=/pos; Max-Age=31536000; SameSite=Strict; Secure`)
    forgetMenuEditing(jar, true)
    expect(jar.cookie).toBe(`${MENU_EDITING_COOKIE}=; Path=/pos; Max-Age=0; SameSite=Strict; Secure`)
  })

  it('is a separate cookie from the Manager page one, so each Lock locks only its own screen', () => {
    expect(MENU_EDITING_COOKIE).not.toBe(MANAGER_UNLOCK_COOKIE)
    const jar = { cookie: '' }
    rememberMenuEditing(jar, false)
    expect(jar.cookie).toBe(`${MENU_EDITING_COOKIE}=1; Path=/pos; Max-Age=31536000; SameSite=Strict`)
    forgetMenuEditing(jar, false)
    expect(jar.cookie).toBe(`${MENU_EDITING_COOKIE}=; Path=/pos; Max-Age=0; SameSite=Strict`)
  })
})
