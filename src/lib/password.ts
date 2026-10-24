import crypto from 'crypto'

/**
 * Password hashing with scrypt (Node built-in, no native deps).
 * Format: scrypt$N$r$p$<salt_hex>$<hash_hex>
 */
const N = 16384
const r = 8
const p = 1
const KEYLEN = 64

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, KEYLEN, { N, r, p })
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  try {
    const n = parseInt(parts[1], 10)
    const rr = parseInt(parts[2], 10)
    const pp = parseInt(parts[3], 10)
    const salt = Buffer.from(parts[4], 'hex')
    const expected = Buffer.from(parts[5], 'hex')
    const actual = crypto.scryptSync(password, salt, expected.length, { N: n, r: rr, p: pp })
    return crypto.timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function passwordStrengthError(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters long.'
  if (password.length > 128) return 'Password must be at most 128 characters long.'
  if (!/[a-zA-Z]/.test(password)) return 'Password must contain at least one letter.'
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number.'
  return null
}
