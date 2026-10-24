import { describe, it, expect } from 'vitest'
import { encryptSecret, decryptSecret, sha256Hex, safeEqual, hmacSha256Hex, dedupeKey, shortSlug, tryDecryptSecret } from '../src/lib/crypto'

describe('token encryption (AES-256-GCM)', () => {
  it('round-trips a page access token', () => {
    const token = 'EAAG-page-access-token-abc123'
    const enc = encryptSecret(token)
    expect(enc.startsWith('v1.')).toBe(true)
    expect(enc).not.toContain(token)
    expect(decryptSecret(enc)).toBe(token)
  })

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'))
  })

  it('detects tampering via auth tag', () => {
    const enc = encryptSecret('sensitive-token')
    const parts = enc.split('.')
    parts[3] = Buffer.from('tampered').toString('base64')
    expect(() => decryptSecret(parts.join('.'))).toThrow()
  })

  it('tryDecryptSecret returns null instead of throwing', () => {
    expect(tryDecryptSecret('garbage')).toBeNull()
    expect(tryDecryptSecret(null)).toBeNull()
    expect(tryDecryptSecret(encryptSecret('ok'))).toBe('ok')
  })
})

describe('hashing & comparison helpers', () => {
  it('sha256Hex is deterministic', () => {
    expect(sha256Hex('abc')).toBe(sha256Hex('abc'))
    expect(sha256Hex('abc')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('safeEqual rejects different and mismatched-length inputs', () => {
    expect(safeEqual('a', 'a')).toBe(true)
    expect(safeEqual('a', 'b')).toBe(false)
    expect(safeEqual('abc', 'ab')).toBe(false)
  })

  it('hmacSha256Hex matches known test vector', () => {
    // RFC 4231 test case 2
    expect(hmacSha256Hex('Jefe', 'what do ya want for nothing?')).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'
    )
  })

  it('dedupeKey is stable and order-sensitive', () => {
    expect(dedupeKey('page', '1', 123)).toBe(dedupeKey('page', '1', 123))
    expect(dedupeKey('page', '1', 123)).not.toBe(dedupeKey('page', '1', 124))
  })

  it('shortSlug emits lowercase alphanumeric strings', () => {
    const s = shortSlug(12)
    expect(s).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{12}$/)
  })
})
