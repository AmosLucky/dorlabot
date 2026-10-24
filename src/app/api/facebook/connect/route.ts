import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { env } from '@/lib/env'
import { buildOAuthRedirectUrl } from '@/lib/meta/client'
import { issueToken } from '@/features/auth/tokens'

/**
 * Step 1 of the official connection flow:
 * issue a one-time OAuth state and redirect to Facebook's authorization dialog.
 */
export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login', env.appUrl))
  }
  if (!env.meta.configured) {
    return NextResponse.redirect(new URL('/dashboard/pages?error=meta_not_configured', env.appUrl))
  }
  const state = await issueToken({ type: 'OAUTH_STATE', userId: user.id, identifier: user.email, ttlMs: 10 * 60 * 1000 })
  return NextResponse.redirect(buildOAuthRedirectUrl(state))
}
