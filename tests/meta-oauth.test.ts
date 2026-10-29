import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildOAuthRedirectUrl } from '../src/lib/meta/client'

describe('Meta OAuth redirect', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
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
})
