'use client'

// Mounts the member app for routes not yet ported to the App Router.
import { useEffect } from 'react'
import { SWRConfig } from 'swr'
import '../member/styles/tokens.css'
import '../member/styles/app.css'
import App from '../member/App'
import { disablePWAInDevelopment, initPWA } from '../member/lib/pwa'
import { RouterBridge } from '../member/lib/router'
import { watchSystemTheme } from '../member/lib/theme'

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
      <RouterBridge />
      <App />
    </SWRConfig>
  )
}
