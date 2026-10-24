import SiteNavbar from '@/components/SiteNavbar'
import SiteFooter from '@/components/SiteFooter'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-vh-100 d-flex flex-column">
      <SiteNavbar />
      <main className="flex-grow-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
