'use client'

// Mounts the preserved member SPA verbatim. The SPA manages its own
// history-based router, API calls to /api/*, styles and PWA behaviour.
import { useEffect } from 'react'
import { SWRConfig } from 'swr'
import { Router } from 'wouter'
import '../../spa/src/styles/tokens.css'
import '../../spa/src/styles/app.css'
import App from '../../spa/src/App'
import { disablePWAInDevelopment, initPWA } from '../../spa/src/lib/pwa'
import { watchSystemTheme } from '../../spa/src/lib/theme'

export default function SpaRoot() {
  useEffect(() => {
    const stopThemeSync = watchSystemTheme()
    if (process.env.NODE_ENV === 'production') initPWA()
    else disablePWAInDevelopment()
    return () => stopThemeSync?.()
  }, [])
  // SWR defaults: collapse duplicate in-flight GETs and avoid a refetch storm
  // on every tab focus.
  return (
    <SWRConfig
      value={{
        dedupingInterval: 5000,
        focusThrottleInterval: 60000,
        errorRetryCount: 3,
      }}
    >
      {/* ssrPath keeps the SPA renderable during Next.js SSR — the old router
          served '/' as the server snapshot. */}
      <Router ssrPath="/">
        <App />
      </Router>
    </SWRConfig>
  )
}
