import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { DashboardShell, type DashNavItem } from '@/components/DashboardShell'

const NAV: DashNavItem[] = [
  { href: '/dashboard', label: 'Overview', icon: 'bi-speedometer2', exact: true },
  { href: '/dashboard/pages', label: 'Facebook Pages', icon: 'bi-flag' },
  { href: '/dashboard/automations/comment', label: 'Comment Automations', icon: 'bi-chat-square-quote' },
  { href: '/dashboard/automations/messenger', label: 'Messenger Automations', icon: 'bi-door-open' },
  { href: '/dashboard/contacts', label: 'Contacts', icon: 'bi-people' },
  { href: '/dashboard/campaigns', label: 'Campaigns', icon: 'bi-megaphone' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: 'bi-graph-up' },
  { href: '/dashboard/activity', label: 'Message Activity', icon: 'bi-chat-left-text' },
  { href: '/dashboard/settings', label: 'Settings', icon: 'bi-gear' },
  { href: '/dashboard/help', label: 'Help & Support', icon: 'bi-question-circle' },
]

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  if (user.role === 'ADMIN') redirect('/admin')
  return (
    <DashboardShell items={NAV} user={user}>
      {children}
    </DashboardShell>
  )
}
