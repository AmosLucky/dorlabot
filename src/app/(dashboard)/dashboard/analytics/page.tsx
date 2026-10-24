'use client'

import { useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { useApi } from '@/hooks/useApi'
import { Loading, ErrorState } from '@/components/ui'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Legend, Filler)

type Summary = {
  automationEvents: number
  attempted: number
  sent: number
  delivered: number
  read: number
  failed: number
  skipped: number
  uniqueContactsReached: number
  clicks: number
  uniqueClickers: number
  ctr: number | null
  ctrDenominator: 'delivered' | 'sent' | null
  deliveryEventsAvailable: boolean
}
type Series = { date: string; sent: number; failed: number; skipped: number; clicks: number }
type CampaignComparison = {
  id: string
  name: string
  status: string
  sentCount: number
  delivered: number
  uniqueClickers: number
  ctr: number | null
  ctrDenominator: string | null
}

const RANGES = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
]

const CHART_COLORS = {
  primary: '#7c3aed',
  green: '#16a34a',
  red: '#dc2626',
  amber: '#d97706',
  blue: '#0284c7',
  gray: '#9ca3af',
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30)
  const summaryQ = useApi<Summary>(`/api/analytics/summary?days=${days}`)
  const seriesQ = useApi<{ series: Series[]; incoming: number }>(`/api/analytics/timeseries?days=${days}`)
  const campaignsQ = useApi<{ campaigns: CampaignComparison[] }>('/api/analytics/campaigns')

  if (summaryQ.loading || seriesQ.loading) return <Loading />
  if (summaryQ.error) return <ErrorState message={summaryQ.error} onRetry={summaryQ.refetch} />
  const s = summaryQ.data!

  const cards = [
    { label: 'Automation events', value: s.automationEvents, icon: 'bi-lightning-charge' },
    { label: 'Messages sent', value: s.sent, icon: 'bi-send' },
    { label: s.deliveryEventsAvailable ? 'Delivered' : 'Delivered (no events yet)', value: s.delivered, icon: 'bi-check2-circle' },
    { label: 'Read', value: s.read, icon: 'bi-envelope-open' },
    { label: 'Failed', value: s.failed, icon: 'bi-x-circle' },
    { label: 'Unique contacts reached', value: s.uniqueContactsReached, icon: 'bi-people' },
    { label: 'Link clicks', value: s.clicks, icon: 'bi-mouse2' },
    { label: 'Unique clickers', value: s.uniqueClickers, icon: 'bi-person-check' },
  ]

  const series = seriesQ.data?.series ?? []
  const lineData = {
    labels: series.map((p) => p.date.slice(5)),
    datasets: [
      { label: 'Sent', data: series.map((p) => p.sent), borderColor: CHART_COLORS.primary, backgroundColor: 'rgba(124,58,237,0.08)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 },
      { label: 'Failed', data: series.map((p) => p.failed), borderColor: CHART_COLORS.red, backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
      { label: 'Clicks', data: series.map((p) => p.clicks), borderColor: CHART_COLORS.blue, backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1.5 },
    ],
  }

  const donutData = {
    labels: ['Sent', 'Delivered/Read', 'Failed', 'Skipped'],
    datasets: [
      {
        data: [Math.max(0, s.sent - s.delivered), s.delivered, s.failed, s.skipped],
        backgroundColor: [CHART_COLORS.primary, CHART_COLORS.green, CHART_COLORS.red, CHART_COLORS.amber],
        borderWidth: 0,
      },
    ],
  }

  const campaigns = campaignsQ.data?.campaigns ?? []
  const barData = {
    labels: campaigns.slice(0, 8).map((c) => (c.name.length > 18 ? `${c.name.slice(0, 18)}…` : c.name)),
    datasets: [
      { label: 'Sent', data: campaigns.slice(0, 8).map((c) => c.sentCount), backgroundColor: CHART_COLORS.primary, borderRadius: 4 },
      { label: 'Unique clickers', data: campaigns.slice(0, 8).map((c) => c.uniqueClickers), backgroundColor: CHART_COLORS.blue, borderRadius: 4 },
    ],
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="h4 fw-bold mb-1">Analytics</h1>
          <p className="text-secondary small mb-0">
            CTR = unique clickers ÷ delivered × 100
            {!s.deliveryEventsAvailable && s.sent > 0 && ' — delivery events not available from Meta yet, using sent as denominator (labeled)'}
            {s.ctr !== null && s.ctrDenominator && <> · current CTR <strong>{s.ctr}%</strong> ({s.ctrDenominator} denominator)</>}
          </p>
        </div>
        <div className="btn-group btn-group-sm">
          {RANGES.map((r) => (
            <button key={r.days} className={`btn ${days === r.days ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setDays(r.days)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="row g-3 mb-4">
        {cards.map((c) => (
          <div className="col-6 col-md-3" key={c.label}>
            <div className="card stat-card h-100">
              <div className="card-body py-3">
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="stat-label">{c.label}</span>
                  <i className={`bi ${c.icon} text-primary`} />
                </div>
                <div className="stat-value">{c.value.toLocaleString()}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          <div className="card h-100">
            <div className="card-header">Messaging & clicks over time</div>
            <div className="card-body">
              <Line data={lineData} options={{ responsive: true, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxHeight: 6 } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }, interaction: { mode: 'index', intersect: false } }} />
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card h-100">
            <div className="card-header">Outcome distribution</div>
            <div className="card-body d-flex align-items-center justify-content-center" style={{ minHeight: 260 }}>
              {s.attempted === 0 ? (
                <p className="text-secondary small text-center mb-0">No outgoing messages in this period yet.</p>
              ) : (
                <Doughnut data={donutData} options={{ responsive: true, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxHeight: 6 } } }, cutout: '62%' }} />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-7">
          <div className="card h-100">
            <div className="card-header">Campaign comparison</div>
            <div className="card-body">
              {campaigns.length === 0 ? (
                <p className="text-secondary small text-center mb-0 py-4">Launch a campaign to compare performance here.</p>
              ) : (
                <Bar data={barData} options={{ responsive: true, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxHeight: 6 } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card h-100">
            <div className="card-header">CTR by campaign</div>
            <div className="card-body p-0" style={{ maxHeight: 340, overflowY: 'auto' }}>
              {campaigns.length === 0 ? (
                <p className="text-secondary small text-center mb-0 py-4">No campaigns yet.</p>
              ) : (
                <ul className="list-group list-group-flush">
                  {campaigns.map((c) => (
                    <li key={c.id} className="list-group-item px-3 d-flex justify-content-between align-items-center">
                      <div>
                        <div className="small fw-semibold text-truncate" style={{ maxWidth: 220 }}>{c.name}</div>
                        <div className="small text-secondary">
                          {c.uniqueClickers} unique clickers / {c.ctrDenominator === 'delivered' ? `${c.delivered} delivered` : `${c.sentCount} sent`}
                          {c.ctrDenominator === 'sent' && ' (delivery events unavailable)'}
                        </div>
                      </div>
                      <span className="fw-bold text-primary">{c.ctr !== null ? `${c.ctr}%` : '—'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
