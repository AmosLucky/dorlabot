import { Suspense } from 'react'
import PagesClient from './PagesClient'

export default function PagesPage() {
  return (
    <Suspense fallback={<div className="text-center py-5"><span className="spinner-border text-primary" /></div>}>
      <PagesClient />
    </Suspense>
  )
}
