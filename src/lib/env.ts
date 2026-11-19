// Canonical app origin for absolute links: APP_BASE_URL, else the Vercel
// per-branch preview URL.
export const appBaseUrl = () => {
  const explicit = process.env.APP_BASE_URL
  const vercel = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL
  const origin = explicit || (vercel ? `https://${vercel}` : 'http://localhost:3000')
  return String(origin).replace(/\/$/, '')
}

// Sender identity derived from the app origin so self-hosts send from their
// own domain unless EMAIL_FROM is set explicitly.
export const defaultEmailFrom = () => `hub@${new URL(appBaseUrl()).hostname}`
