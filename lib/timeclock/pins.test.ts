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
