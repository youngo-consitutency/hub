// The Hub is one web app at /hub; its pages live in the hash (/hub#/calendar/x).
// Before that, each page had its own top-level URL, so old links, emails and push
// notifications still carry these first segments and are redirected into the Hub.
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
