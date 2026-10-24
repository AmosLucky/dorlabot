import { db } from '@/lib/db'
import { sha256Hex, randomToken } from '@/lib/crypto'
import type { VerificationTokenType } from '@prisma/client'

/** One-time verification tokens (email verify, password reset, OAuth state, 2FA pending). */

export async function issueToken(params: {
  type: VerificationTokenType
  userId?: string | null
  identifier?: string
  ttlMs: number
}): Promise<string> {
  const token = randomToken(32)
  await db.verificationToken.create({
    data: {
      type: params.type,
      userId: params.userId ?? null,
      identifier: params.identifier ?? '',
      tokenHash: sha256Hex(token),
      expiresAt: new Date(Date.now() + params.ttlMs),
    },
  })
  return token
}

export async function consumeToken(params: {
  type: VerificationTokenType
  token: string
}): Promise<{ userId: string | null; identifier: string } | null> {
  const record = await db.verificationToken.findUnique({
    where: { tokenHash: sha256Hex(params.token) },
  })
  if (!record || record.type !== params.type || record.usedAt) return null
  if (record.expiresAt < new Date()) return null
  await db.verificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } })
  return { userId: record.userId, identifier: record.identifier }
}

export async function consumeOAuthState(state: string): Promise<boolean> {
  const result = await consumeToken({ type: 'OAUTH_STATE', token: state })
  return result !== null
}
