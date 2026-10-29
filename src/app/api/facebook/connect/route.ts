import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { env } from '@/lib/env'
import { buildOAuthRedirectUrl } from '@/lib/meta/client'
import { issueToken } from '@/features/auth/tokens'
import { tryDecryptSecret } from '@/lib/crypto'
import { debugToken, getUserPages, GraphApiError } from '@/lib/meta/client'

/**
 * Reuse a previous Facebook grant when possible. First-time connections (or
 * expired/revoked grants) must go through Meta authorization to obtain consent.
 */
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', env.appUrl))
  }
  if (!env.meta.configured) {
    return NextResponse.redirect(new URL('/dashboard/pages?error=meta_not_configured', env.appUrl))
  }

  const account = await db.oAuthAccount.findFirst({
    where: { userId: user.id, provider: 'facebook', accessTokenEnc: { not: null } },
    orderBy: { updatedAt: 'desc' },
    select: { accessTokenEnc: true },
  })
  const userToken = tryDecryptSecret(account?.accessTokenEnc)

  if (userToken) {
    try {
      const debug = await debugToken(userToken)
      if (debug.isValid) {
        const pages = await getUserPages(userToken)
        if (pages.length === 0) {
          return NextResponse.redirect(new URL('/dashboard/pages?error=no_pages', env.appUrl))
        }

        const selection = await db.pendingPageSelection.create({
          data: {
            userId: user.id,
            fbUserId: debug.userId ?? null,
            payload: {
              pages: pages.map((page) => ({
                id: page.id,
                name: page.name,
                category: page.category ?? null,
                tasks: page.tasks ?? [],
              })),
              tokens: Object.fromEntries(pages.map((page) => [page.id, page.access_token])),
            } as never,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          },
        })
        return NextResponse.redirect(new URL(`/dashboard/pages/connect?selection=${selection.id}`, env.appUrl))
      }
    } catch (err) {
      if (!(err instanceof GraphApiError) || (!err.isTokenError && !err.isPermissionError)) {
        console.error('[facebook/connect] could not reuse saved Facebook authorization:', err)
        return NextResponse.redirect(new URL('/dashboard/pages?error=graph_error', env.appUrl))
      }
    }
  }

  const state = await issueToken({ type: 'OAUTH_STATE', userId: user.id, identifier: user.email, ttlMs: 10 * 60 * 1000 })
  return NextResponse.redirect(buildOAuthRedirectUrl(state))
}
