// The Hub lives at /hub with pages in the hash; old top-level URLs in emails
// and push notifications are redirected into it.
export const HUB_ROOT = '/hub'

export const LEGACY_HUB_SEGMENTS: ReadonlySet<string> = new Set([
  'account',
  'admin',
  'book',
  'calendar',
  'council',
  'coys',
  'cp',
  'directory',
  'focal',
  'groups',
  'gys',
  'help',
  'intelligence',
  'library',
  'mail',
  'membership',
  'ngo',
  'onboarding',
  'opportunities',
  'platform',
  'profile',
  'recognition',
  'resources',
  'search',
  'staff',
  'submissions',
  'team',
  'work',
  'workspace',
])

/** The URL of a Hub page, for links that leave the app (emails, push, redirects). */
export const hubUrl = (path = '/') => (path === '/' ? HUB_ROOT : `${HUB_ROOT}#${path}`)
