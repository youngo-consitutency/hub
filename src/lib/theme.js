export const THEME_STORAGE_KEY = 'youngo-hub:theme-override'
const THEMES = new Set(['light', 'dark'])

export function systemTheme(
  matchesDark = typeof window !== 'undefined'
    ? window.matchMedia?.('(prefers-color-scheme: dark)').matches
    : true,
) {
  return matchesDark ? 'dark' : 'light'
}

export function storedTheme(storage = globalThis.localStorage) {
  try {
    const value = storage.getItem(THEME_STORAGE_KEY)
    return THEMES.has(value) ? value : null
  } catch {
    return null
  }
}

export function resolvedTheme({ override, matchesDark }) {
  return override || systemTheme(matchesDark)
}

export function applyTheme(theme, root = document.documentElement) {
  const next = THEMES.has(theme) ? theme : systemTheme()
  root.dataset.theme = next
  root.ownerDocument
    ?.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', next === 'dark' ? '#0A0F0C' : '#F5F9F6')
  return next
}

export function getSavedTheme() {
  return storedTheme()
}

export function getInitialTheme() {
  return resolvedTheme({
    override: getSavedTheme(),
    matchesDark:
      typeof window !== 'undefined'
        ? window.matchMedia?.('(prefers-color-scheme: dark)').matches
        : true,
  })
}

export function saveTheme(theme) {
  const next = applyTheme(theme)
  localStorage.setItem(THEME_STORAGE_KEY, next)
  return next
}

export function clearThemeOverride(storage = globalThis.localStorage) {
  try {
    storage.removeItem(THEME_STORAGE_KEY)
  } catch {
    // Storage may be unavailable in privacy-restricted contexts.
  }
  return systemTheme()
}

export function hasChosenTheme() {
  return Boolean(getSavedTheme())
}
