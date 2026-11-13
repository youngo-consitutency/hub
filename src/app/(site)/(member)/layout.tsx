'use client'

// Layout for member routes ported to the App Router. Gate chain:
// AccountProvider (the one account copy) → AccessGate (public/auth surfaces)
// → MemberGate (route guards) → Shell → page.
import { useEffect } from 'react'
import { SWRConfig } from 'swr'
import '../../../member/styles/app.css'
import { AccessGate } from '../../../member/components/AccessGate'
import { MemberGate } from '../../../member/components/MemberGate'
import { AccountProvider } from '../../../member/lib/accountContext'
import { disablePWAInDevelopment, initPWA } from '../../../member/lib/pwa'
import { RouterProvider } from 'react-aria-components'
import { navigate, RouterBridge } from '../../../member/lib/router'
import { watchSystemTheme } from '../../../member/lib/theme'

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const stopThemeSync = watchSystemTheme()
    if (process.env.NODE_ENV === 'production') initPWA()
    else disablePWAInDevelopment()
    return () => stopThemeSync?.()
  }, [])
  // react aria links and menu items navigate through the app router
  return (
    <SWRConfig value={{ dedupingInterval: 5000, focusThrottleInterval: 60000, errorRetryCount: 3 }}>
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
