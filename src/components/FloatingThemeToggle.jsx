import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import {
  applyTheme,
  clearThemeOverride,
  getInitialTheme,
  getSavedTheme,
  saveTheme,
  systemTheme,
} from '../lib/theme.js'

export function FloatingThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme)
  const [mode, setMode] = useState(() => getSavedTheme() || 'system')
  const isDark = theme === 'dark'
  const Icon = isDark ? Sun : Moon
  const label = mode === 'light'
    ? 'Use system theme'
    : (isDark ? 'Switch to light theme' : 'Switch to dark theme')

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (mode !== 'system') return undefined
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    const update = () => setTheme(systemTheme(Boolean(media?.matches)))
    media?.addEventListener?.('change', update)
    return () => media?.removeEventListener?.('change', update)
  }, [mode])

  const toggle = () => {
    if (mode === 'light') {
      setMode('system')
      setTheme(clearThemeOverride())
      return
    }
    const next = theme === 'dark' ? 'light' : 'dark'
    setMode(next)
    setTheme(saveTheme(next))
  }

  return (
    <button type="button" className="floatingThemeToggle" onClick={toggle} aria-label={label} title={label}>
      <Icon size={19} strokeWidth={1.75} aria-hidden />
    </button>
  )
}
