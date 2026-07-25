import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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
  </StrictMode>
)
