;(() => {
  const storageKey = 'youngo-hub:theme-override'
  let saved = null

  try {
    saved = localStorage.getItem(storageKey)
  } catch {
    // Storage may be unavailable in privacy-restricted contexts.
  }

  // Match the runtime (src/member/lib/theme.ts) before first paint so there
  // is no light/dark flash: a saved choice wins, otherwise the device setting.
  const theme =
    saved === 'dark' || saved === 'light'
      ? saved
      : window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'

  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0A0F0C' : '#F5F9F6')
})()
