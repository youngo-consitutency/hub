export function detectDevice({
  userAgent = '',
  platform = '',
  maxTouchPoints = 0,
} = {}) {
  if (
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (platform === 'MacIntel' && maxTouchPoints > 1)
  ) {
    return 'ios'
  }
  if (/Android/i.test(userAgent)) return 'android'
  return 'desktop'
}

export function currentDevice() {
  return detectDevice({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  })
}
