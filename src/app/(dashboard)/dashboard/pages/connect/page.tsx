import { Suspense } from 'react'
import ConnectClient from './ConnectClient'

export default function ConnectPage() {
  return (
    <Suspense fallback={<div className="text-center py-5"><span className="spinner-border text-primary" /></div>}>
      <ConnectClient />
    </Suspense>
  )
}
