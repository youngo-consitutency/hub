import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { applyTheme, getInitialTheme, saveTheme } from '../lib/theme.js'

export function FloatingThemeToggle() {
  const [theme, setTheme] = useState(getInitialTheme)
  const isDark = theme === 'dark'
  const Icon = isDark ? Sun : Moon
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme'

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggle = () => {
    setTheme((current) => saveTheme(current === 'dark' ? 'light' : 'dark'))
  }

  return (
    <button type="button" className="floatingThemeToggle" onClick={toggle} aria-label={label} title={label}>
      <Icon size={19} strokeWidth={1.75} aria-hidden />
    </button>
  )
}
