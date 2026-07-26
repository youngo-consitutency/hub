;(() => {
  const storageKey = 'youngo-hub:theme-override'
  let saved = null

  try {
    saved = localStorage.getItem(storageKey)
  } catch {
    // Storage may be unavailable in privacy-restricted contexts.
  }

  // Light is the default. Dark applies only when the member has chosen it.
  const theme = saved === 'dark' ? 'dark' : 'light'

  document.documentElement.dataset.theme = theme
  // Warm member register is the safe default; the Shell promotes operational
  // routes to the dense 'mission' surface on mount.
  document.documentElement.dataset.surface = 'member'
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0A0F0C' : '#F5F9F6')
})()
