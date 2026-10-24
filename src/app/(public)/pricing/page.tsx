import Link from 'next/link'
import type { Metadata } from 'next'
import { db } from '@/lib/db'

export const metadata: Metadata = { title: 'Pricing' }
export const dynamic = 'force-dynamic'

export default async function PricingPage() {
  // Plans are configurable by super admins (SubscriptionPlan table); fall back to defaults.
  let plans: { key: string; name: string; description: string | null; priceMonthly: string; maxPages: number; maxContacts: number; maxAutomations: number; features: string[] }[] = []
  try {
    const rows = await db.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } })
    plans = rows.map((p) => ({
      key: p.key,
      name: p.name,
      description: p.description,
      priceMonthly: p.priceMonthly.toString(),
      maxPages: p.maxPages,
      maxContacts: p.maxContacts,
      maxAutomations: p.maxAutomations,
      features: Array.isArray(p.features) ? (p.features as string[]) : [],
    }))
  } catch {
    plans = []
  }

  if (plans.length === 0) {
    plans = [
      {
        key: 'starter', name: 'Starter', description: 'For a single Page getting started with comment automation.',
        priceMonthly: '0', maxPages: 1, maxContacts: 1000, maxAutomations: 3,
        features: ['1 connected Page', 'Comment-to-DM automation', 'Welcome & default replies', 'Basic analytics'],
      },
      {
        key: 'growth', name: 'Growth', description: 'For growing Pages running regular campaigns.',
        priceMonthly: '29', maxPages: 3, maxContacts: 10000, maxAutomations: 9,
        features: ['3 connected Pages', 'All automations', 'Broadcast campaigns', 'Click tracking & CTR', 'CSV export'],
      },
      {
        key: 'pro', name: 'Pro', description: 'For agencies and multi-Page operations.',
        priceMonthly: '79', maxPages: 10, maxContacts: 100000, maxAutomations: 30,
        features: ['10 connected Pages', 'Priority queue delivery', 'Advanced segments', 'Audit-friendly activity log', 'Priority support'],
      },
    ]
  }

  return (
    <div className="py-5">
      <div className="container py-lg-4" style={{ maxWidth: 1040 }}>
        <div className="text-center mb-5">
          <h1 className="fw-bold display-6">Simple, scalable pricing</h1>
          <p className="lead text-secondary mx-auto" style={{ maxWidth: 560 }}>
            Start free, upgrade when your conversations grow. Every plan uses the official Meta APIs and policy-aware sending.
          </p>
        </div>
        <div className="row g-4 justify-content-center">
          {plans.map((p, idx) => {
            const featured = idx === 1
            return (
              <div className="col-md-6 col-lg-4" key={p.key}>
                <div className={`card h-100 ${featured ? 'border-primary' : ''}`} style={featured ? { borderWidth: 2 } : undefined}>
                  <div className="card-body p-4 d-flex flex-column">
                    {featured && <span className="badge badge-soft-primary align-self-start mb-2">Most popular</span>}
                    <h3 className="fw-bold">{p.name}</h3>
                    <p className="text-secondary small">{p.description}</p>
                    <div className="d-flex align-items-baseline gap-1 mb-3">
                      <span className="fs-1 fw-bold">${Number(p.priceMonthly).toFixed(0)}</span>
                      <span className="text-secondary">/month</span>
                    </div>
                    <ul className="list-unstyled d-grid gap-2 small mb-4">
                      <li><i className="bi bi-check2 text-success me-2" />{p.maxPages} connected Page{p.maxPages > 1 ? 's' : ''}</li>
                      <li><i className="bi bi-check2 text-success me-2" />Up to {p.maxContacts.toLocaleString()} contacts</li>
                      <li><i className="bi bi-check2 text-success me-2" />{p.maxAutomations} automations</li>
                      {p.features.map((f) => (
                        <li key={f}><i className="bi bi-check2 text-success me-2" />{f}</li>
                      ))}
                    </ul>
                    <Link href="/register" className={`btn ${featured ? 'btn-primary' : 'btn-outline-primary'} mt-auto`}>
                      {Number(p.priceMonthly) === 0 ? 'Start free' : `Choose ${p.name}`}
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="soft-panel p-4 mt-5 text-center">
          <h5 className="fw-semibold mb-2">All plans include</h5>
          <p className="text-secondary small mb-0">
            Encrypted token storage · signed webhooks · tenant isolation · audit logs · opt-out suppression ·
            honest analytics with clearly labeled CTR denominators
          </p>
        </div>
      </div>
    </div>
  )
}
