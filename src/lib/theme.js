export const THEME_STORAGE_KEY = 'youngo-hub:theme-override'
const THEMES = new Set(['light', 'dark'])

// Light is the product default. Dark renders only for members who opt in, so
// the operating-system colour scheme never decides the first paint.
export const DEFAULT_THEME = 'light'

export function storedTheme(storage = globalThis.localStorage) {
  try {
    const value = storage.getItem(THEME_STORAGE_KEY)
    return THEMES.has(value) ? value : null
  } catch {
    return null
  }
}

export function resolvedTheme({ override }) {
  return THEMES.has(override) ? override : DEFAULT_THEME
}

export function applyTheme(theme, root = document.documentElement) {
  const next = THEMES.has(theme) ? theme : DEFAULT_THEME
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
  return resolvedTheme({ override: getSavedTheme() })
}

export function saveTheme(theme) {
  const next = applyTheme(theme)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // Storage may be unavailable in privacy-restricted contexts.
  }
  return next
}

export function clearThemeOverride(storage = globalThis.localStorage) {
  try {
    storage.removeItem(THEME_STORAGE_KEY)
  } catch {
    // Storage may be unavailable in privacy-restricted contexts.
  }
  return DEFAULT_THEME
}

export function hasChosenTheme() {
  return Boolean(getSavedTheme())
}
