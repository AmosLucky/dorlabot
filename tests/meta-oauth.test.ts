import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildOAuthRedirectUrl, exchangeForLongLivedToken } from '../src/lib/meta/client'

describe('Meta OAuth redirect', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('uses the configured Login for Business flow when a configuration ID is set', () => {
    vi.stubEnv('META_APP_ID', 'test-app-id')
    vi.stubEnv('META_REDIRECT_URI', 'https://example.com/api/facebook/callback')
    vi.stubEnv('META_LOGIN_CONFIG_ID', 'test-login-config')

    const url = new URL(buildOAuthRedirectUrl('test-state'))

    expect(url.searchParams.get('config_id')).toBe('test-login-config')
    expect(url.searchParams.get('override_default_response_type')).toBe('true')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('redirect_uri')).toBe('https://example.com/api/facebook/callback')
    expect(url.searchParams.has('scope')).toBe(false)
  })

  it('keeps classic Facebook Login when no Login for Business configuration is set', () => {
    vi.stubEnv('META_APP_ID', 'test-app-id')
    vi.stubEnv('META_REDIRECT_URI', 'https://example.com/api/facebook/callback')
    vi.stubEnv('META_LOGIN_CONFIG_ID', '')

    const url = new URL(buildOAuthRedirectUrl('test-state'))

    expect(url.searchParams.has('config_id')).toBe(false)
    expect(url.searchParams.get('scope')).toContain('pages_show_list')
    expect(url.searchParams.get('response_type')).toBe('code')
  })

  it('maps Meta long-lived token response fields to the client token shape', async () => {
    vi.stubEnv('META_APP_ID', 'test-app-id')
    vi.stubEnv('META_APP_SECRET', 'test-app-secret')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'long-lived-token', expires_in: 5184000 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ))

    await expect(exchangeForLongLivedToken('short-lived-token')).resolves.toEqual({
      accessToken: 'long-lived-token',
      expiresIn: 5184000,
    })
  })
})
