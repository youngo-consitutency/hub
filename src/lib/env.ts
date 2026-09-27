// Canonical app origin for absolute links (emails, redirects). APP_BASE_URL
// must be set in production; localhost is the local-dev default.
export const appBaseUrl = () =>
  String(process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

// Sender identity derived from the app origin so self-hosts send from their
// own domain unless EMAIL_FROM is set explicitly.
export const defaultEmailFrom = () => `hub@${new URL(appBaseUrl()).hostname}`
