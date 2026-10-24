import { z } from 'zod'
import { db } from '@/lib/db'
import { jsonOk, handleApiError, parseBody, enforceRateLimitAsync } from '@/lib/api'
import { sendEmail } from '@/lib/email'
import { env } from '@/lib/env'
import { getPlatformSettings } from '@/lib/settings'

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().min(2).max(200),
  message: z.string().trim().min(10).max(5000),
})

/** Public contact form → routed to the support inbox (or dev outbox). */
export async function POST(req: Request) {
  try {
    await enforceRateLimitAsync('contact', { limit: 5, windowMs: 60 * 60 * 1000 })
    const body = await parseBody(req, schema)
    const settings = await getPlatformSettings()
    await sendEmail(
      settings.supportEmail,
      `[Contact] ${body.subject}`,
      `From: ${body.name} <${body.email}>\n\n${body.message}`
    )
    await db.emailMessage.create({
      data: {
        toEmail: settings.supportEmail,
        subject: `[Contact] ${body.subject}`,
        body: `From: ${body.name} <${body.email}>\n\n${body.message}`,
        status: env.email.configured ? 'SENT' : 'LOGGED_DEV',
      },
    })
    return jsonOk({ sent: true })
  } catch (err) {
    return handleApiError(err)
  }
}
