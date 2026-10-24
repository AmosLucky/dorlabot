'use client'

import { useState } from 'react'
import AutomationsListClient from '@/components/automations/AutomationsListClient'

type Tab = 'WELCOME_MESSAGE' | 'DEFAULT_REPLY'

export default function MessengerAutomationsPage() {
  const [tab, setTab] = useState<Tab>('WELCOME_MESSAGE')
  return (
    <div>
      <ul className="nav nav-pills mb-4 gap-2">
        <li className="nav-item">
          <button className={`nav-link ${tab === 'WELCOME_MESSAGE' ? 'active' : 'text-secondary'}`} onClick={() => setTab('WELCOME_MESSAGE')}>
            <i className="bi bi-door-open me-1" />Welcome messages
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === 'DEFAULT_REPLY' ? 'active' : 'text-secondary'}`} onClick={() => setTab('DEFAULT_REPLY')}>
            <i className="bi bi-reply me-1" />Default replies
          </button>
        </li>
      </ul>
      {tab === 'WELCOME_MESSAGE' ? (
        <AutomationsListClient
          types={['WELCOME_MESSAGE']}
          title="Messenger welcome messages"
          description="Greet first-time contacts when they message your Page — sent once, only for genuine inbound interactions."
          empty={{
            icon: 'bi-door-open',
            title: 'No welcome message configured',
            text: 'Set up a welcome automation so new Messenger contacts immediately receive a friendly, personalized greeting with optional quick replies.',
          }}
        />
      ) : (
        <AutomationsListClient
          types={['DEFAULT_REPLY']}
          title="Default replies"
          description="Answer incoming Messenger conversations with keyword-based replies and a fallback message."
          empty={{
            icon: 'bi-reply',
            title: 'No default reply configured',
            text: 'Configure keyword replies and a fallback so people who message your Page always get a fast, helpful response.',
          }}
        />
      )}
    </div>
  )
}
