/**
 * Development / bootstrap seed.
 *
 *   bun run db:seed            → base seed (plans, settings, admin, demo customer)
 *   SEED_DEMO_DATA=1 bun run db:seed   → base + clearly-marked SAMPLE data for previews
 *
 * Safe to re-run: everything upserts. Sample rows are flagged isSample/demoData so
 * they can never be confused with production data, and are skipped entirely when
 * connecting real Pages.
 */

import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/password'
import { encryptSecret, shortSlug } from '../src/lib/crypto'
import { randomToken } from '../src/lib/crypto'

const db = new PrismaClient()

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    description: 'For a single Page getting started with comment automation.',
    priceMonthly: 0,
    maxPages: 1,
    maxContacts: 1000,
    maxAutomations: 3,
    features: ['Comment-to-DM automation', 'Welcome & default replies', 'Basic analytics'],
    sortOrder: 1,
  },
  {
    key: 'growth',
    name: 'Growth',
    description: 'For growing Pages running regular campaigns.',
    priceMonthly: 29,
    maxPages: 3,
    maxContacts: 10000,
    maxAutomations: 9,
    features: ['All automations', 'Broadcast campaigns', 'Click tracking & CTR', 'CSV export'],
    sortOrder: 2,
  },
  {
    key: 'pro',
    name: 'Pro',
    description: 'For agencies and multi-Page operations.',
    priceMonthly: 79,
    maxPages: 10,
    maxContacts: 100000,
    maxAutomations: 30,
    features: ['Priority queue delivery', 'Advanced segments', 'Audit-friendly activity log', 'Priority support'],
    sortOrder: 3,
  },
]

const SETTINGS = [
  { key: 'privateReplyWindowDays', value: 7, label: 'Private reply window (days)' },
  { key: 'messagingWindowHours', value: 24, label: 'Standard messaging window (hours)' },
  { key: 'campaignRatePerMinute', value: 60, label: 'Campaign sends per minute' },
  { key: 'maxPrivateRepliesPerComment', value: 1, label: 'Max private replies per comment' },
  { key: 'requireWindowForCampaigns', value: true, label: 'Require open window for campaigns' },
  { key: 'registrationEnabled', value: true, label: 'Public registration enabled' },
  { key: 'supportEmail', value: 'support@dorlacode.com', label: 'Support email' },
]

