import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/space-grotesk/500.css'
import '@fontsource/space-grotesk/600.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/600.css'
import './styles/tokens.css'
import './styles/app.css'
import App from './App.jsx'
import { applyTheme, getInitialTheme } from './lib/theme.js'
import { initPWA } from './lib/pwa.js'

applyTheme(getInitialTheme())

// Initialize PWA features (service worker, push notifications)
initPWA(import.meta.env.VITE_VAPID_PUBLIC_KEY || null)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
