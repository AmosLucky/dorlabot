import 'server-only'
import { cookies, headers } from 'next/headers'
import { db } from '@/lib/db'
import { sha256Hex, randomToken } from '@/lib/crypto'
import { env } from '@/lib/env'
import type { User } from '@prisma/client'

export const SESSION_COOKIE = 'dorla_session'
const SESSION_TTL_DAYS = 30

export type SessionUser = Pick<
  User,
  'id' | 'email' | 'name' | 'role' | 'status' | 'emailVerifiedAt' | 'twoFactorEnabled' | 'demoData' | 'notificationPrefs'
>

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 3600 * 1000)
  let ip: string | null = null
  let userAgent: string | null = null
  try {
    const h = await headers()
    ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
    userAgent = h.get('user-agent')?.slice(0, 300) || null
  } catch {
    /* outside request scope */
  }
  await db.session.create({
    data: { userId, tokenHash: sha256Hex(token), expiresAt, ip, userAgent },
  })
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    expires: expiresAt,
    path: '/',
  })
  return { token, expiresAt }
}

/** Returns the authenticated user for the current request, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null
  const session = await db.session.findUnique({
    where: { tokenHash: sha256Hex(token) },
    include: { user: true },
  })
  if (!session) return null
  if (session.expiresAt < new Date() || session.revokedAt) {
    return null
  }
  const { user } = session
  if (user.status !== 'ACTIVE') return null
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    twoFactorEnabled: user.twoFactorEnabled,
    demoData: user.demoData,
    notificationPrefs: user.notificationPrefs,
  }
}

export async function destroyCurrentSession(): Promise<void> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) {
    await db.session.updateMany({ where: { tokenHash: sha256Hex(token) }, data: { revokedAt: new Date() } })
  }
  jar.delete(SESSION_COOKIE)
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
}

export class AuthError extends Error {
  status: number
  code: string
  constructor(code: string, message: string, status = 401) {
    super(message)
    this.code = code
    this.status = status
  }
}

/** Require any authenticated user (customer or admin). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) throw new AuthError('UNAUTHENTICATED', 'You must be signed in.', 401)
  return user
}

/** Require an authenticated CUSTOMER (admin accounts do not use customer dashboard). */
export async function requireCustomer(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== 'CUSTOMER') throw new AuthError('FORBIDDEN', 'Customer access required.', 403)
  return user
}

/** Require an authenticated ADMIN. Server-side role check — never rely on hidden nav links. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== 'ADMIN') throw new AuthError('FORBIDDEN', 'Administrator access required.', 403)
  return user
}

export async function getClientIp(): Promise<string> {
  try {
    const h = await headers()
    return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
  } catch {
    return 'unknown'
  }
}
