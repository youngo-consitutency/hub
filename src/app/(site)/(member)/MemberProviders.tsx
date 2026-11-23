'use client'

// Gate chain: AccountProvider → AccessGate → MemberGate → Shell → page.
import { useEffect } from 'react'
import { SWRConfig } from 'swr'
import '../../../member/styles/app.css'
import { AccessGate } from '../../../member/components/AccessGate'
import { MemberGate } from '../../../member/components/MemberGate'
import { AccountProvider } from '../../../member/lib/accountContext'
import { disablePWAInDevelopment, initPWA } from '../../../member/lib/pwa'
import { RouterProvider } from 'react-aria-components'
import { navigate, RouterBridge } from '../../../member/lib/router'

interface MemberProvidersProps {
  children: React.ReactNode
  /** Public CMS documents loaded on the server, keyed like the SWR cache (`/documents/<slug>`). */
  documents: Record<string, unknown>
}

/** Client providers for the member and public site, seeded with the server-loaded documents. */
export function MemberProviders({ children, documents }: MemberProvidersProps) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') initPWA()
    else disablePWAInDevelopment()
  }, [])
  // react aria links and menu items navigate through the app router
  return (
    <SWRConfig
      value={{
        dedupingInterval: 5000,
        focusThrottleInterval: 60000,
        errorRetryCount: 3,
        fallback: documents,
      }}
    >
      <RouterBridge />
      <RouterProvider navigate={(href) => navigate(href)}>
        <AccountProvider>
          <AccessGate>
            <MemberGate>{children}</MemberGate>
          </AccessGate>
        </AccountProvider>
      </RouterProvider>
    </SWRConfig>
  )
}
