import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted brand typefaces (no external font request — members are often on
// conference Wi-Fi). Weight budget per design-system §3: two-to-three per family.
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/space-grotesk/700.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import '@fontsource/jetbrains-mono/700.css'
import './styles/tokens.css'
import './styles/app.css'
import App from './App.jsx'
import { applyTheme, getInitialTheme } from './lib/theme.js'
import { disablePWAInDevelopment, initPWA } from './lib/pwa.js'

applyTheme(getInitialTheme())

// Notification permission is requested only from an explicit settings action.
if (import.meta.env.PROD) {
  initPWA()
} else {
  // A production service worker on localhost can otherwise cache Vite's
  // changing React modules and load two incompatible copies after a restart.
  disablePWAInDevelopment()
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
