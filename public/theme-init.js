;(() => {
  const storageKey = 'youngo-hub:theme-override'
  let saved = null

  try {
    saved = localStorage.getItem(storageKey)
  } catch {
    // Storage may be unavailable in privacy-restricted contexts.
  }

  const theme =
    saved === 'light' || saved === 'dark'
      ? saved
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'

  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0A0F0C' : '#F5F9F6')
})()
