'use client'

// Mounts the preserved member SPA verbatim. The SPA manages its own
// history-based router, API calls to /api/*, styles and PWA behaviour.
import { useEffect } from 'react'
import '../../spa/src/styles/tokens.css'
import '../../spa/src/styles/app.css'
import App from '../../spa/src/App'
import { disablePWAInDevelopment, initPWA } from '../../spa/src/lib/pwa.js'
import { watchSystemTheme } from '../../spa/src/lib/theme.js'

export default function SpaRoot() {
  useEffect(() => {
    const stopThemeSync = watchSystemTheme()
    if (process.env.NODE_ENV === 'production') initPWA()
    else disablePWAInDevelopment()
    return () => stopThemeSync?.()
  }, [])
  return <App />
}
