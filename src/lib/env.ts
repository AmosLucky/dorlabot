/**
 * Central environment configuration with startup validation.
 * Meta credentials are OPTIONAL until the operator configures them —
 * the app must clearly show "integration setup required" states instead
 * of pretending connections work.
 */

function required(name: string, fallback?: string): string {
  const v = process.env[name] || fallback
  if (!v) throw new Error(`Missing required environment variable: ${name}`)
  return v
}

function optional(name: string): string {
  return process.env[name]?.trim() || ''
}

export const env = {
  get nodeEnv() {
    return process.env.NODE_ENV || 'development'
  },
  get isProduction() {
    return process.env.NODE_ENV === 'production'
  },
  get appUrl() {
    return optional('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000'
  },
  get authSecret() {
    return required('AUTH_SECRET', 'insecure-dev-secret-change-me')
  },
  get databaseUrl() {
    return process.env.DATABASE_URL || ''
  },
  get redisUrl() {
    return optional('REDIS_URL')
  },
  meta: {
    get appId() {
      return optional('META_APP_ID')
    },
    get appSecret() {
      return optional('META_APP_SECRET')
    },
    get loginConfigId() {
      return optional('META_LOGIN_CONFIG_ID')
    },
    get graphApiVersion() {
      return optional('META_GRAPH_API_VERSION') || 'v23.0'
    },
    get redirectUri() {
      return optional('META_REDIRECT_URI') || `${optional('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000'}/api/facebook/callback`
    },
    get webhookVerifyToken() {
      return optional('META_WEBHOOK_VERIFY_TOKEN')
    },
    get configured() {
      return Boolean(optional('META_APP_ID') && optional('META_APP_SECRET'))
    },
  },
  email: {
    get host() {
      return optional('EMAIL_SERVER_HOST')
    },
    get port() {
      return parseInt(optional('EMAIL_SERVER_PORT') || '587', 10)
    },
    get user() {
      return optional('EMAIL_SERVER_USER')
    },
    get password() {
      return optional('EMAIL_SERVER_PASSWORD')
    },
    get from() {
      return optional('EMAIL_FROM') || 'no-reply@localhost'
    },
    get configured() {
      return Boolean(optional('EMAIL_SERVER_HOST') && optional('EMAIL_SERVER_USER'))
    },
  },
  get adminBootstrapEmails(): string[] {
    return (process.env.ADMIN_BOOTSTRAP_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  },
}

export function validateEnvAtStartup(): { ok: boolean; problems: string[] } {
  const problems: string[] = []
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET === 'insecure-dev-secret-change-me') {
    if (env.isProduction) problems.push('AUTH_SECRET must be set to a long random value in production.')
  }
  if (!process.env.DATABASE_URL) problems.push('DATABASE_URL is required.')
  if (env.isProduction && !env.redisUrl) problems.push('REDIS_URL is required in production for background processing.')
  if (env.isProduction && !env.meta.webhookVerifyToken) problems.push('META_WEBHOOK_VERIFY_TOKEN is required in production.')
  return { ok: problems.length === 0, problems }
}
