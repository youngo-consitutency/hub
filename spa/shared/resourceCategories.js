export const RESOURCE_CATEGORIES = [
  { key: 'join', label: 'Join' },
  { key: 'channels', label: 'Channels' },
  { key: 'workspace', label: 'Working files' },
  { key: 'reference', label: 'Reference' },
]

const PUBLIC_SOCIAL_HOSTS = [
  'linkedin.com',
  'instagram.com',
  'facebook.com',
  'twitter.com',
  'youtube.com',
  'tiktok.com',
]

const PRIVATE_CHANNEL_HOSTS = [
  'whatsapp.com',
  't.me',
  'telegram.me',
  'telegram.org',
  'discord.com',
  'discord.gg',
]

function resourceUrl(resource) {
  try {
    return new URL(resource?.url || '')
  } catch {
    return null
  }
}

// Exact host or a true subdomain — 'app.whatsapp.com' matches,
// 'notwhatsapp.com' does not.
const hostIs = (host, domain) => host === domain || host.endsWith(`.${domain}`)

export function resourceCategory(resource) {
  const url = resourceUrl(resource)
  const host = url?.hostname.replace(/^www\./, '').toLowerCase() || ''
  const path = url?.pathname.toLowerCase() || ''
  const label = `${resource?.label || ''}`.toLowerCase()

  if (
    /\b(join|membership|onboarding|register|registration|sign[ -]?up|renewal|interest)\b/.test(
      label,
    ) ||
    hostIs(host, 'airtable.com') ||
    host === 'forms.gle' ||
    (host === 'docs.google.com' && path.startsWith('/forms/'))
  ) {
    return 'join'
  }

  if (
    /\b(linktree|whatsapp|linkedin|instagram|facebook|telegram|discord|youtube|tiktok|social|channel)\b/.test(
      label,
    ) ||
    host === 'linktr.ee' ||
    host === 'x.com' ||
    host === 'youtu.be' ||
    [
      'whatsapp.com',
      'linkedin.com',
      'instagram.com',
      'facebook.com',
      'twitter.com',
      'youtube.com',
      't.me',
      'telegram.me',
      'discord.com',
      'discord.gg',
      'tiktok.com',
    ].some((domain) => hostIs(host, domain))
  ) {
    return 'channels'
  }

  if (
    host === 'drive.google.com' ||
    host === 'docs.google.com' ||
    host === 'meet.google.com' ||
    host === 'calendar.google.com' ||
    host === 'calendar.app.google' ||
    hostIs(host, 'zoom.us') ||
    hostIs(host, 'notion.site') ||
    host === 'notion.so'
  ) {
    return 'workspace'
  }

  return 'reference'
}

/**
 * Public group pages expose only open reference material and public-facing
 * social media. Join forms, chat invites, link hubs, working documents, and
 * shared drives stay behind the member workspace gate.
 */
export function isPublicGroupResource(resource) {
  const url = resourceUrl(resource)
  const host = url?.hostname.replace(/^www\./, '').toLowerCase() || ''
  const category = resourceCategory(resource)

  if (
    PRIVATE_CHANNEL_HOSTS.some(
      (privateHost) => host === privateHost || host.endsWith(`.${privateHost}`),
    )
  ) {
    return false
  }

  if (category === 'reference') return true

  return PUBLIC_SOCIAL_HOSTS.some(
    (publicHost) => host === publicHost || host.endsWith(`.${publicHost}`),
  )
}

export function groupResourcesByCategory(resources = []) {
  return RESOURCE_CATEGORIES.map((category) => ({
    ...category,
    resources: resources.filter((resource) => resourceCategory(resource) === category.key),
  })).filter((category) => category.resources.length > 0)
}
