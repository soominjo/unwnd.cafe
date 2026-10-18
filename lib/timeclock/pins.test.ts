import { describe, it, expect, vi, afterEach } from 'vitest'
import { createHash } from 'crypto'
import { hasStaffPinKey, hashStaffPin, staffPinRefusal } from './pins'

const KEY = 'test-write-token-that-is-long-enough-1234'
const OTHER = 'another-write-token-that-is-long-enough-99'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('hashStaffPin', () => {
  it('gives the same fingerprint for the same PIN, so a PIN finds its owner', () => {
    expect(hashStaffPin('0427', KEY)).toBe(hashStaffPin('0427', KEY))
    expect(hashStaffPin('0427', KEY)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashStaffPin('0428', KEY)).not.toBe(hashStaffPin('0427', KEY))
  })

  it('needs the key: not a plain hash anyone could reverse from the public dataset', () => {
    expect(hashStaffPin('0427', KEY)).not.toBe(hashStaffPin('0427', OTHER))
    expect(hashStaffPin('0427', KEY)).not.toBe(createHash('sha256').update('0427').digest('hex'))
  })

  it('is keyed by the server’s Sanity write token, so there is no setting of its own to add', () => {
    vi.stubEnv('SANITY_API_WRITE_TOKEN', KEY)
    vi.stubEnv('STAFF_PIN_SECRET', OTHER)
    expect(hasStaffPinKey()).toBe(true)
    expect(hashStaffPin('0427')).toBe(hashStaffPin('0427', KEY))
  })

  it('takes four digits that are not the manager PIN', () => {
    expect(staffPinRefusal('3333', '2468')).toBeNull()
    expect(staffPinRefusal('2468', '2468')).toBe("That's the manager PIN. Choose another.")
    expect(staffPinRefusal('33', '2468')).toBe('A PIN is 4 digits.')
    expect(staffPinRefusal(3333, '2468')).toBe('A PIN is 4 digits.')
  })

  it('refuses to work without the write token', () => {
    vi.stubEnv('SANITY_API_WRITE_TOKEN', '')
    expect(hasStaffPinKey()).toBe(false)
    expect(hasStaffPinKey('short')).toBe(false)
    expect(hasStaffPinKey(KEY)).toBe(true)
    expect(() => hashStaffPin('0427')).toThrow('SANITY_API_WRITE_TOKEN must be set')
  })
})
