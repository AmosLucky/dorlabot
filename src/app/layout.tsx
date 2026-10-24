import type { Metadata } from 'next'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import './globals.css'
import BootstrapClient from '@/components/BootstrapClient'

export const metadata: Metadata = {
  title: {
    default: 'DorlaCode — Facebook Messenger Automation for Pages',
    template: '%s · DorlaCode',
  },
  description:
    'Turn Facebook comments into eligible private Messenger replies, welcome new contacts, and send policy-aware broadcast campaigns — with full analytics and click tracking.',
  keywords: ['Facebook Messenger automation', 'comment to DM', 'broadcast campaigns', 'Meta marketing', 'chat automation'],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <BootstrapClient />
      </body>
    </html>
  )
}
