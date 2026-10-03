const THEMES = new Set(['light', 'dark'])
export const SYSTEM_THEME_QUERY = '(prefers-color-scheme: dark)'

// Light is the safe fallback when the browser does not expose its colour
// preference. In supported browsers the operating system remains the single
// source of truth; the Hub does not store a competing override.
export const DEFAULT_THEME = 'light'

export function systemTheme(media: any) {
  return media?.matches ? 'dark' : DEFAULT_THEME
}

export function applyTheme(theme: any, root = document.documentElement) {
  const next = THEMES.has(theme) ? theme : DEFAULT_THEME
  root.dataset.theme = next
  root.ownerDocument
    ?.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', next === 'dark' ? '#0A0F0C' : '#F5F9F6')
  return next
}

export function watchSystemTheme({
  root = globalThis.document?.documentElement,
  media = globalThis.matchMedia?.(SYSTEM_THEME_QUERY),
} = {}) {
  if (!root) return () => {}

  const update = () => applyTheme(systemTheme(media), root)
  update()
  media?.addEventListener?.('change', update)

  return () => media?.removeEventListener?.('change', update)
}
