import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Cookie Policy' }

export default function CookiesPage() {
  return (
    <div className="py-5">
      <div className="container py-lg-3" style={{ maxWidth: 800 }}>
        <h1 className="fw-bold mb-4">Cookie Policy</h1>
        <p className="text-secondary">Last updated: October 2026</p>

        <h4 className="fw-semibold mt-4">Cookies we use</h4>
        <p className="text-secondary">
          DorlaCode uses the minimum set of cookies required to run the application. We do not use advertising or
          third-party tracking cookies.
        </p>

        <div className="table-responsive">
          <table className="table align-middle">
            <thead>
              <tr>
                <th>Cookie</th>
                <th>Purpose</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody className="text-secondary">
              <tr>
                <td><code>dorla_session</code></td>
                <td>Authentication session. HTTP-only, SameSite=Lax, Secure in production. Contains an opaque random token — no personal data.</td>
                <td>30 days or until sign-out</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h4 className="fw-semibold mt-4">Local storage</h4>
        <p className="text-secondary">
          The dashboard may keep minor UI preferences (such as table filters) in your browser&apos;s local storage. No
          personal or messaging data is stored client-side.
        </p>

        <h4 className="fw-semibold mt-4">Managing cookies</h4>
        <p className="text-secondary">
          You can clear or block cookies in your browser settings. Blocking the session cookie will sign you out and
          prevent the dashboard from working, since authentication depends on it.
        </p>
      </div>
    </div>
  )
}
