import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { DashboardShell, type DashNavItem } from '@/components/DashboardShell'

const NAV: DashNavItem[] = [
  { href: '/admin', label: 'Overview', icon: 'bi-speedometer2', exact: true },
  { href: '/admin/users', label: 'Users', icon: 'bi-people' },
  { href: '/admin/pages', label: 'Facebook Pages', icon: 'bi-flag' },
  { href: '/admin/monitoring', label: 'Monitoring', icon: 'bi-activity' },
  { href: '/admin/audit', label: 'Audit Logs', icon: 'bi-journal-text' },
  { href: '/admin/settings', label: 'Platform Settings', icon: 'bi-sliders' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  // Server-side role check — hiding nav links is never the security measure.
  if (user.role !== 'ADMIN') redirect('/dashboard')
  return (
    <DashboardShell items={NAV} user={user} variant="admin">
      {children}
    </DashboardShell>
  )
}
