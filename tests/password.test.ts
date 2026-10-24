import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, passwordStrengthError } from '../src/lib/password'

describe('password hashing (scrypt)', () => {
  it('hashes and verifies a password', () => {
    const hash = hashPassword('CorrectHorse1')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(verifyPassword('CorrectHorse1', hash)).toBe(true)
  })

  it('rejects wrong passwords', () => {
    const hash = hashPassword('CorrectHorse1')
    expect(verifyPassword('wrong', hash)).toBe(false)
    expect(verifyPassword('', hash)).toBe(false)
  })

  it('handles malformed/absent hashes safely', () => {
    expect(verifyPassword('x', null)).toBe(false)
    expect(verifyPassword('x', '')).toBe(false)
    expect(verifyPassword('x', 'not-a-hash')).toBe(false)
  })

  it('salts: same password yields different hashes', () => {
    expect(hashPassword('SamePass1')).not.toBe(hashPassword('SamePass1'))
  })
})

describe('password strength policy', () => {
  it('enforces length, letters, and numbers', () => {
    expect(passwordStrengthError('short1')).toMatch(/8 characters/)
    expect(passwordStrengthError('nonumbershere')).toMatch(/number/)
    expect(passwordStrengthError('12345678')).toMatch(/letter/)
    expect(passwordStrengthError('GoodPass123')).toBeNull()
  })
})
