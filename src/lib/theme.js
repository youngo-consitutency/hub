const THEME_KEY = 'theme'
const THEMES = new Set(['light', 'dark'])

export function systemTheme() {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function getSavedTheme() {
  if (typeof localStorage === 'undefined') return null
  const value = localStorage.getItem(THEME_KEY)
  return THEMES.has(value) ? value : null
}

export function getInitialTheme() {
  return getSavedTheme() || systemTheme()
}

export function applyTheme(theme) {
  const next = THEMES.has(theme) ? theme : systemTheme()
  document.documentElement.setAttribute('data-theme', next)
  return next
}

export function saveTheme(theme) {
  const next = applyTheme(theme)
  localStorage.setItem(THEME_KEY, next)
  return next
}

export function hasChosenTheme() {
  return Boolean(getSavedTheme())
}
