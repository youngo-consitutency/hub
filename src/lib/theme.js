export const THEME_STORAGE_KEY = 'youngo-hub:theme-override'

export function systemTheme(matchesDark) {
  return matchesDark ? 'dark' : 'light'
}

export function storedTheme(storage) {
  try {
    const value = storage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

export function resolvedTheme({ override, matchesDark }) {
  return override || systemTheme(matchesDark)
}

export function applyTheme(theme, root = document.documentElement) {
  root.dataset.theme = theme
  root.ownerDocument?.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0A0F0C' : '#F5F9F6')
}
