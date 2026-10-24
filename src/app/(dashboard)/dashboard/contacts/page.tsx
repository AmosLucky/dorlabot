import { Suspense } from 'react'
import ContactsClient from './ContactsClient'

export default function ContactsPage() {
  return (
    <Suspense fallback={<div className="text-center py-5"><span className="spinner-border text-primary" /></div>}>
      <ContactsClient />
    </Suspense>
  )
}