async function main() {
  console.log('🌱 Seeding platform data…')

  // Plans
  for (const plan of PLANS) {
    await db.subscriptionPlan.upsert({
      where: { key: plan.key },
      create: plan as never,
      update: { name: plan.name, description: plan.description, priceMonthly: plan.priceMonthly, maxPages: plan.maxPages, maxContacts: plan.maxContacts, maxAutomations: plan.maxAutomations, features: plan.features as never, sortOrder: plan.sortOrder },
    })
  }
  console.log('  ✓ subscription plans')

  // Platform settings
  for (const s of SETTINGS) {
    await db.platformSetting.upsert({ where: { key: s.key }, create: s as never, update: { label: s.label } })
  }
  console.log('  ✓ platform settings')

  // Super admin
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@dorlacode.com').toLowerCase()
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin123!'
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    create: {
      name: 'Platform Admin',
      email: adminEmail,
      passwordHash: hashPassword(adminPassword),
      role: 'ADMIN',
      emailVerifiedAt: new Date(),
    },
    update: { role: 'ADMIN' },
  })
  console.log(`  ✓ super admin: ${adminEmail} (password: ${adminPassword} — change in production!)`)

  // Demo customer
  const demoEmail = (process.env.SEED_DEMO_EMAIL || 'demo@dorlacode.com').toLowerCase()
  const demoPassword = process.env.SEED_DEMO_PASSWORD || 'Demo123!'
  const demo = await db.user.upsert({
    where: { email: demoEmail },
    create: {
      name: 'Demo Customer',
      email: demoEmail,
      passwordHash: hashPassword(demoPassword),
      role: 'CUSTOMER',
      emailVerifiedAt: new Date(),
      demoData: true,
    },
    update: { demoData: true },
  })
  const starter = await db.subscriptionPlan.findUnique({ where: { key: 'starter' } })
  if (starter) {
    await db.customerSubscription.upsert({
      where: { userId: demo.id },
      create: { userId: demo.id, planId: starter.id },
      update: {},
    })
  }
  console.log(`  ✓ demo customer: ${demoEmail} (password: ${demoPassword})`)

  // Tags
  const tags = await Promise.all(
    ['Hot lead', 'Pricing question', 'VIP'].map((name) =>
      db.contactTag.upsert({
        where: { userId_name: { userId: demo.id, name } },
        create: { userId: demo.id, name },
        update: {},
      })
    )
  )

  if (process.env.SEED_DEMO_DATA === '1') {
    console.log('  … adding clearly-marked SAMPLE data (SEED_DEMO_DATA=1)')

    const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000)

    const samplePage = await db.facebookPage.upsert({
      where: { userId_fbPageId: { userId: demo.id, fbPageId: '000000000000000' } },
      create: {
        userId: demo.id,
        fbPageId: '000000000000000',
        name: 'Sample Page (not connected)',
        category: 'Sample data',
        accessTokenEnc: encryptSecret(''),
        status: 'DISCONNECTED',
        webhookSubscribed: false,
        isSample: true,
        connectedAt: hoursAgo(72),
      },
      update: { isSample: true },
    })

    // Automations (paused, since the sample page is disconnected)
    await db.automation.upsert({
      where: { pageId_type: { pageId: samplePage.id, type: 'COMMENT_REPLY' } },
      create: {
        userId: demo.id,
        pageId: samplePage.id,
        type: 'COMMENT_REPLY',
        name: 'Price list auto-reply (sample)',
        status: 'PAUSED',
        replyTemplate: "Hi {{first_name}}! Thanks for your comment. Here's the information you requested: the full price list 👇",
        matchMode: 'keywords',
        enabledPosts: ['ALL'] as never,
        isSample: true,
        triggeredCount: 14,
        sentCount: 11,
        skippedCount: 2,
        failedCount: 1,
        lastRunAt: hoursAgo(3),
        rules: {
          create: [
            { keyword: 'price', matchType: 'CONTAINS' },
            { keyword: 'info', matchType: 'CONTAINS' },
            { keyword: 'how much', matchType: 'CONTAINS' },
          ],
        },
      },
      update: { isSample: true },
    })
    await db.automation.upsert({
      where: { pageId_type: { pageId: samplePage.id, type: 'WELCOME_MESSAGE' } },
      create: {
        userId: demo.id,
        pageId: samplePage.id,
        type: 'WELCOME_MESSAGE',
        name: 'Welcome message (sample)',
        status: 'PAUSED',
        replyTemplate: 'Hello {{first_name}}! 👋 Welcome to our page. How can we help you today?',
        matchMode: 'any',
        isSample: true,
        triggeredCount: 8,
        sentCount: 8,
        lastRunAt: hoursAgo(6),
      },
      update: { isSample: true },
    })
    await db.automation.upsert({
      where: { pageId_type: { pageId: samplePage.id, type: 'DEFAULT_REPLY' } },
      create: {
        userId: demo.id,
        pageId: samplePage.id,
        type: 'DEFAULT_REPLY',
        name: 'Default reply (sample)',
        status: 'PAUSED',
        replyTemplate: 'Hi {{first_name}}! Thanks for reaching out — here is everything about {{page_name}} you asked for.',
        fallbackReply: 'Hi {{first_name}}! Thanks for reaching out. Our team will be happy to assist you.',
        matchMode: 'keywords+fallback',
        isSample: true,
        triggeredCount: 5,
        sentCount: 5,
        lastRunAt: hoursAgo(9),
        rules: { create: [{ keyword: 'hours', matchType: 'CONTAINS' }, { keyword: 'support', matchType: 'CONTAINS' }] },
      },
      update: { isSample: true },
    })

    // Contacts
    const contactSpecs = [
      ['Sara Mensah', '100000000000001', 'ELIGIBLE', 2],
      ['Tunde Bakare', '100000000000002', 'ELIGIBLE', 5],
      ['Chidi Okafor', '100000000000003', 'UNKNOWN', 30],
      ['Amara Diallo', '100000000000004', 'ELIGIBLE', 8],
      ['Ngozi Eze', '100000000000005', 'OPTED_OUT', 50],
      ['Kwame Boateng', '100000000000006', 'UNKNOWN', 70],
      ['Fatima Bello', '100000000000007', 'ELIGIBLE', 12],
      ['Emeka Nwosu', '100000000000008', 'UNKNOWN', 90],
    ] as const
    const contacts = []
    for (const [name, psid, state, hrs] of contactSpecs) {
      const [firstName, lastName] = [name.split(' ')[0], name.split(' ')[1]]
      const c = await db.contact.upsert({
        where: { userId_fbPsid: { userId: demo.id, fbPsid: psid } },
        create: {
          userId: demo.id,
          pageId: samplePage.id,
          fbPsid: psid,
          name,
          firstName,
          lastName,
          source: hrs % 2 === 0 ? 'comment_reply' : 'messenger',
          messagingState: state as never,
          messagingWindowUntil: state === 'ELIGIBLE' ? new Date(Date.now() + (24 - hrs) * 3600 * 1000) : null,
          optedOutAt: state === 'OPTED_OUT' ? hoursAgo(hrs) : null,
          isSample: true,
          firstInteractionAt: hoursAgo(hrs + 48),
          lastInteractionAt: hoursAgo(hrs),
        },
        update: { isSample: true },
      })
      contacts.push(c)
    }
    // Assign tags to some contacts
    const tagAssignments: [number, number][] = [
      [0, 0], [1, 1], [3, 0], [3, 2], [6, 1],
    ]
    for (const [ci, ti] of tagAssignments) {
      await db.contactTagAssignment.upsert({
        where: { contactId_tagId: { contactId: contacts[ci].id, tagId: tags[ti].id } },
        create: { contactId: contacts[ci].id, tagId: tags[ti].id },
        update: {},
      })
    }

    // Sample campaign with recipients, messages, tracked link + clicks
    const campaign = await db.campaign.upsert({
      where: { id: 'sample-campaign-1' },
      create: {
        id: 'sample-campaign-1',
        userId: demo.id,
        name: 'October promo (sample)',
        body: 'Hi {{first_name}}, we have an update for you. Tap here to learn more: {{tracked_link}}',
        trackedTargetUrl: 'https://example.com/october-promo',
        status: 'COMPLETED',
        audienceSegment: { tagIds: [] } as never,
        eligibleCount: 4,
        totalRecipients: 4,
        sentCount: 4,
        failedCount: 0,
        skippedCount: 0,
        startedAt: hoursAgo(20),
        completedAt: hoursAgo(19),
        isSample: true,
        createdAt: hoursAgo(21),
      },
      update: { isSample: true },
    }).catch(async () => {
      return db.campaign.findUniqueOrThrow({ where: { id: 'sample-campaign-1' } })
    })

    const link = await db.trackedLink.upsert({
      where: { slug: 'sampleoct' },
      create: {
        userId: demo.id,
        campaignId: campaign.id,
        slug: 'sampleoct',
        targetUrl: 'https://example.com/october-promo',
        title: 'October promo (sample)',
        clickCount: 6,
        uniqueClickCount: 3,
      },
      update: {},
    })

    const eligibleContacts = contacts.filter((_, i) => [0, 1, 3, 6].includes(i))
    for (const [i, c] of eligibleContacts.entries()) {
      const recipient = await db.campaignRecipient.upsert({
        where: { campaignId_contactId: { campaignId: campaign.id, contactId: c.id } },
        create: {
          campaignId: campaign.id,
          contactId: c.id,
          status: 'SENT',
          recipientToken: randomToken(12),
          sentAt: hoursAgo(20 - i),
        },
        update: {},
      })
      await db.message.upsert({
        where: { mid: `sample_mid_${i}` },
        create: {
          userId: demo.id,
          pageId: samplePage.id,
          contactId: c.id,
          campaignId: campaign.id,
          direction: 'OUTGOING',
          status: i % 3 === 0 ? 'READ' : i % 3 === 1 ? 'DELIVERED' : 'SENT',
          body: `Hi ${c.firstName}, we have an update for you. Tap here to learn more: https://dorlacode.com/l/sampleoct?c=${recipient.recipientToken}`,
          mid: `sample_mid_${i}`,
          sentAt: hoursAgo(20 - i),
          isSample: true,
          createdAt: hoursAgo(20 - i),
        },
        update: {},
      })
    }
    // Clicks: 3 unique clickers, 6 total clicks
    const clickSpecs = [
      [0, 20], [0, 19], [1, 18], [3, 16], [3, 15], [6, 12],
    ] as const
    for (const [ci, hrs] of clickSpecs) {
      await db.linkClick.createMany({
        data: [{ linkId: link.id, campaignId: campaign.id, contactId: contacts[ci].id, occurredAt: hoursAgo(hrs) }],
        skipDuplicates: true,
      })
    }

    // A couple of inbound/outbound activity rows
    await db.message.upsert({
      where: { mid: 'sample_in_1' },
      create: {
        userId: demo.id,
        pageId: samplePage.id,
        contactId: contacts[0].id,
        direction: 'INCOMING',
        status: 'RECEIVED',
        body: 'Hi! Do you have this in blue?',
        mid: 'sample_in_1',
        isSample: true,
        createdAt: hoursAgo(2),
      },
      update: {},
    })

    console.log('  ✓ sample data (Pages: DISCONNECTED sample; automations paused; marked SAMPLE in UI)')
  }

  console.log('✅ Seed complete.')
  console.log('   Admin login:    /login with the admin credentials printed above')
  console.log('   Demo login:     /login with the demo credentials printed above')
}

main()
  .catch((err) => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
