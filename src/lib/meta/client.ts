import { env } from '@/lib/env'

/**
 * Minimal, fully typed Meta Graph API client (official API only).
 * All functions require explicit access tokens; secrets never leave the server.
 */

const GRAPH_BASE = 'https://graph.facebook.com'

export class GraphApiError extends Error {
  httpStatus: number
  code?: number
  subcode?: number
  type?: string
  constructor(message: string, httpStatus: number, code?: number, subcode?: number, type?: string) {
    super(message)
    this.httpStatus = httpStatus
    this.code = code
    this.subcode = subcode
    this.type = type
  }
  /** OAuth token errors (expired/revoked/invalid) → user must reconnect the page. */
  get isTokenError(): boolean {
    return this.code === 190 || this.httpStatus === 401
  }
  get isPermissionError(): boolean {
    return this.code === 200 || this.code === 3 || this.code === 10
  }
}

async function graphFetch<T>(path: string, params: Record<string, string> = {}, init?: RequestInit): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${env.meta.graphApiVersion}/${path.replace(/^\//, '')}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  let res: Response
  try {
    res = await fetch(url.toString(), { ...init, signal: AbortSignal.timeout(20000) })
  } catch (err) {
    throw new GraphApiError(err instanceof Error ? `Network error calling Graph API: ${err.message}` : 'Network error calling Graph API', 0)
  }
  const text = await res.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    throw new GraphApiError(`Invalid JSON from Graph API (HTTP ${res.status})`, res.status)
  }
  if (!res.ok) {
    const e = (body as { error?: { message?: string; code?: number; error_subcode?: number; type?: string } }).error
    throw new GraphApiError(e?.message || `Graph API error (HTTP ${res.status})`, res.status, e?.code, e?.error_subcode, e?.type)
  }
  return body as T
}

// ── OAuth ────────────────────────────────────────────────────────────

export function buildOAuthRedirectUrl(state: string): string {
  const url = new URL(`https://www.facebook.com/${env.meta.graphApiVersion}/dialog/oauth`)
  url.searchParams.set('client_id', env.meta.appId)
  url.searchParams.set('redirect_uri', env.meta.redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('response_type', 'code')
  if (env.meta.loginConfigId) {
    url.searchParams.set('config_id', env.meta.loginConfigId)
    url.searchParams.set('override_default_response_type', 'true')
  } else {
    // Login for Business configurations define their requested permissions in Meta.
    // Keep classic Facebook Login available for apps that have not set a config ID.
    url.searchParams.set('scope', 'pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging')
  }
  return url.toString()
}

export async function exchangeCodeForToken(code: string): Promise<{ accessToken: string; expiresIn?: number }> {
  const res = await graphFetch<{ access_token: string; expires_in?: number }>('oauth/access_token', {
    client_id: env.meta.appId,
    client_secret: env.meta.appSecret,
    redirect_uri: env.meta.redirectUri,
    code,
  })
  return { accessToken: res.access_token, expiresIn: res.expires_in }
}

export async function debugToken(inputToken: string): Promise<{ isValid: boolean; expiresAt: Date | null; scopes: string[]; userId?: string }> {
  const res = await graphFetch<{ data: { is_valid: boolean; expires_at?: number; scopes?: string[]; user_id?: string } }>('debug_token', {
    input_token: inputToken,
    access_token: `${env.meta.appId}|${env.meta.appSecret}`,
  })
  return {
    isValid: res.data.is_valid,
    expiresAt: res.data.expires_at ? new Date(res.data.expires_at * 1000) : null,
    scopes: res.data.scopes ?? [],
    userId: res.data.user_id,
  }
}

export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{ accessToken: string; expiresIn?: number }> {
  return graphFetch('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: env.meta.appId,
    client_secret: env.meta.appSecret,
    fb_exchange_token: shortLivedToken,
  })
}

// ── Pages ────────────────────────────────────────────────────────────

export type GraphPage = {
  id: string
  name: string
  category?: string
  access_token: string
  tasks?: string[]
}

export async function getUserPages(userAccessToken: string): Promise<GraphPage[]> {
  const pages: GraphPage[] = []
  let after: string | undefined
  do {
    const res = await graphFetch<{ data: GraphPage[]; paging?: { cursors?: { after?: string } } }>('me/accounts', {
      access_token: userAccessToken,
      fields: 'id,name,category,access_token,tasks',
      limit: '50',
      ...(after ? { after } : {}),
    })
    pages.push(...(res.data ?? []))
    after = res.paging?.cursors?.after
  } while (after)
  return pages
}

export async function getPageDetails(pageAccessToken: string, pageId: string): Promise<{ id: string; name: string; category?: string }> {
  return graphFetch(pageId, { access_token: pageAccessToken, fields: 'id,name,category' })
}

export async function subscribePageToApp(pageAccessToken: string, pageId: string): Promise<{ success: boolean }> {
  return graphFetch(
    `${pageId}/subscribed_apps`,
    { access_token: pageAccessToken, subscribed_fields: 'feed,messages,messaging_postbacks,message_deliveries,message_reads' },
    { method: 'POST' }
  )
}

export async function unsubscribePageFromApp(pageAccessToken: string, pageId: string): Promise<{ success: boolean }> {
  return graphFetch(`${pageId}/subscribed_apps`, { access_token: pageAccessToken }, { method: 'DELETE' })
}

// ── Send APIs ────────────────────────────────────────────────────────

export async function sendPrivateReply(pageAccessToken: string, pageId: string, commentId: string, text: string): Promise<{ messageId: string }> {
  const res = await graphFetch<{ message_id: string }>(
    `${pageId}/messages`,
    { access_token: pageAccessToken },
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
    }
  )
  return { messageId: res.message_id }
}

export async function sendMessageToPsid(pageAccessToken: string, pageId: string, psid: string, text: string, quickReplies?: { content_type: 'text'; title: string; payload: string }[]): Promise<{ messageId: string }> {
  const message: Record<string, unknown> = { text }
  if (quickReplies && quickReplies.length > 0) message.quick_replies = quickReplies.slice(0, 11)
  const res = await graphFetch<{ message_id: string; recipient_id: string }>(
    `${pageId}/messages`,
    { access_token: pageAccessToken },
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recipient: { id: psid }, message }),
    }
  )
  return { messageId: res.message_id }
}

export async function getUserProfileByPsid(pageAccessToken: string, psid: string): Promise<{ first_name?: string; last_name?: string; name?: string; profile_pic?: string; locale?: string } | null> {
  try {
    return await graphFetch(`${psid}`, { access_token: pageAccessToken, fields: 'first_name,last_name,name,profile_pic,locale' })
  } catch (err) {
    if (err instanceof GraphApiError && (err.isPermissionError || err.code === 100)) return null
    throw err
  }
}
