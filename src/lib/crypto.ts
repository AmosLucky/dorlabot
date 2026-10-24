import crypto from 'crypto'

/**
 * Token / secret encryption — AES-256-GCM.
 * Stored format: v1.<iv_b64>.<tag_b64>.<ciphertext_b64>
 * The key comes from TOKEN_ENCRYPTION_KEY (32-byte hex or base64 or plain-long-string hashed).
 */

function encryptionKey(): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY || process.env.AUTH_SECRET || ''
  if (!secret) throw new Error('TOKEN_ENCRYPTION_KEY is not configured')
  if (/^[0-9a-fA-F]{64}$/.test(secret)) return Buffer.from(secret, 'hex')
  // derive a stable 32-byte key for non-hex secrets
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1.${iv.toString('base64')}.${tag.toString('base64')}.${ct.toString('base64')}`
}

export function decryptSecret(payload: string): string {
  if (!payload.startsWith('v1.')) throw new Error('Unsupported ciphertext format')
  const [, ivB64, tagB64, ctB64] = payload.split('.')
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const pt = Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()])
  return pt.toString('utf8')
}

/** Try to decrypt, returning null instead of throwing (e.g. rotated key). */
export function tryDecryptSecret(payload: string | null | undefined): string | null {
  if (!payload) return null
  try {
    return decryptSecret(payload)
  } catch {
    return null
  }
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url')
}

export function randomHex(bytes = 16): string {
  return crypto.randomBytes(bytes).toString('hex')
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

/** HMAC-SHA256 hex digest, used for Meta webhook signature verification. */
export function hmacSha256Hex(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex')
}

/** Deterministic dedupe key for webhook events. */
export function dedupeKey(...parts: (string | number | undefined | null)[]): string {
  return sha256Hex(parts.map((p) => (p === undefined || p === null ? '' : String(p))).join('|'))
}

/** Short readable slug (lowercase alnum). */
export function shortSlug(len = 10): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const buf = crypto.randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length]
  return out
}
