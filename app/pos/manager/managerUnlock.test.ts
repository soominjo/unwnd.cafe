import { describe, it, expect } from 'vitest'
import { MANAGER_UNLOCK_COOKIE, forgetManagerUnlock, isManagerUnlocked, managerUnlockCookie, rememberManagerUnlock } from './managerUnlock'

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
    expect(isManagerUnlocked('1')).toBe(true)
    expect(isManagerUnlocked(undefined)).toBe(false)
    expect(isManagerUnlocked('')).toBe(false)
    expect(isManagerUnlocked('true')).toBe(false)
  })
})
