import { db } from '@/lib/db'
import { env } from '@/lib/env'

/**
 * Transactional email. Uses SMTP when configured; otherwise records the
 * message in the EmailMessage outbox (status LOGGED_DEV) so development
 * and preview environments can complete verification flows.
 */

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const record = await db.emailMessage.create({
    data: { toEmail: to, subject, body, status: env.email.configured ? 'QUEUED' : 'LOGGED_DEV' },
  })

  if (!env.email.configured) {
    // Development mode: log so the operator can copy verification links from the server log.
    console.log(`[email:dev] to=${to} subject="${subject}"\n${body}`)
    return
  }

  try {
    const nodemailer = await import('nodemailer')
    const transport = nodemailer.createTransport({
      host: env.email.host,
      port: env.email.port,
      secure: env.email.port === 465,
      auth: { user: env.email.user, pass: env.email.password },
    })
    await transport.sendMail({ from: env.email.from, to, subject, text: body })
    await db.emailMessage.update({ where: { id: record.id }, data: { status: 'SENT', sentAt: new Date() } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown SMTP error'
    await db.emailMessage.update({ where: { id: record.id }, data: { status: 'FAILED', error: message } })
    console.error('[email] send failed:', message)
  }
}

/** In non-production without SMTP, verification links are returned to the caller for convenience. */
export function devEmailLinkEnabled(): boolean {
  return !env.isProduction && !env.email.configured
}
