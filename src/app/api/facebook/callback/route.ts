import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { env } from '@/lib/env'
import { encryptSecret } from '@/lib/crypto'
import { exchangeCodeForToken, exchangeForLongLivedToken, debugToken, getUserPages, GraphApiError } from '@/lib/meta/client'
import { consumeToken } from '@/features/auth/tokens'

/**
 * Step 2 of the official connection flow:
 * validate state + callback params, exchange the code server-side, upgrade to a
 * long-lived user token, fetch manageable Pages, and park them in a temporary
 * server-side record for the selection step. Tokens never touch the browser.
 */
export async function GET(req: Request) {
  const appUrl = env.appUrl
  const url = new URL(req.url)
  const user = await getSessionUser()
  if (!user) return NextResponse.redirect(new URL('/login', appUrl))

  const oauthError = url.searchParams.get('error')
  const oauthErrorDesc = url.searchParams.get('error_description')
  if (oauthError) {
    const reason = oauthError === 'access_denied' ? 'authorization_denied' : 'oauth_error'
    console.warn(`[facebook/callback] ${reason}: ${oauthErrorDesc ?? oauthError}`)
    return NextResponse.redirect(new URL(`/dashboard/pages?error=${reason}`, appUrl))
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (!code || !state) {
    return NextResponse.redirect(new URL('/dashboard/pages?error=missing_params', appUrl))
  }

  // CSRF protection: one-time state bound to this user.
  const consumed = await consumeToken({ type: 'OAUTH_STATE', token: state })
  if (!consumed || consumed.userId !== user.id) {
    return NextResponse.redirect(new URL('/dashboard/pages?error=invalid_state', appUrl))
  }

  if (!env.meta.configured) {
    return NextResponse.redirect(new URL('/dashboard/pages?error=meta_not_configured', appUrl))
  }

  try {
    const shortLived = await exchangeCodeForToken(code)
    let userToken = shortLived.accessToken
    let tokenExpiresAt: Date | null = shortLived.expiresIn ? new Date(Date.now() + shortLived.expiresIn * 1000) : null
    try {
      const longLived = await exchangeForLongLivedToken(shortLived.accessToken)
      userToken = longLived.accessToken
      tokenExpiresAt = longLived.expiresIn ? new Date(Date.now() + longLived.expiresIn * 1000) : null
    } catch {
      // Fall back to the short-lived token; page sync may fail earlier but connection still works.
    }

    const debug = await debugToken(userToken)
    if (!debug.isValid) {
      return NextResponse.redirect(new URL('/dashboard/pages?error=token_invalid', appUrl))
    }

    const pages = await getUserPages(userToken)
    if (pages.length === 0) {
      return NextResponse.redirect(new URL('/dashboard/pages?error=no_pages', appUrl))
    }

    await db.oAuthAccount.upsert({
      where: { provider_providerAccountId: { provider: 'facebook', providerAccountId: debug.userId ?? user.id } },
      create: {
        userId: user.id,
        provider: 'facebook',
        providerAccountId: debug.userId ?? user.id,
        accessTokenEnc: encryptSecret(userToken),
        tokenExpiresAt,
      },
      update: { accessTokenEnc: encryptSecret(userToken), tokenExpiresAt },
    })

    const selection = await db.pendingPageSelection.create({
      data: {
        userId: user.id,
        fbUserId: debug.userId ?? null,
        payload: {
          pages: pages.map((p) => ({
            id: p.id,
            name: p.name,
            category: p.category ?? null,
            tasks: p.tasks ?? [],
            // token stored server-side only, referenced by id in the selection payload
          })),
          tokens: Object.fromEntries(pages.map((p) => [p.id, p.access_token])),
        } as never,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    })

    return NextResponse.redirect(new URL(`/dashboard/pages/connect?selection=${selection.id}`, appUrl))
  } catch (err) {
    if (err instanceof GraphApiError) {
      console.error('[facebook/callback] graph error:', err.message)
      return NextResponse.redirect(new URL('/dashboard/pages?error=graph_error', appUrl))
    }
    console.error('[facebook/callback] unexpected error:', err)
    return NextResponse.redirect(new URL('/dashboard/pages?error=unexpected', appUrl))
  }
}
