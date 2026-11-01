'use client'

import { useSyncExternalStore } from 'react'
import { TbMoon as Moon, TbSun as Sun } from 'react-icons/tb'
import { chooseTheme } from '../lib/theme'

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
]

function subscribe(listener: () => void) {
  const observer = new MutationObserver(listener)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => observer.disconnect()
}

const snapshot = () => document.documentElement.dataset.theme || 'light'

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, snapshot, () => 'light')
  return (
    <div className="themeControl" role="group" aria-label="Appearance">
      <span className="themeControlLabel">Appearance</span>
      <div className="themeControlOptions">
        {OPTIONS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            className="themeControlOption"
            aria-pressed={theme === value}
            onClick={() => chooseTheme(value)}
          >
            <Icon size={18} strokeWidth={1.75} aria-hidden />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
