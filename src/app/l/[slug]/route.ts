import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { env } from '@/lib/env'

/**
 * Tracked-link redirect: /l/{slug}?c={recipientToken}
 * - Records the click (deduplicated per contact+link for unique counts).
 * - 302 to the destination. No PII beyond what Meta already provided.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const url = new URL(req.url)
  const recipientToken = url.searchParams.get('c')
  const link = await db.trackedLink.findUnique({ where: { slug } })
  if (!link) {
    return NextResponse.redirect(new URL('/', env.appUrl), 302)
  }

  let contactId: string | null = null
  let campaignId: string | null = link.campaignId
  if (recipientToken) {
    const recipient = await db.campaignRecipient.findUnique({
      where: { recipientToken },
      select: { contactId: true, campaignId: true },
    })
    if (recipient) {
      contactId = recipient.contactId
      campaignId = recipient.campaignId ?? campaignId
    }
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = req.headers.get('user-agent')?.slice(0, 300) ?? null
  const referer = req.headers.get('referer')?.slice(0, 300) ?? null

  try {
    let uniqueIncremented = false
    if (contactId) {
      // skipDuplicates: repeat clicks by the same contact violate the unique(link,contact)
      // constraint and are silently ignored — counts stay deduplicated.
      const created = await db.linkClick.createMany({
        data: [{ linkId: link.id, campaignId, contactId, ip, userAgent, referer }],
        skipDuplicates: true,
      })
      uniqueIncremented = created.count === 1
    } else {
      await db.linkClick.create({ data: { linkId: link.id, campaignId, contactId, ip, userAgent, referer } })
    }
    await db.trackedLink.update({
      where: { id: link.id },
      data: {
        clickCount: { increment: 1 },
        ...(uniqueIncremented ? { uniqueClickCount: { increment: 1 } } : {}),
      },
    })
  } catch (err) {
    // Never block the redirect on tracking failures.
    console.error('[track] click recording failed:', err)
  }

  const target = new URL(link.targetUrl)
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return NextResponse.redirect(new URL('/', env.appUrl), 302)
  }
  return NextResponse.redirect(target.toString(), 302)
}

export const dynamic = 'force-dynamic'
