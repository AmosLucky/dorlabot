import { beforeEach, vi } from 'vitest'

// Deterministic test environment. Unit tests never touch the network or the
// real database; Meta API responses are mocked at the caller level.
beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('TOKEN_ENCRYPTION_KEY', 'a'.repeat(64))
  vi.stubEnv('AUTH_SECRET', 't'.repeat(64))
  vi.stubEnv('META_APP_SECRET', 'test-app-secret')
  vi.stubEnv('META_WEBHOOK_VERIFY_TOKEN', 'test-verify-token')
  vi.stubEnv('META_GRAPH_API_VERSION', 'v23.0')
})
