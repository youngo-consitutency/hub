import type { AnyValue } from './types'
const THEMES = new Set(['light', 'dark'])
export const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)'
// shared with public/theme-init.js, which applies it before first paint
export const THEME_STORAGE_KEY = 'youngo-hub:theme-override'

// Follow the device until the member explicitly chooses an appearance; light
// is the fallback when the browser does not expose its colour preference.
export const DEFAULT_THEME = 'light'

function themeStorage() {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function themePreference(storage: AnyValue = themeStorage()) {
  try {
    const saved = storage?.getItem(THEME_STORAGE_KEY)
    return THEMES.has(saved) ? saved : null
  } catch {
    return null
  }
}

export function systemTheme(media: AnyValue) {
  return media?.matches ? 'dark' : DEFAULT_THEME
}

export function applyTheme(theme: AnyValue, root = document.documentElement) {
  const next = THEMES.has(theme) ? theme : DEFAULT_THEME
  root.dataset.theme = next
  root.ownerDocument
    ?.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', next === 'dark' ? '#0A0F0C' : '#F5F9F6')
  return next
}

export function chooseTheme(
  theme: AnyValue,
  { root = globalThis.document?.documentElement, storage = themeStorage() } = {},
) {
  const next = THEMES.has(theme) ? theme : DEFAULT_THEME
  try {
    storage?.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // the control still works for this page when storage is unavailable
  }
  return applyTheme(next, root)
}

export function watchSystemTheme({
  root = globalThis.document?.documentElement,
  media = globalThis.matchMedia?.(SYSTEM_THEME_QUERY),
  storage = themeStorage(),
  events = globalThis.window as AnyValue,
} = {}) {
  if (!root) return () => {}

  const update = () => applyTheme(themePreference(storage) || systemTheme(media), root)
  // another tab chose a theme, or cleared storage (key null)
  const storageChanged = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) update()
  }
  update()
  media?.addEventListener?.('change', update)
  events?.addEventListener?.('storage', storageChanged)

  return () => {
    media?.removeEventListener?.('change', update)
    events?.removeEventListener?.('storage', storageChanged)
  }
}
